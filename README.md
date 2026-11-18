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

## The model (radar-2)

The multiple comes from the market itself, per category — not a flat number:

```
implied  =  TVL × category multiple × growth × maturity × chains
category multiple  =  median(market cap / TVL) of live tokens in the same category
                     (≥ 3 comps; else the global median x0.214)
growth             =  1 + clamp(7d change, −60%, +120%) / 100 × 0.5
maturity           =  0.6 + min(age, 1095d) / 1095 × 0.4   (age unknown: 365d)
chains             =  1 + 0.03 × min(chains − 1, 5)
```

Dexes trade at x0.342 of TVL, Lending at x0.132, Liquid Staking at x0.041 — the market pays very
differently for different businesses, and the board prices that in. See [MODEL.md](MODEL.md) for
the full methodology, the calibration table, and the checks.

**Headline:** 758 protocols scanned · 40 on the watchlist · **178 rows ranked** ·
top implied value **Steakhouse Financial, ~$535M** · total implied value ~$2.9B.

## The dashboard

- **Pre-token board** — 198 rows, ranked by implied value. Search, filter by category / chain /
  minimum TVL / gainers / watchlist-only, sort by implied value, TVL, 7d change, age or name.
  Click any row for its detail view.
- **Detail view** — the protocol's record, the model arithmetic recomputed in the page (TVL ×
  multiple × growth × maturity × chains = implied value), the category's live-token comps, and
  a six-step farm plan derived from the protocol's own category, chains, TVL and age.
- **Live tokens** — the market's own values for the 24 largest live-token protocols, the set that
  calibrates every category multiple.
- **The model** — the formula, the full calibration table, and the caveats.

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

## Layout

```
main.ts                  entrypoint: reads /input/snapshot.json, writes /output
lib/model.ts             the radar-2 model, the farm plans, the board gate
dashboard/index.html     the page shell
dashboard/app.css        the radar-console theme
dashboard/app.js         the board, filters, detail drawer, live + model tabs
vendor/makefun-board.ts  make.fun's dossier library (kit copy, unchanged)
screenshots/             1-board.jpg, 2-detail.jpg, 3-filtered.jpg
MODEL.md                 methodology, calibration, checks
```

## License

MIT — see [LICENSE](LICENSE).
