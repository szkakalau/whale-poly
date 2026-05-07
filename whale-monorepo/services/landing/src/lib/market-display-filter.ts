/**
 * Filters Polymarket UI/category artifacts that should not appear as signal titles.
 * Health vertical section headers sometimes leak as bare titles ("Health", "Health Market").
 */
export function shouldExcludeMarketFromPublicFeeds(marketTitle: string): boolean {
  const raw = marketTitle.trim();
  if (!raw) return false;
  const compact = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (compact === 'health market' || compact === 'health') return true;
  // Breadcrumb-style: "Health · …", "Health | …", "Health: …"
  return /^health\s*(\||·|>|\u00b7|:|\u2013|\u2014)\s*/i.test(raw);
}
