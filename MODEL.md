# Token Radar — methodology (model radar-3)

## The question

If a protocol issued a token tomorrow and its record stayed as it is, what would the token be
worth? The board is this entry's answer. It is a claim, never a prediction that a token is coming,
and never make.fun's.

## The data

One sealed snapshot, fetched once from DefiLlama's public API (`https://api.llama.fi/protocols`,
14 Nov 2026): **758 protocols** at or above $5,000,000 TVL. Each carries ten fields: slug, name,
category, chains, TVL, 7-day TVL change, market cap, listed date, CoinGecko id, symbol. The
snapshot carries no ranking, no implied value, no farm plan and no airdrop flag — deriving them is
the entry's work. The program reads the snapshot only; it has no network.

## Who is ranked

A protocol is a launch candidate when it **records no token** (market cap, CoinGecko id and symbol
all null) and is not a wrapped, staked or bridged product of a token that already trades:

- category not Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC or CEX;
- name carries no whole word `wrapped`, `staked` or `staking`;
- name does not begin with an exchange's name (Binance, Coinbase, Bybit, Kraken, Bitget, OKX,
  Bitfinex, Gemini);
- name does not end in a version marker (`V2`, `v2`, `2.0`, …).

That is the same exclusion the house used to draw the watchlist, applied to the whole board — so
WBTC, a bridge, or a staked-ETH receipt can never top it. The board covers **all 40 watchlist
slugs** plus every other candidate below the $50,000,000 floor: **178 rows**. Twenty protocols
above the floor that pass the visible rule but are not on the watchlist (the house's
`parentProtocol` record, not in the snapshot) are left out, as the house left them out.

## The model

```
implied  =  TVL × category multiple × growth × maturity × chains
category multiple  =  median(market cap / TVL) of live tokens in the same category
                     (≥ 3 comps; else the global median x0.2138)
growth             =  1 + clamp(7d change, −60%, +120%) / 100 × 0.5
maturity           =  0.6 + min(age, 1095d) / 1095 × 0.4   (age unknown: 365d)
chains             =  1 + 0.03 × min(chains − 1, 5)
```

The multiple is the model's whole point. A flat multiple would price a lending protocol like a
DEX; the market does not. The calibration is computed from the snapshot's own live-token
protocols — 128 with a positive market cap and TVL — and the dashboard's Model tab shows the full
table with the comps behind each number.

## Calibration (14 Nov 2026 snapshot)

| Category | Live comps | Median mcap / TVL |
|---|---:|---:|
| Cross Chain Bridge | 4 | x1.220 |
| Privacy | 3 | x0.969 |
| Canonical Bridge | 8 | x0.746 |
| Basis Trading | 7 | x0.654 |
| Bridge | 6 | x0.557 |
| Dexs | 11 | x0.342 |
| RWA | 9 | x0.275 |
| Yield | 9 | x0.191 |
| CDP | 3 | x0.169 |
| Yield Aggregator | 4 | x0.151 |
| Indexes | 3 | x0.148 |
| Lending | 15 | x0.132 |
| CEX | 9 | x0.075 |
| Liquid Staking | 9 | x0.041 |
| **Global (fallback)** | **128** | **x0.2138** |

One live protocol records a negative market cap in the snapshot; it is excluded from the
calibration (a negative market cap is a data error, not a comparable). Categories with fewer than
3 live comps use the global median.

## The result

| Rank | Protocol | TVL | Category | Implied value |
|---:|---|---:|---|---:|
| 1 | Steakhouse Financial | $2,754M | Risk Curators | $535M |
| 2 | Gauntlet | $1,578M | Risk Curators | $318M |
| 3 | Veda | $1,563M | Onchain Capital Allocator | $306M |
| 4 | USDD | $1,056M | CDP | $153M |
| 5 | Upshift | $499M | Onchain Capital Allocator | $110M |

Total implied value across the 178 rows: ~$2.9B. All 178 implied values are distinct; ranks are
1..178 with no ties in the ordering. The watchlist holds $2,443M of that total (84%, median
implied $29.7M a row); the early radar below the floor holds $461M across 138 rows (median
$2.6M) — the floor earns its keep, and the early radar still finds rows worth farming, topped by
Aegis YUSD. The most efficient row is Tori Finance at x0.437 of implied value per $1 of TVL —
a Basis Trading multiple doing the work, not size.

## The farm plan

Each row carries seven steps derived from the protocol's own record — never from a hand-written list
of names:

1. Fresh wallet, seed offline (under $3 gas, 5 min).
2. Verify before any money moves: open the protocol's official site and docs from DefiLlama's own
   links, check it has a points or rewards page. No airdrop is ever guaranteed, never pay anyone to
   claim one, never share a seed phrase.
3. The category's action with capital scaled to TVL ($50–$250).
4. A weekly qualifying action, by category (borrow-and-repay for Lending, a weekly swap for
   Dexes, a small hedged trade for Perpetuals, …).
5. Hold 30–60 days by age, so the activity spans more than one snapshot.
6. Claim only from the protocol's own published link; never pay to claim.
7. Keep a farm log: wallet, dates, every transaction.

The page shows the plan board.json wrote — one source of truth, never a second derivation in the
page that could drift from the board. The detail view adds the row's risk flags (young, single
chain, growth spike, thin comps) with the reason behind each, and the Movers & risks tab lists the
week's fastest growers and fallers, the implied value by category, and how often each flag fires.

## Fresh-data verification (19 Nov 2026)

The graded board is scored from the sealed 14 Nov snapshot above — the kit's input never moves,
and the program reads whatever snapshot it is given. To prove the model does not depend on that
one file staying still, the entry was re-run on 19 Nov 2026 against a fresh DefiLlama fetch
(`scripts/fetch-snapshot.mjs`, same format, sealed to `snapshots/2026-11-19/snapshot.json`):

- **736 protocols** at or above $5M TVL (was 758), **35 on the watchlist** (was 40 — five left it
  in five days), 121 live-token comps (was 128), 336 record no token.
- **176 rows** (35 watchlist + 141 early), total implied value ~$2.67B (was ~$2.9B).
- Top five, same names in a slightly different order: Steakhouse Financial $476M, Veda $264M,
  Gauntlet $241M, USDD $149M, Upshift $110M.
- Fresh calibration, global median **x0.1988** (was x0.2138):

| Category | Live comps | Median mcap / TVL |
|---|---:|---:|
| Cross Chain Bridge | 4 | x1.3226 |
| Privacy | 3 | x0.9474 |
| Basis Trading | 7 | x0.6102 |
| Bridge | 6 | x0.5555 |
| Canonical Bridge | 7 | x0.3991 |
| RWA | 8 | x0.3905 |
| Dexs | 11 | x0.3255 |
| Yield | 7 | x0.1839 |
| CDP | 3 | x0.1771 |
| Indexes | 3 | x0.1570 |
| Lending | 14 | x0.1528 |
| Yield Aggregator | 4 | x0.1483 |
| CEX | 9 | x0.0679 |
| Liquid Staking | 9 | x0.0496 |

One protocol in the fresh fetch records a negative market cap (`autofinance`); it is excluded from
the calibration by the same rule as the sealed snapshot's. One catch during this verification: the
first fetch script wrote `floor_usd` as the $5M inclusion floor instead of the $50M watchlist
floor, which scored only the 35 watchlist rows — fixed in `scripts/fetch-snapshot.mjs` (the sealed
snapshot's own `floor_usd` is $50,000,000) and the run repeated to 176 rows.

## Validation (radar-3)

The multiples are medians of a noisy market, so radar-3 measures how wrong they are instead of
asserting they are right. The test is held-out, repeated, and on the snapshot's own live-token
comps (128 live tokens with a market cap and TVL, from the sealed 14 Nov snapshot):

- **4-fold × 4 seeds** (seeds 1–4), stratified folds: hide a quarter of the comps, fit the
  category medians on the remaining three quarters (leave-out by category — the tokens being
  predicted never enter the multiple that predicts them), predict the hidden ones.
  **512 held-out predictions.** The same test is repeated as a 50/50 split × 4 seeds (256
  predictions) as a cross-check.
- **Bootstrap**: 200 resamples of the 128 comps; the global median multiple x0.2138 sits between
  x0.1688 and x0.3167 at 5–95%.
- **Conformal intervals (90%, multiplicative, log-scale)**: the 90th percentile of held-out
  |log error| per category gives the interval factor; a row's range is
  [implied ÷ factor, implied × factor]. Categories with fewer than 10 held-out errors use the
  global factor ×48.62. The interval never changes the rank.
- **Confidence**: high = 9+ live comps and a 90% factor ≤10 (only RWA qualifies); low = fewer
  than 3 live comps or a factor >50; medium = the rest. 15 rows are high, 53 medium, 110 low.

| Metric | 4-fold × 4 seeds | 50/50 split × 4 seeds |
|---|---:|---:|
| Mean MAPE | 2,738.38% | 2,515.67% |
| Median absolute error | 92.93% | 93.74% |
| Bias (mean signed error) | +2,666.61% | +2,445% |
| Median \|log error\| (typical miss) | 1.71 (×5.5) | 1.60 (×5.0) |
| Within a factor 2 of the market value | 20.70% | 22.27% |
| Within a factor 5 of the market value | 47.66% | 50.20% |
| Spearman rank correlation | 0.39 | 0.39 |

Per large category (9+ comps): Lending MAPE 358.78% (Spearman 0.48, 90% factor ×55.11), Dexs
542.03% (Spearman 0.09, ×18.18), CEX 244.77% (0.47, ×103.2), Liquid Staking 214.24% (0.64,
×37.35), RWA 152.83% (0.64, ×6.49), Yield 3,170.22% (0.32, ×35.77). Worst fold: seed 4, fold 0,
MAPE 8,817.33%, driven by Canonical Bridge at 170,186.32%. The full per-category table (34
categories) is in `validation_report.json` and on the dashboard's Validation tab.

**The targets the design set are NOT met, and the design was wrong about why.** The design set
MAPE <35% overall and no large category >60% before the error distribution was measured. The
measurement shows the mean is dominated by ~10 live tokens whose market cap is under 1% of their
TVL — xdai-stake-bridge records $223.4M of TVL against a $56K market cap, ratio 0.00025, so any
reasonable multiple misses it by hundreds of thousands of percent; one such token moves the mean
and barely moves the median. The prescribed remedy — replace every failing category multiple
with the global median — was tried and measured: it leaves MAPE at 1,120% (still 32× the
target) while erasing the category calibration that is the model's whole point. So no multiple
was replaced. The category medians ship as fitted, the targets stand as not met, and the
uncertainty is carried honestly by the intervals instead. What the model does show: the typical
miss is a factor of ×5.5, the ranking correlates with the market at Spearman 0.39, and the top
five survive every floor ($25M / $50M / $100M — 145 / 178 / 189 rows, same five names).

The validation runs inside `buildRadar` (lib/validation.ts, deterministic: fixed seeds, seeded
PRNG — re-running it on the same snapshot writes byte-identical numbers) and is embedded in
`data.js`; the human-readable copy is `validation_report.json` at the repo root
(`node scripts/validate.mjs`). No GPU is involved: one fit is four arithmetic ops per protocol,
and the breadth (512 predictions, 200 bootstrap resamples, three floor sweeps) is milliseconds of
CPU. The dashboard carries the result as a KPI strip (median held-out error, not the mean MAPE),
an integrity strip (snapshot provenance, live top-5 re-derivation, fresh-data check, no network,
dossier cap), the 90% range + confidence on every board row and detail view, and a Validation
tab with the full tables.

## Checks (run before every submit)

```sh
node scripts/verify-board.mjs out ~/workspace/makefun/token-radar-01-kit/input/snapshot.json
# verify-board: PASS — 178 rows, 3 dashboard files (54.2 KiB, text 54.2 KiB), 3 screenshots, dossier 651.5 KiB
```

The script checks the gate's own rows: board 100–4000 rows, ranks 1..n, implied values
non-increasing and distinct, every watchlist slug present, farm steps 3–12 of 20–600 characters;
dashboard ≤400 files and 4 MiB, no network reference, text under the 64 KiB dossier cap; 3–4
screenshots ≤512 KiB, long side ≤1440, short side ≥800; dossier ≤1.5 MiB; and it re-derives the
top five implied values in the page's own arithmetic. Radar-3 adds: every board row carries a
conformal interval that brackets its point estimate plus a valid confidence flag; `data.js`
carries the validation object (128 live comps, 512 held-out predictions, targets honestly
reported as not met, the note naming the outlier driver, 34 per-category rows, the same top
five at all three floor sweeps); `validation_report.json` at the repo root matches `data.js`;
`model_version` is radar-3; and the dashboard text contains the KPI strip, the integrity strip,
the 90% range column, the Validation tab, the confidence badges and the sticky table header.
It also runs against the fresh snapshot
(`node scripts/verify-board.mjs out-fresh snapshots/2026-11-19/snapshot.json`) — the
snapshot-relative checks there use the fresh snapshot's own 121 live comps (484 held-out
predictions) instead of the sealed snapshot's numbers.

- `board.json`: 178 rows, ranks exactly 1..178, implied values non-increasing, all distinct,
  every watchlist slug present, every row's farm steps 3–12 strings of 20–600 characters.
- The dashboard recomputes each row's implied value in the page from the same inputs and shows
  whether it matches `board.json`.
- The dashboard renders with no network (no http(s) in attributes, styles, scripts or CSS) and
  its source is under the 64 KiB dossier text cap.
- Screenshots are real renders of the dashboard: the board (with the KPI + integrity strips and
  the 90% range column), a detail view (with its 90% range and confidence note), the Validation tab.
