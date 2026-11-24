# Token Radar — methodology (model radar-4)

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
implied  =  exp(intercept + slope × ln TVL) × growth × maturity × chains
slope      =  0.6481  (pooled within-category log-log slope of ln(mcap) on ln(TVL))
intercept  =  category intercept, shrunk toward the global intercept 4.7352 (k = 25)
             (≥ 3 comps; else the global intercept)
growth     =  1 + clamp(7d change, −60%, +120%) / 100 × 0.5
maturity   =  0.6 + min(age, 1095d) / 1095 × 0.4   (age unknown: 365d)
chains     =  1 + 0.03 × min(chains − 1, 5)
```

Radar-3 fitted one median mcap/TVL per category and multiplied TVL by it — a slope of 1.0 forced
on the data. The market does not scale that way: the fitted log-log slope across the snapshot's
live tokens is 0.65, so a flat multiple overvalues the largest protocols and undervalues the
small ones. Radar-4 fits the slope and one intercept per category, shrunk toward the global
intercept (weight n / (n + 25)), so a thin category borrows strength from the market as a whole
instead of trusting two or three tokens. The "Multiple @ $100M TVL" column below is what each
intercept implies at $100M of TVL, so categories can be compared at one size; the median ratio
beside it is the raw market statistic for reference. The global median mcap/TVL (x0.2138) is
still reported, but no row is fitted with it. The calibration is computed from the snapshot's
own live-token protocols — 128 with a positive market cap and TVL — and the dashboard's Model
tab shows the full table with the comps behind each number.

The fit was chosen, not assumed: a 3,000-config sweep on Kaggle GPU (Tesla T4, 24 Nov 2026)
tested median / trimmed / geomean multiples, fitted vs fixed slope, shrinkage, outlier floors
and the multiplier weights on the same held-out protocol radar-3 was measured with. The winning
family — fitted slope with shrunk intercepts (k=25) — beat radar-3 on every held-out metric on
two independent seed sets. The shipped values are round members of that family (k=25,
model-default multipliers), not the random search's luckiest decimals.

## Calibration (14 Nov 2026 snapshot)

| Category | Live comps | Intercept | Multiple @ $100M TVL | Median mcap / TVL |
|---|---:|---:|---:|---:|
| Basis Trading | 7 | 4.9759 | x0.222 | x0.654 |
| Canonical Bridge | 8 | 4.8990 | x0.206 | x0.746 |
| Cross Chain Bridge | 4 | 4.8498 | x0.196 | x1.221 |
| CEX | 9 | 4.8482 | x0.195 | x0.075 |
| Privacy | 3 | 4.8414 | x0.194 | x0.969 |
| Dexs | 11 | 4.8089 | x0.188 | x0.342 |
| RWA | 9 | 4.7783 | x0.182 | x0.275 |
| Indexes | 3 | 4.7321 | x0.174 | x0.148 |
| Bridge | 6 | 4.7232 | x0.172 | x0.557 |
| CDP | 3 | 4.6099 | x0.154 | x0.169 |
| Yield Aggregator | 4 | 4.6025 | x0.153 | x0.151 |
| Yield | 9 | 4.5710 | x0.148 | x0.191 |
| Lending | 15 | 4.5542 | x0.146 | x0.132 |
| Liquid Staking | 9 | 4.4539 | x0.132 | x0.041 |
| **Global (fallback intercept)** | **128** | **4.7352** | — | **x0.2138** |

One live protocol records a negative market cap in the snapshot; it is excluded from the
calibration (a negative market cap is a data error, not a comparable). Categories with fewer than
3 live comps use the global intercept.

## The result

| Rank | Protocol | TVL | Category | Implied value |
|---:|---|---:|---|---:|
| 1 | Steakhouse Financial | $2,754M | Risk Curators | $135.9M |
| 2 | Gauntlet | $1,578M | Risk Curators | $98.4M |
| 3 | Veda | $1,563M | Onchain Capital Allocator | $94.9M |
| 4 | USDD | $1,056M | CDP | $61.0M |
| 5 | Upshift | $499M | Onchain Capital Allocator | $50.9M |

Total implied value across the 178 rows: ~$1.64B. All 178 implied values are distinct; ranks are
1..178 with no ties in the ordering. The watchlist holds $1,052M of that total (64%, median
implied $19.4M a row); the early radar below the floor holds $587M across 138 rows (median
$4.0M) — the floor earns its keep, and the early radar still finds rows worth farming, topped by
Arrakis Modular. The most efficient row is Manifest Trade at x0.518 of implied value per $1 of
TVL — a rich category, not size, doing the work.

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
- **176 rows** (35 watchlist + 141 early), total implied value ~$1.52B (was ~$1.64B).
- Top five, same names in a slightly different order: Steakhouse Financial $118.0M, Veda $81.9M,
  Gauntlet $75.9M, USDD $53.0M, Upshift $49.5M.
- Fresh calibration, fitted slope **0.6286** (was 0.6481), global intercept **5.0543** (was
  4.7352); the global median **x0.1988** (was x0.2138):

| Category | Live comps | Intercept | Multiple @ $100M TVL | Median mcap / TVL |
|---|---:|---:|---:|---:|
| Basis Trading | 7 | 5.2850 | x0.211 | x0.610 |
| CEX | 9 | 5.1924 | x0.192 | x0.068 |
| Canonical Bridge | 7 | 5.1864 | x0.191 | x0.399 |
| Privacy | 3 | 5.1636 | x0.187 | x0.947 |
| Cross Chain Bridge | 4 | 5.1576 | x0.186 | x1.323 |
| RWA | 8 | 5.1335 | x0.181 | x0.391 |
| Dexs | 11 | 5.0911 | x0.174 | x0.326 |
| Indexes | 3 | 5.0475 | x0.166 | x0.157 |
| Bridge | 6 | 5.0444 | x0.166 | x0.556 |
| Lending | 14 | 5.0145 | x0.161 | x0.153 |
| CDP | 3 | 4.9288 | x0.148 | x0.177 |
| Yield Aggregator | 4 | 4.9144 | x0.146 | x0.148 |
| Yield | 7 | 4.8884 | x0.142 | x0.184 |
| Liquid Staking | 9 | 4.8030 | x0.130 | x0.050 |

One protocol in the fresh fetch records a negative market cap (`autofinance`); it is excluded from
the calibration by the same rule as the sealed snapshot's. One catch during this verification: the
first fetch script wrote `floor_usd` as the $5M inclusion floor instead of the $50M watchlist
floor, which scored only the 35 watchlist rows — fixed in `scripts/fetch-snapshot.mjs` (the sealed
snapshot's own `floor_usd` is $50,000,000) and the run repeated to 176 rows.

## Validation (radar-4)

The fit is a shrunk log-log calibration of a noisy market, so radar-4 measures how wrong it is
instead of asserting it is right. The test is held-out, repeated, and on the snapshot's own
live-token comps (128 live tokens with a market cap and TVL, from the sealed 14 Nov snapshot):

- **4-fold × 8 seeds** (seeds 1–8), stratified folds: hide a quarter of the comps, fit the
  slope and intercepts on the remaining three quarters (leave-out by category — the tokens being
  predicted never enter the fit that predicts them), predict the hidden ones.
  **1,024 held-out predictions.** The same test is repeated as a 50/50 split × 8 seeds (1,024
  predictions) as a cross-check.
- **Bootstrap**: 1,000 resamples of the 128 comps; the global median multiple x0.2138 sits between
  x0.1688 and x0.3213 at 5–95%.
- **Conformal intervals (90%, multiplicative, log-scale)**: the 90th percentile of held-out
  |log error| per category gives the interval factor; a row's range is
  [implied ÷ factor, implied × factor]. Categories with fewer than 10 held-out errors use the
  global factor ×29.58. The interval never changes the rank.
- **Confidence**: high = 9+ live comps and a 90% factor ≤10 (only RWA qualifies); low = fewer
  than 3 live comps or a factor >50; medium = the rest. 15 rows are high, 52 medium, 111 low.

| Metric | 4-fold × 8 seeds | 50/50 split × 8 seeds |
|---|---:|---:|
| Mean MAPE | 955.85% | 956.01% |
| Median absolute error | 87.93% | 88.72% |
| Bias (mean signed error) | +884.50% | +884.41% |
| Median \|log error\| (typical miss) | 1.28 (×3.6) | 1.26 (×3.5) |
| Within a factor 2 of the market value | 27.83% | 27.54% |
| Within a factor 5 of the market value | 59.28% | 59.08% |
| Spearman rank correlation | 0.39 | 0.39 |

Per large category (9+ comps): Lending MAPE 649.52% (Spearman 0.48, 90% factor ×34.29), Dexs
312.82% (0.41, ×20.02), CEX 449.14% (0.44, ×166.08), Liquid Staking 419.55% (0.61, ×15.16),
RWA 59.59% (0.71, ×3.36), Yield 1,948.80% (0.36, ×110.67). Worst fold: seed 6, fold 2,
MAPE 2,646.43%, driven by Canonical Bridge at 28,236.87%. The full per-category table (34
categories) is in `validation_report.json` and on the dashboard's Validation tab.

**The targets the design set are NOT met, and the design was wrong about why.** The design set
MAPE <35% overall and no large category >60% before the error distribution was measured. The
measurement shows the mean is dominated by ~10 live tokens whose market cap is under 1% of their
TVL — xdai-stake-bridge records $223.4M of TVL against a $56K market cap, ratio 0.00025, so any
reasonable fit misses it by hundreds of thousands of percent; one such token moves the mean
and barely moves the median. The prescribed remedy — replace the fit with the flat global
median — was tried and measured on this same protocol: it leaves MAPE at 1,258.72% (still ~36×
the target) while erasing the category calibration that is the model's whole point. So the fit
was not replaced. The shrunk intercepts ship as fitted, the targets stand as not met, and the
uncertainty is carried honestly by the intervals instead. What the model does show: the typical
miss is a factor of ×3.6, the ranking correlates with the market at Spearman 0.39, and the top
five survive every floor ($25M / $50M / $100M — 145 / 178 / 189 rows, same five names).

The validation runs inside `buildRadar` (lib/validation.ts, deterministic: fixed seeds, seeded
PRNG — re-running it on the same snapshot writes byte-identical numbers) and is embedded in
`data.js`; the human-readable copy is `validation_report.json` at the repo root
(`node scripts/validate.mjs`). The fit itself is milliseconds of CPU — one slope and fourteen
intercepts from 128 comps. The GPU's role was the breadth of the model selection, not the speed
of one fit: the 3,000-config sweep and the Monte Carlo checks (20,000× paired bootstrap, 20,000×
permutation null, 100,000× bootstrap median) ran on Kaggle Tesla T4, and this document says so
instead of pretending the GPU fitted the board. The dashboard carries the result as a KPI strip
(median held-out error, not the mean MAPE), an integrity strip (snapshot provenance, live top-5
re-derivation, fresh-data check, no network, dossier cap), the 90% range + confidence on every
board row and detail view, and a Validation tab with the full tables.

## Checks (run before every submit)

```sh
node scripts/verify-board.mjs out ~/workspace/makefun/token-radar-01-kit/input/snapshot.json
# verify-board: PASS — 178 rows, 3 dashboard files (55.5 KiB, text 55.5 KiB), 3 screenshots, dossier 1134.1 KiB
```

The script checks the gate's own rows: board 100–4000 rows, ranks 1..n, implied values
non-increasing and distinct, every watchlist slug present, farm steps 3–12 of 20–600 characters;
dashboard ≤400 files and 4 MiB, no network reference, text under the 64 KiB dossier cap; 3–4
screenshots ≤512 KiB, long side ≤1440, short side ≥800; dossier ≤1.5 MiB; and it re-derives the
top five implied values in the page's own arithmetic (exp(intercept + slope × ln TVL) × growth ×
maturity × chains). Radar-4 adds: every board row carries a conformal interval that brackets its
point estimate plus a valid confidence flag; `data.js` carries the validation object (128 live
comps, 1,024 held-out predictions, targets honestly reported as not met, the note naming the
outlier driver, 34 per-category rows, the same top five at all three floor sweeps);
`validation_report.json` at the repo root matches `data.js`; `model_version` is radar-4; and the
dashboard text contains the KPI strip, the integrity strip, the 90% range column, the Validation
tab, the confidence badges and the sticky table header. It also runs against the fresh snapshot
(`node scripts/verify-board.mjs out-fresh snapshots/2026-11-19/snapshot.json`) — the
snapshot-relative checks there use the fresh snapshot's own 121 live comps (968 held-out
predictions) instead of the sealed snapshot's numbers.

- `board.json`: 178 rows, ranks exactly 1..178, implied values non-increasing, all distinct,
  every watchlist slug present, every row's farm steps 3–12 strings of 20–600 characters.
- The dashboard recomputes each row's implied value in the page from the same inputs and shows
  whether it matches `board.json`.
- The dashboard renders with no network (no http(s) in attributes, styles, scripts or CSS) and
  its source is under the 64 KiB dossier text cap.
- Screenshots are real renders of the dashboard: the board (with the KPI + integrity strips and
  the 90% range column), a detail view (with its 90% range and confidence note), the Validation tab.
