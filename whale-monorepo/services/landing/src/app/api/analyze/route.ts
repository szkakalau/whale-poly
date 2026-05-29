import { NextResponse } from 'next/server';
import { analyzeMarket, getEmptyMessage, getLimitedDataMessage, getStalenessMessage, getMixedMessage } from '@/lib/analysis-engine';
import { checkRateLimit } from '@/lib/rate-limiter';

// ── Helpers ────────────────────────────────────────────

function extractMarketSlug(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Direct URL: extract slug from polymarket.com/event/...
  const urlMatch = trimmed.match(/polymarket\.com\/event\/([^/?\s]+)/i);
  if (urlMatch) return urlMatch[1];

  // Plain text: use as-is (Phase 2 will add Gamma API NL matching)
  // For now, pass the query directly — it might match market_title in the DB
  return trimmed.slice(0, 200); // cap to prevent SQL injection via length
}

function formatAnalysisPlainText(result: Awaited<ReturnType<typeof analyzeMarket>>): string {
  const lines: string[] = [];

  // Header
  const dirEmoji = {
    bullish: '🟢',
    bearish: '🔴',
    neutral: '⚪',
    mixed: '🟡',
  }[result.direction];
  lines.push(`${dirEmoji} 鲸鱼对 *${result.marketSlug}* 的判断：**${result.direction.toUpperCase()}**`);
  lines.push(`信心分：${result.confidenceScore}/100 (${result.confidenceLevel})`);
  lines.push('');

  // Volume summary
  lines.push(`📊 YES 交易量：$${(result.yesVolumeUsd / 1000).toFixed(0)}k · NO 交易量：$${(result.noVolumeUsd / 1000).toFixed(0)}k`);
  lines.push(`🐋 检测到 ${result.whaleTradeCount} 笔鲸鱼交易`);
  lines.push('');

  // Top wallets
  if (result.topWallets.length > 0) {
    lines.push('🔎 *关键钱包动向：*');
    for (const w of result.topWallets) {
      const action = w.action === 'BUY' ? '买入' : w.action === 'SELL' ? '卖出' : '交易';
      lines.push(`  ${w.addressShort} — ${action} $${(w.amountUsd / 1000).toFixed(0)}k ${w.outcome}`);
    }
    lines.push('');
  }

  // Warnings
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

  // Disclaimer
  lines.push('');
  lines.push(result.disclaimer);

  return lines.join('\n');
}

// ── Route Handler ──────────────────────────────────────

export async function POST(req: Request) {
  // Parse body
  let body: { query?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json', message: '无法解析请求。' }, { status: 400 });
  }

  const query = body?.query?.trim();
  if (!query) {
    return NextResponse.json(
      { error: 'empty_query', message: '请提供一个市场链接或关键词。例如：/analyze BTC 150k' },
      { status: 400 },
    );
  }

  // Rate limit
  const userId = body?.userId || 'anonymous';
  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: rateCheck.message, retryAfterSec: rateCheck.retryAfterSec },
      { status: 429 },
    );
  }

  // Extract market slug
  const marketSlug = extractMarketSlug(query);
  if (!marketSlug) {
    return NextResponse.json(
      { error: 'invalid_query', message: '无法识别该市场。请发送一个 Polymarket 市场链接或关键词。' },
      { status: 400 },
    );
  }

  // Analyze
  let analysis: Awaited<ReturnType<typeof analyzeMarket>>;
  try {
    analysis = await analyzeMarket(marketSlug);
  } catch {
    return NextResponse.json(
      { error: 'analysis_failed', message: '⚠️ 分析暂时不可用，请稍后再试（通常 < 5 分钟恢复）。' },
      { status: 500 },
    );
  }

  // No data case
  if (analysis.whaleTradeCount === 0) {
    return NextResponse.json({
      marketSlug: analysis.marketSlug,
      direction: 'neutral' as const,
      confidenceLevel: 'low' as const,
      confidenceScore: 0,
      whaleTradeCount: 0,
      message: getEmptyMessage(marketSlug),
      disclaimer: analysis.disclaimer,
    });
  }

  // Format response
  const plainText = formatAnalysisPlainText(analysis);

  return NextResponse.json({
    ...analysis,
    formattedText: plainText,
  });
}

/**
 * Phase 2: Web page GET handler.
 * Returns analysis as JSON for the /analyze web UI.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();
  if (!query) {
    return NextResponse.json({ error: 'missing_q', message: '?q=<market slug or URL>' }, { status: 400 });
  }

  const marketSlug = extractMarketSlug(query);
  if (!marketSlug) {
    return NextResponse.json(
      { error: 'invalid_query', message: '无法识别该市场链接。' },
      { status: 400 },
    );
  }

  try {
    const analysis = await analyzeMarket(marketSlug);
    return NextResponse.json(analysis);
  } catch {
    return NextResponse.json(
      { error: 'analysis_failed', message: '⚠️ 分析暂时不可用，请稍后再试。' },
      { status: 500 },
    );
  }
}
