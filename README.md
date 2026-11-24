# Token Radar

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/erikz86/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/erikz86/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

Which pre-token protocol would be worth the most if it launched? Token Radar reads a sealed
DefiLlama snapshot of 758 protocols, scores every launch candidate, and hands you a dashboard you
can actually use: a ranked board, a detail view for every protocol, a live-token view, and the
model that scored it all — with the farm plan for each row.

Entry for the [make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01)
($1,325, closes 14 Dec 2026).

> **Read the words carefully.** A protocol "records no token" when its DefiLlama record carries
> none — never that it has none. A wrapped, staked or bridged product of a token that already trades
> is excluded from the board entirely, however large its TVL: WBTC is Bitcoin on Ethereum, not a
> launch waiting to happen. Implied values are this entry's claim, never a prediction that a token
> is coming.

## The model (radar-4)

The fit comes from the market itself, per category — not a flat number. Radar-3 fitted one
median mcap/TVL per category (a slope of 1.0 forced on the data); radar-4 fits the slope the
market actually shows:

```
implied  =  exp(intercept + slope × ln TVL) × growth × maturity × chains
slope      =  0.6481  (pooled within-category log-log slope)
intercept  =  category intercept, shrunk toward the global intercept 4.7352 (k = 25)
             (≥ 3 comps; else the global intercept)
growth     =  1 + clamp(7d change, −60%, +120%) / 100 × 0.5
maturity   =  0.6 + min(age, 1095d) / 1095 × 0.4   (age unknown: 365d)
chains     =  1 + 0.03 × min(chains − 1, 5)
```

At $100M of TVL, Dexes imply x0.188, Lending x0.146, Liquid Staking x0.132 — the market pays
very differently for different businesses, and the board prices that in. See [MODEL.md](MODEL.md)
for the full methodology, the calibration table, and the checks.

**Validation (radar-4):** the fit is tested held-out — 4-fold × 8 seeds on the
snapshot's own 128 live-token comps, 1,024 predictions. The typical miss is a factor of ×3.6
(median |log error| 1.28); the mean MAPE is 955.85% because ~10 live tokens carry a market cap
under 1% of their TVL, so the median is the fair summary. The ranking correlates with the
market at Spearman 0.39. Every row carries a 90% conformal interval and a confidence flag
(high 15, medium 52, low 111); the design's MAPE targets (<35% overall, no large category
>60%) are NOT met, the prescribed remedy was measured and not applied, and the uncertainty is
carried by the intervals instead. Full numbers in [MODEL.md](MODEL.md), `validation_report.json`,
and the dashboard's Validation tab. The fit itself is milliseconds of CPU; the GPU's role was
the model selection — a 3,000-config sweep on Kaggle Tesla T4 that picked this family over
radar-3 on every held-out metric.

**Headline:** 758 protocols scanned · 40 on the watchlist · **178 rows ranked** ·
top implied value **Steakhouse Financial, ~$136M** · total implied value ~$1.64B ·
153 rows carry at least one risk flag.

**What the board says:** the watchlist holds 64% of the total implied value ($1,052M of $1.64B,
median $19.4M a row) — the $50M floor earns its keep. The early radar below the floor still
finds 138 rows worth $587M (median $4.0M), topped by Arrakis Modular. The most efficient row is
Manifest Trade at x0.518 of implied value per $1 of TVL. The fastest grower, Shift DeFi, is up
+4,448% in 7 days — the model clamps growth at +120%, and the row carries a growth-spike flag.

## The dashboard

- **Pre-token board** — 178 rows, ranked by implied value. Search, filter by category / chain /
  minimum TVL / gainers / watchlist-only, sort by implied value, TVL, 7d change, age or name.
  Click any row for its detail view. Each row shows its risk flags (young, single chain, growth
  spike, thin comps) with the reason behind each — plus the 90% range and a confidence flag.
- **KPI strip + integrity strip** — always visible above the tabs: rows, watchlist coverage,
  median held-out error (×3.6), calibration comps (128), total implied value; snapshot
  provenance, the live top-5 re-derivation (✓/✗), the 19 Nov fresh-data check, no network, the
  dossier text cap.
- **Validation** — the held-out test in full: overall metrics, the per-category table, the 90%
  intervals, the floor sweep, and the targets that were not met (with why).
- **Movers & risks** — the week's fastest growers and fallers, the most efficient rows (implied
  value per $1 of TVL, at or above the $50M floor), implied value by category, and how
  often each flag fires across the board. The board itself sorts by Value / TVL too.
- **Detail view** — the protocol's record, the model arithmetic recomputed in the page (exp(intercept + slope × ln TVL) × growth × maturity × chains = implied value), the 90% range with its confidence
  note, the category's live-token comps, the row's risk flags, and a seven-step farm plan from
  board.json — the page shows the board's own plan, never a second copy that could drift.
- **Live tokens** — the market's own values for the 24 largest live-token protocols, the set that
  calibrates every category intercept.
- **The model** — the formula, the full calibration table, the farm plan's seven steps, and the
  fresh-data check: the same program re-run on a 19 Nov 2026 DefiLlama fetch scores 176 rows
  with the same five names on top.

Everything renders with no network: the dashboard is static HTML/CSS/JS plus `data.js`.

## Run it

```sh
# needs Node 22
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
# out/board.json, out/data.js, out/dashboard/, out/screenshots/, out/dossier.json
```

Serve `out/` and open `dashboard/index.html` — or serve the repo's `dashboard/` with a
`data.js` beside it (the page loads `../data.js`).

## Fresh snapshot

The graded run reads the competition's sealed snapshot, but the program reads any snapshot in
the same format — so it can be re-run on fresh data at any time:

```sh
node scripts/fetch-snapshot.mjs 2026-11-19 snapshots/2026-11-19
mkdir -p out-fresh
MAKEFUN_OUTPUT_DIR=out-fresh node main.ts --input snapshots/2026-11-19/snapshot.json
```

The 19 Nov 2026 check: 736 protocols, 35 on the watchlist, 176 rows, top five the same names
(Steakhouse Financial $118.0M, Veda $81.9M, Gauntlet $75.9M, USDD $53.0M, Upshift $49.5M). See
[MODEL.md](MODEL.md) for the fresh calibration table. `floor_usd` in a snapshot is the $50M
watchlist floor, not the $5M inclusion floor — the fetch script seals it that way. The fresh
board tells the same story: the watchlist holds 60% of its implied value, the early radar's top
row is again Arrakis Modular, and the most efficient row is Wildcat Protocol (x0.706).

## Layout

```
main.ts                  entrypoint: reads /input/snapshot.json, writes /output
lib/model.ts             the radar-4 model, the farm plans, the board gate
lib/validation.ts        the held-out test (4-fold × 8 seeds, conformal intervals, bootstrap, floor sweep)
lib/insights.ts          movers, category concentration, risk flags (from the board)
scripts/validate.mjs     run the held-out validation, write validation_report.json (repo root)
scripts/fetch-snapshot.mjs  fetch + seal a fresh DefiLlama snapshot (public API, no key)
scripts/verify-board.mjs    the gate's own checks on one out/ directory (run before submit)
snapshots/2026-11-19/    the fresh 19 Nov 2026 snapshot + raw fetch, for verification
dashboard/index.html     the page shell
dashboard/app.css        the radar-console theme
dashboard/app.js         the board, filters, detail drawer, movers, live + model + validation tabs
vendor/makefun-board.ts  make.fun's dossier library (kit copy, unchanged)
screenshots/             1-board.jpg, 2-detail.jpg, 3-validation.jpg
MODEL.md                 methodology, calibration, validation, fresh-data check, checks
validation_report.json   the held-out validation, human-readable (mirrors data.js)
```

## License

MIT — see [LICENSE](LICENSE).
