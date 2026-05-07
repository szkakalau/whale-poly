import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  loadPublicHistorySignals,
  summarizeHistoryRows,
  MAX_GAMMA_CONDITION_LOOKUPS,
} from '@/lib/history-signals';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Historical Signals — SightWhale',
  description:
    'Verified historical whale alerts through end of yesterday UTC. Today’s live feed is available to Pro and Elite members.',
  alternates: {
    canonical: '/history',
  },
};

function formatPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function formatPrice(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(3);
}

function yesterdayUtcIsoDate(): string {
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return y.toISOString().slice(0, 10);
}

export default async function HistoryPage() {
  const rows = await loadPublicHistorySignals();
  const { total, winRate, avgRoi } = summarizeHistoryRows(rows);
  const cutoffLabel = yesterdayUtcIsoDate();

  return (
    <div className="min-h-screen text-foreground selection:bg-violet-500/25 overflow-hidden pb-28">
      <div className="fixed inset-0 z-[-1] bg-background" />
      <Header />

      <main className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-14 sm:pt-20 pb-12">
        <header className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-4">
            SightWhale 历史信号表现
          </h1>
          <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
            数据截止至：{cutoffLabel} 23:59 UTC | 今日实时信号仅对付费用户开放
          </p>
          <p className="mt-4 text-sm text-muted max-w-3xl">
            所有信号100%真实，从未删除过任何亏损信号
          </p>
        </header>

        <div className="overflow-x-auto rounded-2xl border border-border bg-surface/80">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-surface/90 text-[11px] font-black uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-4 py-3">发布时间</th>
                <th className="px-4 py-3">市场名称</th>
                <th className="px-4 py-3 text-right">Whale Score</th>
                <th className="px-4 py-3 text-right">发布价格</th>
                <th className="px-4 py-3 text-right">结束价格</th>
                <th className="px-4 py-3 text-right">实际 ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted">
                    暂无历史信号数据，或数据库尚未同步 alerts 表。
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const roi = row.roiPct;
                  const roiClass =
                    roi == null ? 'text-muted' : roi > 0 ? 'text-emerald-400 font-semibold' : roi < 0 ? 'text-red-400 font-semibold' : 'text-muted';
                  return (
                    <tr key={row.id} className="hover:bg-surface-hover/60">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-subtle">
                        {new Date(row.publishedAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
                      </td>
                      <td className="max-w-[280px] px-4 py-3 text-foreground">{row.marketTitle}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.whaleScore != null ? row.whaleScore.toFixed(0) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPrice(row.publishPrice)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{formatPrice(row.endPrice)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${roiClass}`}>{formatPct(roi)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <section className="mt-8 rounded-2xl border border-border-muted bg-surface/50 p-6">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-subtle mb-4">汇总</h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] text-muted">总信号数</dt>
              <dd className="text-2xl font-black tabular-nums">{total}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">胜率</dt>
              <dd className="text-2xl font-black tabular-nums">
                {winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">平均 ROI</dt>
              <dd className="text-2xl font-black tabular-nums">
                {avgRoi != null ? formatPct(avgRoi) : '—'}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[11px] text-subtle leading-relaxed">
            <strong className="text-foreground/90">ROI 计算说明：</strong>
            优先使用 pipeline 写入的 <code className="text-[10px]">whale_trade_history</code> 单笔已实现盈亏 ÷
            成交额（仅在该笔有非零 realized PnL 时显示）。
            否则，若市场在本库中已标记为非交易中且能映射到 Gamma{' '}
            <code className="text-[10px]">condition_id</code>，则对{' '}
            <strong>BUY</strong> 仓位按二元结算价（胜出 outcome=1、落败=0）估算「持有至结算」收益率
            (1−买入价)/买入价 或 −100%。SELL / 无法匹配 outcome 名称时显示「—」。每页最多拉取{' '}
            {MAX_GAMMA_CONDITION_LOOKUPS} 个条件的 Gamma 数据并缓存。
          </p>
        </section>
      </main>

      <Footer />

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="hidden text-sm text-muted sm:block">获取今日实时推送与完整盘面信号</p>
          <Link
            href="/pricing"
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-center text-sm font-black text-white transition-colors hover:bg-violet-500 sm:ml-auto"
          >
            获取今日实时信号 →
          </Link>
        </div>
      </div>
    </div>
  );
}
