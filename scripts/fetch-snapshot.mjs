// fetch-snapshot.mjs — fetch a fresh DefiLlama protocol universe and seal it in the
// exact shape the entry's program reads (the kit's input/README.md format).
//
// Usage:
//   node scripts/fetch-snapshot.mjs [YYYY-MM-DD] [out-dir]
// Defaults: today's UTC date, snapshots/<date>/.
//
// The output is a sealed snapshot, not a live feed: the program reads the file and
// never touches the network, so a run stays reproducible. The file carries:
//   as_of, source (endpoint + fetch time), floor_usd ($5,000,000), protocols (the ten
//   fields, sorted by slug, TVL >= $5,000,000) and watchlist (the house rule: TVL >=
//   $50,000,000, no token recorded, no version marker, no parent protocol, not a
//   wrapped / staked / bridged product, not an exchange product).
//
// Nothing here signs, spends, or calls a contract: one public GET, no key.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ENDPOINT = 'https://api.llama.fi/protocols';
const FLOOR_TVL = 5_000_000;
const WATCHLIST_FLOOR = 50_000_000;

const dateArg = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const outDir = process.argv[3] ?? join('snapshots', dateArg);
const rawPath = join(outDir, 'llama-raw.json');

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** Whole dollars, truncated toward zero, never rounded up. */
function whole(n) {
  return Math.trunc(n);
}

/** A unix timestamp (seconds) as a UTC YYYY-MM-DD day, or null when absent. */
function dayOf(ts) {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

/** A protocol records no token when its market cap, CoinGecko id and symbol are all null. */
function recordsNoToken(p) {
  const symbol = p.symbol === '-' ? null : p.symbol ?? null;
  return (p.mcap ?? null) === null && (p.gecko_id ?? null) === null && symbol === null;
}

/** The house watchlist rule, applied to the raw DefiLlama record (parentProtocol included). */
function onWatchlist(p) {
  if (p.tvl < WATCHLIST_FLOOR) return false;
  if (!recordsNoToken(p)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (p.parentProtocol) return false;
  if (EXCLUDED_CATEGORIES.has(p.category ?? '')) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

const fetchedAt = new Date().toISOString();
const res = await fetch(ENDPOINT, { headers: { accept: 'application/json' } });
if (!res.ok) {
  process.stderr.write(`fetch-snapshot: ${ENDPOINT} answered HTTP ${res.status}: stop, do not guess\n`);
  process.exit(1);
}
const raw = await res.json();
if (!Array.isArray(raw)) {
  process.stderr.write('fetch-snapshot: unexpected payload: expected a JSON array of protocols\n');
  process.exit(1);
}

const protocols = raw
  .filter((p) => typeof p.slug === 'string' && typeof p.name === 'string' && typeof p.tvl === 'number' && p.tvl >= FLOOR_TVL)
  .map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category ?? null,
    chains: Array.isArray(p.chains) ? [...p.chains] : [],
    tvl_usd: whole(p.tvl),
    change_7d: typeof p.change_7d === 'number' ? Math.round(p.change_7d * 1e4) / 1e4 : null,
    mcap_usd: typeof p.mcap === 'number' ? whole(p.mcap) : null,
    listed_at: dayOf(p.listedAt),
    gecko_id: p.gecko_id ?? null,
    symbol: p.symbol === '-' ? null : p.symbol ?? null,
  }))
  .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

const watchlist = protocols.filter((p) => onWatchlist(raw.find((r) => r.slug === p.slug))).map((p) => p.slug);

const snapshot = {
  as_of: dateArg,
  source: `DefiLlama ${ENDPOINT}, fetched ${fetchedAt}`,
  // floor_usd is the WATCHLIST floor ($50M), not the $5M inclusion floor: the entry
  // ranks every watchlist slug plus every other candidate below this floor.
  floor_usd: WATCHLIST_FLOOR,
  protocols,
  watchlist,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(rawPath, `${JSON.stringify(raw)}\n`);

const live = protocols.filter((p) => (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0).length;
const preToken = protocols.filter((p) => p.mcap_usd === null && p.gecko_id === null && p.symbol === null).length;
process.stdout.write(
  `fetch-snapshot: ${raw.length} raw protocols -> ${protocols.length} at/above $5M TVL, ${watchlist.length} on the watchlist, ${live} live-token, ${preToken} record no token\n` +
    `fetch-snapshot: sealed ${join(outDir, 'snapshot.json')} (as_of ${dateArg}, fetched ${fetchedAt})\n`,
);
