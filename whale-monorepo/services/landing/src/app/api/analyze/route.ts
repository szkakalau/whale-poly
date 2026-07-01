import { NextResponse } from 'next/server';
import { analyzeMarket, getEmptyMessage, getLimitedDataMessage, getStalenessMessage, getMixedMessage } from '@/lib/analysis-engine';
import { checkRateLimit } from '@/lib/rate-limiter';
import { resolveMarketSlug, type MarketMatch } from '@/lib/nl-matcher';
import { logAnalyzeQuery } from '@/lib/analyze-analytics';

// ── Helpers ────────────────────────────────────────────

function formatAnalysisPlainText(result: Awaited<ReturnType<typeof analyzeMarket>>, marketTitle?: string): string {
  const lines: string[] = [];

  const label = marketTitle || result.marketSlug;

  const dirEmoji = {
    bullish: '🟢',
    bearish: '🔴',
    neutral: '⚪',
    mixed: '🟡',
  }[result.direction];
  lines.push(`${dirEmoji} 鲸鱼对 *${label}* 的判断：**${result.direction.toUpperCase()}**`);
  lines.push(`信心分：${result.confidenceScore}/100 (${result.confidenceLevel})`);
  lines.push('');

  lines.push(`📊 YES 交易量：$${(result.yesVolumeUsd / 1000).toFixed(0)}k · NO 交易量：$${(result.noVolumeUsd / 1000).toFixed(0)}k`);
  lines.push(`🐋 检测到 ${result.whaleTradeCount} 笔鲸鱼交易`);
  lines.push('');

  if (result.topWallets.length > 0) {
    lines.push('🔎 *关键钱包动向：*');
    for (const w of result.topWallets) {
      const action = w.action === 'BUY' ? '买入' : w.action === 'SELL' ? '卖出' : '交易';
      lines.push(`  ${w.addressShort} — ${action} $${(w.amountUsd / 1000).toFixed(0)}k ${w.outcome}`);
    }
    lines.push('');
  }

  if (result.whaleTradeCount < 3) {
    lines.push(getLimitedDataMessage(result.whaleTradeCount));
  }
  if (result.dataFreshness.stalenessMinutes > 360) {
    lines.push(getStalenessMessage(result.dataFreshness.stalenessMinutes));
  }
  if (result.direction === 'mixed') {
    const bullishCount = result.topWallets.filter(w => w.outcome === 'YES').length;
    const bearishCount = result.topWallets.filter(w => w.outcome === 'NO').length;
    lines.push(getMixedMessage(bullishCount, bearishCount));
  }

  lines.push('');
  lines.push(result.disclaimer);

  return lines.join('\n');
}

type AnalyzeResponse = {
  marketSlug?: string;
  marketTitle?: string;
  direction?: string;
  confidenceLevel?: string;
  confidenceScore?: number;
  whaleTradeCount?: number;
  yesVolumeUsd?: number;
  noVolumeUsd?: number;
  topWallets?: unknown[];
  dataFreshness?: { lastUpdated: string; stalenessMinutes: number };
  disclaimer?: string;
  formattedText?: string;
  message?: string;
  retryAfterSec?: number;
  matchMethod?: 'url' | 'search' | 'none';
  candidates?: MarketMatch[];
  error?: string;
};

// ── Route Handlers ─────────────────────────────────────

export async function POST(req: Request) {
  let body: { query?: string; userId?: string; followedWallets?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Could not parse the request.' } satisfies AnalyzeResponse,
      { status: 400 },
    );
  }

  const query = body?.query?.trim();
  if (!query) {
    return NextResponse.json(
      { error: 'empty_query', message: 'Please provide a market link or keyword. Example: /analyze BTC 150k' } satisfies AnalyzeResponse,
      { status: 400 },
    );
  }

  // Rate limit
  const userId = body?.userId || 'anonymous';
  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: rateCheck.message, retryAfterSec: rateCheck.retryAfterSec } satisfies AnalyzeResponse,
      { status: 429 },
    );
  }

  // Resolve market via NL matcher (Phase 2: Gamma API search)
  const resolved = await resolveMarketSlug(query);
  if (!resolved.slug) {
    return NextResponse.json(
      {
        error: 'no_match',
        message: 'Could not identify this market. Try different keywords or paste a Polymarket link directly.',
        candidates: resolved.candidates,
        matchMethod: 'none',
      } satisfies AnalyzeResponse,
      { status: 404 },
    );
  }

  // Analyze
  const followedWallets = body?.followedWallets || [];
  const analyzeStart = Date.now();
  let analysis: Awaited<ReturnType<typeof analyzeMarket>>;
  let analyzeError: string | undefined;
  try {
    analysis = await analyzeMarket(resolved.slug, { followedWallets });
  } catch (e) {
    console.error('analyze_market_failed', { slug: resolved.slug, error: String(e) });
    analyzeError = 'analysis_failed';
    logAnalyzeQuery({
      query,
      matched: true,
      matchMethod: resolved.matched,
      marketSlug: resolved.slug || undefined,
      durationMs: Date.now() - analyzeStart,
      source: body?.userId?.startsWith('tg_') ? 'telegram' : 'web',
      userId,
      error: analyzeError,
    });
    return NextResponse.json(
      { error: 'analysis_failed', message: '⚠️ Analysis temporarily unavailable. Please try again (usually recovers in < 5 minutes).' } satisfies AnalyzeResponse,
      { status: 500 },
    );
  }

  // Log analytics
  const durationMs = Date.now() - analyzeStart;
  logAnalyzeQuery({
    query,
    matched: analysis.whaleTradeCount > 0,
    matchMethod: resolved.matched,
    marketSlug: resolved.slug || undefined,
    direction: analysis.direction,
    confidenceScore: analysis.confidenceScore,
    durationMs,
    source: body?.userId?.startsWith('tg_') ? 'telegram' : 'web',
    userId,
  });

  // No data case
  if (analysis.whaleTradeCount === 0) {
    return NextResponse.json({
      marketSlug: analysis.marketSlug,
      marketTitle: resolved.candidates[0]?.title,
      direction: 'neutral',
      confidenceLevel: 'low',
      confidenceScore: 0,
      whaleTradeCount: 0,
      message: getEmptyMessage(resolved.slug),
      disclaimer: analysis.disclaimer,
      matchMethod: resolved.matched,
      candidates: resolved.candidates,
    } satisfies AnalyzeResponse);
  }

  const marketTitle = resolved.candidates[0]?.title;
  const plainText = formatAnalysisPlainText(analysis, marketTitle);

  return NextResponse.json({
    ...analysis,
    marketTitle,
    formattedText: plainText,
    matchMethod: resolved.matched,
    candidates: resolved.candidates,
  } satisfies AnalyzeResponse);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();
  if (!query) {
    return NextResponse.json(
      { error: 'missing_q', message: '?q=<market slug or URL>' } satisfies AnalyzeResponse,
      { status: 400 },
    );
  }

  const resolved = await resolveMarketSlug(query);
  if (!resolved.slug) {
    return NextResponse.json(
      { error: 'no_match', message: 'Could not identify this market.', candidates: resolved.candidates, matchMethod: 'none' } satisfies AnalyzeResponse,
      { status: 404 },
    );
  }

  try {
    const analysis = await analyzeMarket(resolved.slug);
    if (analysis.whaleTradeCount === 0) {
      return NextResponse.json({
        marketSlug: analysis.marketSlug,
        marketTitle: resolved.candidates[0]?.title,
        direction: 'neutral',
        confidenceLevel: 'low',
        confidenceScore: 0,
        whaleTradeCount: 0,
        message: getEmptyMessage(resolved.candidates[0]?.title || resolved.slug),
        disclaimer: analysis.disclaimer,
        matchMethod: resolved.matched,
        candidates: resolved.candidates,
      } satisfies AnalyzeResponse);
    }

    return NextResponse.json({
      ...analysis,
      marketTitle: resolved.candidates[0]?.title,
      matchMethod: resolved.matched,
      candidates: resolved.candidates,
    } satisfies AnalyzeResponse);
  } catch (e) {
    console.error('analyze_route_failed', { query, error: String(e), stack: e instanceof Error ? e.stack : undefined });
    return NextResponse.json(
      { error: 'analysis_failed', message: '⚠️ Analysis temporarily unavailable. Please try again later.' } satisfies AnalyzeResponse,
      { status: 500 },
    );
  }
}
