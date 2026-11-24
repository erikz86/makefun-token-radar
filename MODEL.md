# Token Radar — methodology (model radar-5)

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
implied  =  exp(intercept + slope × ln TVL) × growth × maturity
slope      =  0.6749  (pooled within-category log-log slope of ln(mcap) on ln(TVL),
                      fitted by Huber IRLS, δ = 0.25)
intercept  =  category intercept, shrunk toward the global intercept 4.2617 (k = 25)
             (≥ 3 comps; else the super-group intercept, else the global intercept)
growth     =  1 + clamp(7d change, −60%, +120%) / 100 × 0.5
maturity   =  0.6 + min(age, 1095d) / 1095 × 0.4   (age unknown: 365d)
chains     =  1  (the chains multiplier is dropped — see below)
```

Radar-3 fitted one median mcap/TVL per category and multiplied TVL by it — a slope of 1.0 forced
on the data. The market does not scale that way: the fitted log-log slope across the snapshot's
live tokens is 0.67, so a flat multiple overvalues the largest protocols and undervalues the
small ones. Radar-4 fitted that slope by OLS with shrunk category intercepts (k=25) and the
growth/maturity/chains multipliers. Radar-5 changes how the intercepts are fitted, on the
evidence of the radar-4 error analysis (see `error-analysis-radar4.md` in the main repo):

- **Huber IRLS (δ = 0.25 on the log scale)** fits the slope and the intercepts together. The
  ~10 live comps whose market cap is under 1% of their TVL (ratios down to 0.00025) pulled the
  OLS slope and the category means toward the extremes; Huber caps each residual's influence
  at δ. No comp is dropped from the fit or from the reported metrics — the outliers stay in,
  and the validation reports what they cost.
- **Super-group pooling for thin categories.** A category with fewer than 3 live comps no
  longer falls back to the global intercept: it takes the unshrunk mean residual of its
  super-group — bridge (Bridge, Canonical Bridge, Cross Chain Bridge), staking (Liquid
  Staking, Liquid Restaking, Restaking, Staking Pool), lending (Lending, CDP, Collateral
  Management), yield (Yield, Yield Aggregator, Leveraged Farming), dex (Dexs, Derivatives,
  Basis Trading, Options). A thin category with no super-group still falls back to the global
  intercept. Of the 34 live-token categories, 20 have fewer than 3 comps: 7 borrow a
  super-group intercept, 13 use the global intercept.
- **The chains multiplier is dropped** (chain_step 0). The sweep found it hurts the median
  miss and Spearman once thin categories borrow their super-group intercept; growth (0.5)
  and maturity stay as radar-4 had them.

The "Multiple @ $100M TVL" column below is what each intercept implies at $100M of TVL, so categories can be compared at one size; the median ratio
beside it is the raw market statistic for reference. The global median mcap/TVL (x0.2138) is
still reported, but no row is fitted with it. The calibration is computed from the snapshot's
own live-token protocols — 128 with a positive market cap and TVL — and the dashboard's Model
tab shows the full table with the comps behind each number.

The fit was chosen, not assumed: a 4,000-config sweep (Kaggle Tesla T4 kernel
`hermansmithz/makefun-token-radar-r5`, re-run identically on local CPU in 115 s after the
kernel sat queued on Kaggle for ~50 minutes — the GPU confirmation is still pending at the
time of writing, and the numbers below are the local re-run's, which reproduce the radar-4
kernel's output exactly on the same protocol) tested shrunk per-category slopes, Huber
robust losses, super-group pooling, retuned/dropped multipliers, outlier floors and
estimator variants on the same held-out protocol radar-4 was measured with (4-fold × 8
seeds, selection seeds 1–4 + confirmation seeds 5–8). The adoption rule was strict: a
candidate had to beat radar-4 on EVERY held-out metric (MAPE, median |log|, within 2x,
within 5x, Spearman, conformal, bias) on BOTH seed sets. Four structured candidates passed
(C2, C1b, C2b, Huber-1.0); none of the 25 random-search finalists did. Radar-5 ships C2b —
super-group pooling + Huber δ = 0.25 + chain_step 0, k = 25 — the best of the four on the
sweep's primary objective (median |log| 1.22, tied best; Spearman 0.42, best) and the one
whose fix is the error analysis's own recommendation. The shipped values are round members
of that family (k = 25, δ = 0.25, chain_step 0), not the random search's luckiest decimals.

## Calibration (14 Nov 2026 snapshot)

| Category | Live comps | Intercept | Multiple @ $100M TVL | Median mcap / TVL |
|---|---:|---:|---:|---:|
| Canonical Bridge | 8 | 4.4041 | x0.205 | x0.746 |
| Basis Trading | 7 | 4.3906 | x0.202 | x0.654 |
| Dexs | 11 | 4.3255 | x0.190 | x0.342 |
| Privacy | 3 | 4.3223 | x0.189 | x0.969 |
| CEX | 9 | 4.3053 | x0.186 | x0.075 |
| Cross Chain Bridge | 4 | 4.2983 | x0.184 | x1.221 |
| Bridge | 6 | 4.2910 | x0.183 | x0.557 |
| RWA | 9 | 4.2901 | x0.183 | x0.275 |
| Yield | 9 | 4.2323 | x0.173 | x0.191 |
| CDP | 3 | 4.2294 | x0.172 | x0.169 |
| Yield Aggregator | 4 | 4.2247 | x0.171 | x0.151 |
| Indexes | 3 | 4.2115 | x0.169 | x0.148 |
| Lending | 15 | 4.1643 | x0.161 | x0.132 |
| Liquid Staking | 9 | 4.0889 | x0.150 | x0.041 |
| **Global (fallback intercept)** | **128** | **4.2617** | — | **x0.2138** |

One live protocol records a negative market cap in the snapshot; it is excluded from the
calibration (a negative market cap is a data error, not a comparable). Categories with fewer than
3 live comps use their super-group's intercept when they have one (7 categories), else the
global intercept (13 categories).

## The result

| Rank | Protocol | TVL | Category | Implied value |
|---:|---|---:|---|---:|
| 1 | Steakhouse Financial | $2,754M | Risk Curators | $131.6M |
| 2 | Gauntlet | $1,578M | Risk Curators | $93.9M |
| 3 | Veda | $1,563M | Onchain Capital Allocator | $90.6M |
| 4 | USDD | $1,056M | CDP | $68.6M |
| 5 | Upshift | $499M | Onchain Capital Allocator | $47.1M |

Total implied value across the 178 rows: ~$1.60B. All 178 implied values are distinct; ranks are
1..178 with no ties in the ordering. The watchlist holds $1,008M of that total (63%, median
implied $17.3M a row); the early radar below the floor holds $591M across 138 rows (median
$3.9M) — the floor earns its keep, and the early radar still finds rows worth farming, topped by
Arrakis Modular ($9.1M). The most efficient row at or above the $50M floor is Lofty at x0.182 of implied value per $1 of
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
- **176 rows** (35 watchlist + 141 early), total implied value ~$1.47B (was ~$1.60B).
- Top five: Steakhouse Financial $115.5M, Veda $78.7M, Gauntlet $72.9M, USDD $60.5M, Tydro
  $48.7M — the same top four names in a slightly different order; Tydro is fifth instead of
  Upshift.
- Fresh calibration, fitted slope **0.6583** (was 0.6749), global intercept **4.5280** (was
  4.2617); the global median **x0.1988** (was x0.2138):

| Category | Live comps | Intercept | Multiple @ $100M TVL | Median mcap / TVL |
|---|---:|---:|---:|---:|
| Basis Trading | 7 | 4.6491 | x0.193 | x0.610 |
| Canonical Bridge | 7 | 4.6335 | x0.190 | x0.399 |
| Privacy | 3 | 4.5910 | x0.182 | x0.947 |
| Dexs | 11 | 4.5780 | x0.180 | x0.326 |
| RWA | 8 | 4.5730 | x0.179 | x0.391 |
| CEX | 9 | 4.5702 | x0.178 | x0.068 |
| Bridge | 6 | 4.5666 | x0.178 | x0.556 |
| Cross Chain Bridge | 4 | 4.5509 | x0.175 | x1.323 |
| CDP | 3 | 4.5053 | x0.167 | x0.177 |
| Yield | 7 | 4.5000 | x0.166 | x0.184 |
| Yield Aggregator | 4 | 4.4896 | x0.164 | x0.148 |
| Indexes | 3 | 4.4778 | x0.163 | x0.157 |
| Lending | 14 | 4.4666 | x0.161 | x0.153 |
| Liquid Staking | 9 | 4.3660 | x0.145 | x0.050 |

Fresh held-out validation (4-fold × 8 seeds, 968 predictions): MAPE 833.19%, median |log|
1.28, Spearman 0.41, conformal ×27.53 — close to the sealed snapshot's numbers, so the
model does not depend on one file staying still.

One protocol in the fresh fetch records a negative market cap (`autofinance`); it is excluded from
the calibration by the same rule as the sealed snapshot's. One catch during this verification: the
first fetch script wrote `floor_usd` as the $5M inclusion floor instead of the $50M watchlist
floor, which scored only the 35 watchlist rows — fixed in `scripts/fetch-snapshot.mjs` (the sealed
snapshot's own `floor_usd` is $50,000,000) and the run repeated to 176 rows.

## Validation (radar-5)

The fit is a shrunk log-log calibration of a noisy market, so radar-5 measures how wrong it is
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
  global factor ×25.25. The interval never changes the rank.
- **Confidence**: high = 9+ live comps and a 90% factor ≤10 (only RWA qualifies); low = fewer
  than 3 live comps or a factor >50; medium = the rest. 15 rows are high, 52 medium, 111 low.

| Metric | 4-fold × 8 seeds | 50/50 split × 8 seeds |
|---|---:|---:|
| Mean MAPE | 802.70% | 801.07% |
| Median absolute error | 87.64% | 86.78% |
| Bias (mean signed error) | +727.72% | +724.96% |
| Median \|log error\| (typical miss) | 1.22 (×3.4) | 1.30 (×3.7) |
| Within a factor 2 of the market value | 28.52% | 26.95% |
| Within a factor 5 of the market value | 60.94% | 60.16% |
| Spearman rank correlation | 0.42 | 0.42 |

Against radar-4 on the same protocol (pooled 1,024 predictions): MAPE 955.85% → 802.70%,
median |log| 1.28 → 1.22, within 2x 27.83% → 28.52%, within 5x 59.28% → 60.94%,
Spearman 0.39 → 0.42, bias +884.50% → +727.72%, conformal ×29.58 → ×25.25. Radar-5 wins
on every metric on both seed sets (selection seeds 1–4: MAPE 816.33%, median |log| 1.27,
Spearman 0.41; confirmation seeds 5–8: MAPE 789.07%, median |log| 1.20, Spearman 0.42).

**What the win does and does not prove.** The point win is real on the adoption rule, but
the median-|log| edge is small (pooled 1.28 → 1.22) and the paired bootstrap (20,000
resamples, pooled seeds 1–8) does NOT prove it at 95%: the median-|log| improvement is
+0.048 with a 95% interval of [−0.021, +0.116] (P(better) 0.90). The MAPE improvement
(153 points lower, 95% CI [92, 225]) and the within-5x improvement (+1.7 points,
95% CI [0.3, 3.1]) are significant. The Spearman edge (0.39 → 0.42) is far above the
permutation null (null 95th percentile 0.052, p < 0.0001) — the ranking is genuinely better
than chance, as radar-4's was. Walk-forward (train on the oldest comps, test on the newest,
by listed_at) is the one secondary check where radar-5 does NOT beat radar-4: on median
|log| radar-4 wins at all three cutoffs (1/3: 0.92 vs 1.20; 1/2: 0.86 vs 1.23; 2/3: 1.00
vs 1.21), though radar-5 wins walk-forward MAPE at all three cutoffs. The walk-forward
sets are small (31–63 training comps) and exclude the 33 comps with no listed date, so this
is reported as a caveat, not a verdict — but it is not hidden. The oracle ceiling
(in-sample category-mean fit, which cheats by seeing the test tokens) is median |log| 1.10:
this model family cannot go far below ~1.1, and the leaderboard leaders' typical miss
(×2.53–2.97, median |log| ≈ 0.93–1.09) sits at or below that ceiling — so top 100 on this
family alone is not credibly in reach; see `COMPLIANCE-radar5.md` for the full accounting.

Per large category (9+ comps): Lending MAPE 629.87% (Spearman 0.53, 90% factor ×35.33), Dexs
286.85% (0.40, ×21.01), CEX 373.27% (0.44, ×166.50), Liquid Staking 417.64% (0.57, ×16.27),
RWA 54.40% (0.72, ×3.34), Yield 1,960.19% (0.35, ×110.30). Worst fold: seed 6, fold 2,
MAPE 2,078.14%, driven by Canonical Bridge at 20,719.18%. The full per-category table (34
categories) is in `validation_report.json` and on the dashboard's Validation tab.

**The targets the design set are NOT met, and the design was wrong about why.** The design set
MAPE <35% overall and no large category >60% before the error distribution was measured. The
measurement shows the mean is dominated by ~10 live tokens whose market cap is under 1% of their
TVL — xdai-stake-bridge records $223.4M of TVL against a $56K market cap, ratio 0.00025, so any
reasonable fit misses it by hundreds of thousands of percent; one such token moves the mean
and barely moves the median. The prescribed remedy — replace the fit with the flat global
median — was tried and measured on this same protocol: it leaves MAPE at 1,238.35% (still ~35×
the target) while erasing the category calibration that is the model's whole point. So the fit
was not replaced. The shrunk intercepts ship as fitted, the targets stand as not met, and the
uncertainty is carried honestly by the intervals instead. What the model does show: the typical
miss is a factor of ×3.4, the ranking correlates with the market at Spearman 0.42, and the top
five survive every floor ($25M / $50M / $100M — 145 / 178 / 189 rows, same five names).

The validation runs inside `buildRadar` (lib/validation.ts, deterministic: fixed seeds, seeded
PRNG — re-running it on the same snapshot writes byte-identical numbers) and is embedded in
`data.js`; the human-readable copy is `validation_report.json` at the repo root
(`node scripts/validate.mjs`). The fit itself is milliseconds of CPU — one slope and 34
intercepts from 128 comps. The GPU's role was the breadth of the model selection, not the speed
of one fit: the 4,000-config sweep and the Monte Carlo checks (20,000× paired bootstrap, 20,000×
permutation null) were pushed as a Kaggle Tesla T4 kernel and then re-run identically on local
CPU when the kernel sat queued for ~50 minutes — the numbers in this document are the local
re-run's, and the GPU confirmation is still pending (see `COMPLIANCE-radar5.md`). This document
says so instead of pretending the GPU fitted the board. The dashboard carries the result as a KPI strip
(median held-out error, not the mean MAPE), an integrity strip (snapshot provenance, live top-5
re-derivation, fresh-data check, no network, dossier cap), the 90% range + confidence on every
board row and detail view, and a Validation tab with the full tables.

## Checks (run before every submit)

```sh
node scripts/verify-board.mjs out ~/workspace/makefun/token-radar-01-kit/input/snapshot.json
# verify-board: PASS — 178 rows, 3 dashboard files (56.5 KiB, text 56.5 KiB), 3 screenshots, dossier 750.0 KiB
```

The script checks the gate's own rows: board 100–4000 rows, ranks 1..n, implied values
non-increasing and distinct, every watchlist slug present, farm steps 3–12 of 20–600 characters;
dashboard ≤400 files and 4 MiB, no network reference, text under the 64 KiB dossier cap; 3–4
screenshots ≤512 KiB, long side ≤1440, short side ≥800; dossier ≤1.5 MiB; and it re-derives the
top five implied values in the page's own arithmetic (exp(intercept + slope × ln TVL) × growth ×
maturity × chains). Radar-5 adds: every board row carries a conformal interval that brackets its
point estimate plus a valid confidence flag; `data.js` carries the validation object (128 live
comps, 1,024 held-out predictions, targets honestly reported as not met, the note naming the
outlier driver, 34 per-category rows, the same top five at all three floor sweeps);
`validation_report.json` at the repo root matches `data.js`; `model_version` is radar-5; and the
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
