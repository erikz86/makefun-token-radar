# Token Radar — methodology (model radar-2)

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
1..178 with no ties in the ordering.

## The farm plan

Each row carries six steps derived from the protocol's own record — never from a hand-written list
of names:

1. Fresh wallet, seed offline (under $3 gas, 5 min).
2. The category's action with capital scaled to TVL ($50–$250).
3. A weekly qualifying action, by category (borrow-and-repay for Lending, a weekly swap for
   Dexes, a small hedged trade for Perpetuals, …).
4. Hold 30–60 days by age, so the activity spans more than one snapshot.
5. Claim only from the protocol's own published link; never pay to claim.
6. Keep a farm log: wallet, dates, every transaction.

## Checks (run before every submit)

- `board.json`: 178 rows, ranks exactly 1..178, implied values non-increasing, all distinct,
  every watchlist slug present, every row's farm steps 3–12 strings of 20–600 characters.
- The dashboard recomputes each row's implied value in the page from the same inputs and shows
  whether it matches `board.json`.
- The dashboard renders with no network (no http(s) in attributes, styles, scripts or CSS) and
  its source is under the 64 KiB dossier text cap.
- Screenshots are real renders of the dashboard: the board, a detail view, a filtered view.
