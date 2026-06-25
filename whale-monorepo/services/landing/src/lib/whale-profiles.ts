import { prisma } from '@/lib/prisma';

export type StarWhale = {
  walletAddress: string;
  walletMasked: string;
  totalVolume: number;
  totalPnl: number;
  roi: number;
  winRate: number;
  whaleScore: number;
  totalTrades: number;
};

function maskWallet(addr: string): string {
  const v = addr.trim();
  if (v.length <= 10) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

export async function getStarWhale(): Promise<StarWhale | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      { wallet_address: string; total_volume: number; total_pnl: number;
        roi: number; win_rate: number; whale_score: number; total_trades: number }[]
    >(
      `SELECT p.wallet_address,
              COALESCE(p.total_volume::float, 0) AS total_volume,
              COALESCE(p.realized_pnl::float, 0) AS total_pnl,
              COALESCE(s.roi::float, 0) AS roi,
              COALESCE(s.win_rate::float, 0) AS win_rate,
              COALESCE(s.whale_score::float, 0) AS whale_score,
              COALESCE(p.total_trades, 0)::int AS total_trades
       FROM whale_profiles p
       INNER JOIN whale_stats s ON s.wallet_address = p.wallet_address
       WHERE p.realized_pnl > 0
       ORDER BY p.realized_pnl DESC NULLS LAST
       LIMIT 1`
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      walletAddress: r.wallet_address,
      walletMasked: maskWallet(r.wallet_address),
      totalVolume: Number(r.total_volume) || 0,
      totalPnl: Number(r.total_pnl) || 0,
      roi: Number(r.roi) || 0,
      winRate: Number(r.win_rate) || 0,
      whaleScore: Number(r.whale_score) || 0,
      totalTrades: Number(r.total_trades) || 0,
    };
  } catch {
    return null;
  }
}
