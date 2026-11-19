// Insights the board alone does not show: which rows are moving, where the board's
// value concentrates by category, and which rows carry a flag a farmer should see
// before putting money in. Everything here is derived from the snapshot's own figures
// and the board the model already scored — no new data, no hand-kept list of names,
// and no claim that a token is coming.
//
// A flag is a reason to look twice, never a verdict: a young protocol can still be
// worth farming, and a growth spike can be real usage or one big deposit. The
// dashboard shows the flag next to the row and the reason behind it.

import type { BoardRow, ModelConstants } from './model.ts';

/** One flag on one row: a short code, a label for the board, and the reason. */
export interface RiskFlag {
  code: 'young' | 'brand-new' | 'single-chain' | 'growth-spike' | 'shrinking' | 'thin-comps';
  label: string;
  note: string;
}

/** A row's flags, keyed by slug so the dashboard can look them up without a scan. */
export interface RowRisk {
  slug: string;
  flags: RiskFlag[];
}

/** One mover: a board row and the 7-day TVL change that moved it. */
export interface MoverRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  change_7d: number;
  implied_value_usd: number;
  /** Implied value per $1 of TVL: the row's capital efficiency under the model. */
  efficiency: number;
}

/** One category's share of the board: rows, implied value, and its top row. */
export interface CategoryStat {
  category: string;
  rows: number;
  total_implied_usd: number;
  share_pct: number;
  top_name: string;
  top_implied_usd: number;
}

/** One half of the board: the watchlist (the floor) against the early radar below it. */
export interface SplitStat {
  label: string;
  rows: number;
  total_implied_usd: number;
  share_pct: number;
  median_implied_usd: number;
  median_tvl_usd: number;
  top_name: string;
  top_implied_usd: number;
}

/** Everything the Movers & risks tab needs, computed once per run. */
export interface Insights {
  gainers: MoverRow[];
  decliners: MoverRow[];
  /** Most efficient rows: highest implied value per $1 of TVL, among rows at or above
      the $50M floor, so a tiny TVL with a rich multiple cannot top the list on noise. */
  efficient: MoverRow[];
  /** The watchlist against the early radar: does the floor earn its keep? */
  split: { watchlist: SplitStat; early: SplitStat };
  categories: CategoryStat[];
  risks: RowRisk[];
  risk_counts: { code: string; label: string; count: number }[];
  flagged_rows: number;
}

const MOVERS_SHOWN = 5;
const YOUNG_DAYS = 90;
const NEW_DAYS = 30;
const SPIKE_PCT = 100;
const SHRINK_PCT = -30;

/** The flags for one scored row, from its own record and the model's calibration. */
export function riskFlagsFor(row: BoardRow, model: ModelConstants): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const age = row.age_days;
  if (age !== null && age < NEW_DAYS) {
    flags.push({
      code: 'brand-new',
      label: 'Brand-new',
      note: `Listed ${age} days ago: barely a track record, so the maturity factor is near its floor.`,
    });
  } else if (age !== null && age < YOUNG_DAYS) {
    flags.push({
      code: 'young',
      label: 'Young',
      note: `Listed ${age} days ago: less than a quarter of history behind the TVL.`,
    });
  }
  if (row.chains.length <= 1) {
    flags.push({
      code: 'single-chain',
      label: '1 chain',
      note: 'All of its TVL sits on one chain: one outage or one bridge problem moves everything.',
    });
  }
  const change = row.change_7d;
  if (change !== null && change > SPIKE_PCT) {
    flags.push({
      code: 'growth-spike',
      label: 'Growth spike',
      note: `TVL up ${change.toFixed(1)}% in 7 days — the model clamps growth at +${model.growth_cap}%, so check whether the inflow is real usage or one big deposit before farming.`,
    });
  } else if (change !== null && change < SHRINK_PCT) {
    flags.push({
      code: 'shrinking',
      label: 'Shrinking',
      note: `TVL down ${Math.abs(change).toFixed(1)}% in 7 days: the board still ranks it on size, but the trend points the other way.`,
    });
  }
  if (row.model.category_comps < model.comp_min) {
    flags.push({
      code: 'thin-comps',
      label: 'Thin comps',
      note: `Only ${row.model.category_comps} live token(s) in this category, so the multiple falls back to the global median ${row.model.category_multiple.toFixed(4)} instead of a category median.`,
    });
  }
  return flags;
}

function moverOf(row: BoardRow): MoverRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d ?? 0,
    implied_value_usd: row.implied_value_usd,
    efficiency: row.tvl_usd > 0 ? row.implied_value_usd / row.tvl_usd : 0,
  };
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function splitOf(label: string, rows: BoardRow[], totalImplied: number): SplitStat {
  const total = rows.reduce((sum, r) => sum + r.implied_value_usd, 0);
  const top = [...rows].sort((a, b) => b.implied_value_usd - a.implied_value_usd)[0];
  return {
    label,
    rows: rows.length,
    total_implied_usd: total,
    share_pct: totalImplied > 0 ? Math.round((total / totalImplied) * 1000) / 10 : 0,
    median_implied_usd: rows.length > 0 ? Math.round(median(rows.map((r) => r.implied_value_usd))) : 0,
    median_tvl_usd: rows.length > 0 ? Math.round(median(rows.map((r) => r.tvl_usd))) : 0,
    top_name: top !== undefined ? top.name : '—',
    top_implied_usd: top !== undefined ? top.implied_value_usd : 0,
  };
}

/** The movers, the most efficient rows, the watchlist split, the category concentration, and every row's flags. */
export function buildInsights(board: BoardRow[], watchlist: string[], model: ModelConstants): Insights {
  const withChange = board.filter((r) => r.change_7d !== null);
  const gainers = [...withChange]
    .sort((a, b) => (b.change_7d ?? 0) - (a.change_7d ?? 0))
    .slice(0, MOVERS_SHOWN)
    .map(moverOf);
  const decliners = [...withChange]
    .sort((a, b) => (a.change_7d ?? 0) - (b.change_7d ?? 0))
    .slice(0, MOVERS_SHOWN)
    .map(moverOf);
  const efficient = [...board]
    .filter((r) => r.tvl_usd >= 50_000_000)
    .sort((a, b) => moverOf(b).efficiency - moverOf(a).efficiency || b.implied_value_usd - a.implied_value_usd)
    .slice(0, MOVERS_SHOWN)
    .map(moverOf);

  const totalImplied = board.reduce((sum, r) => sum + r.implied_value_usd, 0);
  const wlSlugs = new Set(watchlist);
  const split = {
    watchlist: splitOf('Watchlist (at or above the $50M floor)', board.filter((r) => wlSlugs.has(r.slug)), totalImplied),
    early: splitOf('Early radar (below the floor)', board.filter((r) => !wlSlugs.has(r.slug)), totalImplied),
  };

  const byCategory = new Map<string, BoardRow[]>();
  for (const row of board) {
    const key = row.category ?? '(none)';
    byCategory.set(key, [...(byCategory.get(key) ?? []), row]);
  }
  const categories: CategoryStat[] = [...byCategory.entries()]
    .map(([category, rows]) => {
      const total = rows.reduce((sum, r) => sum + r.implied_value_usd, 0);
      const top = [...rows].sort((a, b) => b.implied_value_usd - a.implied_value_usd)[0]!;
      return {
        category,
        rows: rows.length,
        total_implied_usd: total,
        share_pct: totalImplied > 0 ? Math.round((total / totalImplied) * 1000) / 10 : 0,
        top_name: top.name,
        top_implied_usd: top.implied_value_usd,
      };
    })
    .sort((a, b) => b.total_implied_usd - a.total_implied_usd);

  const risks: RowRisk[] = [];
  const counts = new Map<string, { label: string; count: number }>();
  for (const row of board) {
    const flags = riskFlagsFor(row, model);
    if (flags.length === 0) continue;
    risks.push({ slug: row.slug, flags });
    for (const flag of flags) {
      const entry = counts.get(flag.code) ?? { label: flag.label, count: 0 };
      entry.count += 1;
      counts.set(flag.code, entry);
    }
  }
  const risk_counts = [...counts.entries()]
    .map(([code, entry]) => ({ code, label: entry.label, count: entry.count }))
    .sort((a, b) => b.count - a.count);

  return { gainers, decliners, efficient, split, categories, risks, risk_counts, flagged_rows: risks.length };
}
