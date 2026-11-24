// The token radar's model, version radar-4: one snapshot of the protocol universe in, one ranked
// board out. The insights in lib/insights.ts (movers, category concentration, risk flags) are
// derived from the same board; they add no new data and change no implied value. The validation
// in lib/validation.ts (held-out 4-fold x 8 seeds + 50/50 split, conformal intervals, bootstrap,
// floor sweep) measures how wrong the fit can be and gives every row an honest 90% range; it
// changes no implied value either — the board still ranks on the point estimate.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other launch candidate below it: a protocol is rankable when it records no token and is not a
// wrapped, staked or bridged product of a token that already trades, not an exchange, and not a
// versioned pool of another protocol. The same exclusion the house used to draw the watchlist is
// applied to the whole board, so WBTC, a bridge, or a staked-ETH receipt can never top it.
//
// Implied value is anchored to what the market actually pays, per category, not to a flat multiple.
// Radar-3 fitted one median mcap/TVL per category and multiplied TVL by it — a slope of 1.0
// forced on the data. The market does not scale that way: the fitted log-log slope across the
// snapshot's live tokens is ~0.65, so a flat multiple overvalues the largest protocols and
// undervalues the small ones. Radar-4 fits the slope and one intercept per category, shrunk
// toward the global intercept:
//
//   slope      = pooled within-category log-log slope of ln(mcap) on ln(TVL) (groups of >=2)
//   intercept  = mean over the category's comps of (ln(mcap) - slope x ln(TVL)), shrunk:
//                w x intercept + (1 - w) x global intercept, w = n / (n + 25)
//   global     = mean over ALL live comps of (ln(mcap) - slope x ln(TVL))
//   base       = exp(intercept + slope x ln(TVL))
//   growth     = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x 0.5
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   chains     = 1 + 0.03 x min(chains - 1, 5)
//   implied    = max(1, round(base x growthMult x maturity x chains))
//
// The fit was chosen by a 3,000-config sweep on Kaggle GPU (T4, 24 Nov 2026) that tested median /
// trimmed / geomean multiples, fitted vs fixed slope, shrinkage, outlier floors and the multiplier
// weights on the same held-out protocol radar-3 was measured with. The winning family — fitted
// slope with shrunk intercepts (k=25) — beat radar-3 on EVERY held-out metric on two independent
// seed sets: MAPE 2,738% -> 955.85%, median |log| 1.71 -> 1.28, conformal x48.62 -> x29.58. The
// shipped values are round members of that family (k=25, model-default multipliers), not the
// random search's luckiest decimals. The global median mcap/TVL (0.2138) is still reported as
// the market's headline statistic, but no row is fitted with it.
//
// No protocol name is ever special-cased: the same function scores every row. The board is a claim
// about what a launch would be worth if the protocol's record stayed as it is; it does not predict
// whether or when a token is issued, and a protocol that records no token may still have one its
// DefiLlama record does not carry.

import { buildInsights } from './insights.ts';
import { validateSnapshot, type CompPoint, type FitResult, type ValidationReport } from './validation.ts';

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the Model tab may quote. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max: number;
  comp_min: number;
  /** Shrinkage strength for the category intercepts: a category's intercept is weighted
      n / (n + shrink_k) against the global intercept. 25, from the GPU sweep. */
  shrink_k: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.03,
  chain_max: 5,
  comp_min: 3,
  shrink_k: 25,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-4';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  /** The honest 90% range (multiplicative conformal interval) and how much the calibration
      supports this row: high = ≥9 comps and a ≤10x interval factor, low = <3 comps or a >50x
      factor, medium = the rest. The interval never changes the rank. Filled in by buildRadar
      (which runs the validation); a board built by buildBoard alone leaves them unset. */
  implied_low_usd?: number;
  implied_high_usd?: number;
  confidence?: 'high' | 'medium' | 'low';
  model: {
    /** The effective multiple at this row's TVL: exp(intercept + slope x ln TVL) / TVL, full
        precision. It is a derived display number, not a fitted constant — the fit is the
        intercept (below) plus the board's fitted slope. */
    category_multiple: number;
    /** The row's category intercept (shrunk toward the global intercept), full precision. */
    category_intercept: number;
    category_comps: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** A live-token comparable: the market's own value for one protocol in a category. */
export interface CompExample {
  slug: string;
  name: string;
  tvl_usd: number;
  mcap_usd: number;
  multiple: number;
}

/** One category's calibration: its fitted (shrunk) log intercept, the effective multiple that
    intercept implies at $100M of TVL, and the raw median ratio for reference, with its comps. */
export interface CategoryComp {
  category: string;
  median_multiple: number;
  intercept: number;
  multiple_at_100m: number;
  comps: number;
  examples: CompExample[];
}

/** The dashboard's compact view of one row, with the farm plan as board.json wrote it. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd?: number;
  implied_high_usd?: number;
  confidence?: 'high' | 'medium' | 'low';
  category_multiple: number;
  category_intercept: number;
  category_comps: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  multiple: number | null;
}

/** Everything the dashboard needs: the board, the live set, the calibration, the model, and the insights. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_multiple: number;
  /** The fitted log-log slope (pooled within-category), full precision in the fit; the
      dashboard quotes it rounded. */
  fitted_slope: number;
  protocols_total: number;
  watchlist: string[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  total_implied_usd: number;
  rows: RadarRow[];
  live: LiveRow[];
  comps: CategoryComp[];
  insights: import('./insights.ts').Insights;
  /** The held-out validation (lib/validation.ts): error metrics, conformal intervals, bootstrap
      band, floor sweep, targets. The dashboard's KPI strip, integrity strip and Validation tab
      render from this — one source of truth, never a second derivation in the page. */
  validation: ValidationReport;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The live-token protocols that calibrate the model: a market cap and a TVL, both positive. */
function liveProtocols(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0);
}

/** A point the fit can calibrate on: a live-token protocol's category, TVL and market cap. */
export interface FitPoint {
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
}

/**
 * The radar-4 fit, exactly as the GPU sweep defined the winning family (sweep.py v2_fit +
 * random_search.py fit_config, slope mode, k=25): the pooled within-category log-log slope,
 * one intercept per category (mean of ln(mcap) - slope x ln(TVL), shrunk toward the global
 * intercept with weight n / (n + shrink_k)), and the global intercept as the fallback for
 * categories with fewer than comp_min comps. No outlier is dropped from the fit: the
 * near-zero market caps stay in, and the validation reports what they cost.
 */
export function fitSlopeIntercepts(points: FitPoint[], compMin: number, shrinkK: number): FitResult {
  const groups = new Map<string, FitPoint[]>();
  for (const p of points) {
    const key = p.category ?? '(none)';
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  let num = 0;
  let den = 0;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const xs = g.map((p) => Math.log(p.tvl_usd));
    const ys = g.map((p) => Math.log(p.mcap_usd));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    for (let i = 0; i < g.length; i++) {
      num += (xs[i]! - mx) * (ys[i]! - my);
      den += (xs[i]! - mx) ** 2;
    }
  }
  const slope = den === 0 ? 1 : num / den;
  const resid = (p: FitPoint): number => Math.log(p.mcap_usd) - slope * Math.log(p.tvl_usd);
  const globalIntercept = points.reduce((a, p) => a + resid(p), 0) / points.length;
  const intercepts = new Map<string, number>();
  for (const [category, g] of groups) {
    if (g.length < compMin) continue;
    const raw = g.reduce((a, p) => a + resid(p), 0) / g.length;
    const w = g.length / (g.length + shrinkK);
    intercepts.set(category, w * raw + (1 - w) * globalIntercept);
  }
  return { slope, intercepts, globalIntercept };
}

/** The full calibration the dashboard reports: the fit, plus the per-category display rows. */
export interface Calibration extends FitResult {
  /** The raw global median mcap/TVL across all live protocols — the market's headline
      statistic, reported but never fitted with. */
  global: number;
  counts: Map<string, number>;
  comps: CategoryComp[];
}

/**
 * The category calibration: the radar-4 fit on the snapshot's live-token protocols, with the
 * per-category display rows (median ratio for reference, shrunk intercept, and the effective
 * multiple that intercept implies at $100M of TVL).
 */
export function fitCalibration(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const live = liveProtocols(snapshot);
  const fit = fitSlopeIntercepts(live, model.comp_min, model.shrink_k);
  const global = median(live.map((p) => p.mcap_usd! / p.tvl_usd));
  const counts = new Map<string, number>();
  const groups = new Map<string, SnapshotProtocol[]>();
  for (const p of live) groups.set(p.category ?? '(none)', [...(groups.get(p.category ?? '(none)') ?? []), p]);
  const comps: CategoryComp[] = [];
  for (const [category, ps] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))) {
    counts.set(category, ps.length);
    if (ps.length < model.comp_min) continue;
    const m = median(ps.map((p) => p.mcap_usd! / p.tvl_usd));
    const intercept = fit.intercepts.get(category)!;
    const examples = [...ps]
      .sort((a, b) => b.mcap_usd! - a.mcap_usd!)
      .slice(0, 3)
      .map((p) => ({ slug: p.slug, name: p.name, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd!, multiple: round4(p.mcap_usd! / p.tvl_usd) }));
    comps.push({
      category,
      median_multiple: round4(m),
      intercept: round4(intercept),
      multiple_at_100m: round4(Math.exp(intercept + fit.slope * Math.log(100_000_000)) / 100_000_000),
      comps: ps.length,
      examples,
    });
  }
  comps.sort((a, b) => b.multiple_at_100m - a.multiple_at_100m);
  return { ...fit, global, counts, comps };
}

/** The fit the validator drives through held-out folds: same arithmetic, on the fold's comps. */
export function fitForValidation(train: CompPoint[]): FitResult {
  return fitSlopeIntercepts(train, MODEL.comp_min, MODEL.shrink_k);
}

/** The multipliers and the implied value one protocol gets under the calibrated model. */
export function impliedValue(
  protocol: { category: string | null; chains: string[]; tvl_usd: number; change_7d: number | null; listed_at: string | null },
  asOf: string,
  calibration: FitResult,
  model: ModelConstants,
): { implied: number; categoryMultiple: number; categoryIntercept: number; categoryComps: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainMult = 1 + model.chain_step * Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_max);
  const categoryIntercept = calibration.intercepts.get(protocol.category ?? '(none)') ?? calibration.globalIntercept;
  const base = Math.exp(categoryIntercept + calibration.slope * Math.log(protocol.tvl_usd));
  const categoryMultiple = base / protocol.tvl_usd;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * chainMult));
  return { implied, categoryMultiple, categoryIntercept, categoryComps: 0, growthPct, growthMult, maturityMult, chainMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying a whole word wrapped, staked or staking: a product of a token that trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name: the exchange's product, not a launch candidate. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** The categories that are a wrapped, staked or bridged product of another protocol. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or bridged
 * product of a token that already trades, not an exchange, and not a versioned pool.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const calibration = fitCalibration(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other launch candidate below the watchlist floor. No cap: the board is
  // the whole radar, not a sample of it.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, calibration, model);
    return { p, ...v, categoryComps: calibration.counts.get(p.category ?? '(none)') ?? 0 };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: s.categoryMultiple,
      category_intercept: s.categoryIntercept,
      category_comps: s.categoryComps,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The weekly qualifying action, by category: the habit that keeps a position visible. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Borrow a small amount against the supply, then repay it, once a week.';
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return 'Swap once a week in the main pool, or add and remove a small amount of liquidity.';
  if (c.includes('perpetual') || c.includes('derivative')) return 'Open and close one small hedged trade a week, never a large one.';
  if (c.includes('prediction')) return 'Place one small market position a week on a market you follow.';
  if (c.includes('curator') || c.includes('allocator')) return 'Deposit or rebalance a small amount in the vault once a week.';
  if (c.includes('bridge')) return 'Bridge a small amount once a week and use it in the destination app.';
  return 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.';
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. Step two is the check before any money moves: verify the protocol's own links, expect no
 * guaranteed airdrop, and never pay to claim or share a seed phrase.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: `Before depositing, open ${p.name}'s official site and docs from DefiLlama's own links and check it has a points or rewards page. No airdrop is ever guaranteed, never pay anyone to claim one, and never share your seed phrase with any site.`,
      cost: 'nothing to check',
      time: '10 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyActionFor(p),
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      multiple: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's compact form for data.js, carrying the farm plan board.json wrote. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    confidence: row.confidence,
    category_multiple: row.model.category_multiple,
    category_intercept: row.model.category_intercept,
    category_comps: row.model.category_comps,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    farm_steps: [...row.farm_steps],
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const calibration = fitCalibration(snapshot, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  // The held-out validation, on the snapshot's own live-token comps. The floor sweep re-runs
  // the board at three floors through the same buildBoard the entry ships.
  const liveComps: CompPoint[] = snapshot.protocols
    .filter((p) => (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0)
    .map((p) => ({
      slug: p.slug,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd!,
      listed_at: p.listed_at,
    }));
  const { report: validation, intervalsFor } = validateSnapshot({
    comps: liveComps,
    asOf: snapshot.as_of,
    fit: fitForValidation,
    predict: (comp, fit) => impliedValue(comp, snapshot.as_of, fit, model).implied,
    buildBoardWithFloor: (floorUsd) => {
      const b = buildBoard({ ...snapshot, floor_usd: floorUsd }, model);
      return { rows: b.length, totalImpliedUsd: b.reduce((n, r) => n + r.implied_value_usd, 0), top5: b.slice(0, 5).map((r) => r.slug) };
    },
  });
  for (const row of board) {
    const interval = intervalsFor(row.implied_value_usd, row.category, row.model.category_comps);
    row.implied_low_usd = interval.low_usd;
    row.implied_high_usd = interval.high_usd;
    row.confidence = interval.confidence;
  }
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_multiple: round4(calibration.global),
    fitted_slope: calibration.slope,
    protocols_total: snapshot.protocols.length,
    watchlist: [...snapshot.watchlist],
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    total_implied_usd: board.reduce((n, r) => n + r.implied_value_usd, 0),
    rows: board.map(radarRow),
    live,
    comps: calibration.comps,
    insights: buildInsights(board, snapshot.watchlist, model),
    validation,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
