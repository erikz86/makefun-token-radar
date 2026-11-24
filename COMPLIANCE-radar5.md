# Kepatuhan S&K — radar-5 (worktree token-radar-r5)

Tanggal: 24 Nov 2026. Batas keras bos 24 Nov 17:55 WIB: sistem + skills WAJIB
sesuai S&K kompetisi. Dokumen ini mencatat pemeriksaan competition.yaml yang
dilakukan sebelum sweep GPU radar-5 di-push, dan keputusan yang diambil.

## Yang diperiksa (competition.yaml, dibaca langsung)

1. **Satu-satunya input program** — "Your program, main.ts at the root of your
   repository, reads the snapshot at `/input/snapshot.json`, writes the ranked
   board to `/output/board.json` ..." Tidak ada input lain yang disebut.
2. **Snapshot sealed, sepuluh field tepat** — "`/input/snapshot.json` is the
   sealed protocol data your entry reads. The house fetched it once from
   DefiLlama's public API, and every run of your entry and the grade read the
   same bytes: it does not move under you and it is not updated." — "Each
   carries exactly ten fields: `slug`, `name`, `category`, `chains`, `tvl_usd`,
   `change_7d`, `mcap_usd`, `listed_at`, `gecko_id` and `symbol`."
3. **Kriteria juri #2 (model nilai)** — "the implied value follows from the
   snapshot's own figures, the protocol's TVL, its seven-day growth and how
   long it has run with no token, and not from a hardcoded list of names".
4. **Program tanpa network** — program berjalan di sandbox tanpa network
   (1 CPU, 1024 MB, 120 detik); dashboard "renders with no network".
5. **Tidak ada klausul yang secara eksplisit mengizinkan data luar / snapshot
   baru.** Tidak ditemukan izin tertulis untuk memakai field di luar sepuluh
   field sealed, fetch DefiLlama saat build/grade, atau mengganti snapshot.

## Keputusan (tidak ada ambiguitas yang mengharuskan berhenti)

- **DITOLAK: konsentrasi TVL per chain dari `chainTvls`** (Herfindahl / share
  chain terbesar / jumlah chain material). Alasan: `chainTvls` bukan satu dari
  sepuluh field snapshot sealed; competition.yaml tidak secara eksplisit
  mengizinkan data luar; program graded membaca snapshot sealed saja tanpa
  network. Kandidat ini tidak diuji di sweep radar-5.
- **DITOLAK: semua data luar lainnya** (audit, twitter, change_1d/1h,
  tokenBreakdowns, deskripsi, dsb.) dengan alasan yang sama.
- **DIIZINKAN: hanya fitur dari sepuluh field sealed** — TVL, change_7d,
  listed_at (umur + flag null), jumlah chains, kategori, mcap (kalibrasi saja).
  Semua kandidat sweep radar-5 memakai fitur ini saja.
- **Snapshot segar 19 Nov 2026 HANYA untuk verifikasi lokal** (praktik radar-4:
  `verify-board` pada snapshot segar membuktikan model tidak bergantung pada
  satu file). Snapshot segar TIDAK dipakai sebagai input fit, TIDAK melatih
  model, TIDAK mengganti snapshot sealed, dan TIDAK masuk ke program graded.
  Bila ini dianggap ragu, yang diverifikasi hanyalah ketahanan — angka laporan
  tetap dari snapshot sealed 14 Nov.
- **Token odds / farm verdicts berkos / ledger / tabel ablasi** — hanya
  ditulis/diklaim bila benar-benar dibangun dan terverifikasi di worktree ini;
  tidak ada klaim atas fitur yang belum ada.

## Aturan pelaporan (diterapkan di laporan akhir)

- Angka validasi dilaporkan persis seperti hasil ukur (MAPE, median |log|,
  within-2x/5x, Spearman, konformal, bias). Target gagal = gagal.
- Angka "buang outlier" HANYA berlabel DIAGNOSIS, tidak pernah jadi angka
  laporan dan tidak menggantikan MAPE resmi.
- Setiap angka estimasi diberi label PERKIRAAN yang jelas dan dipisah dari
  angka ukur. Perkiraan judge radar-4 (~880k–930k) tetap PERKIRAAN — bukan
  klaim posisi leaderboard/top-100. Posisi leaderboard hanya dari skor
  juri/server yang sudah keluar.
- Adopsi: hanya model yang menang di SEMUA metrik utama di KEDUA set seed
  (seleksi 1–4 dan konfirmasi 5–8). Seri pada satu metrik = gagal adopsi ketat.

## Status sweep

- Kernel `hermansmithz/makefun-token-radar-r5` (T4) di-push 24 Nov ~17:44 WIB;
  saat dokumen ini ditulis masih antre GPU (kernel.log 0 byte).
- TIDAK ada submit, claim, push repo, atau merge ke repo utama dari worktree ini.

## Hasil sweep + adopsi (24 Nov ~18:30 WIB)

**Status GPU:** kernel v1 masih antre di Kaggle saat cek terakhir (~19:00 WIB,
>1 jam antre, kernel.log 0 byte, belum ada file output). Proses polling
`kaggle_kernel.py run` mati kena SIGTERM eksternal (~44 menit berjalan) — BUKAN
error kernel; kernel TIDAK di-push ulang (SOP: jangan re-push tanpa memeriksa
penyebab; antrean panjang bukan kegagalan). **Konfirmasi GPU masih PENDING.**
Angka di bawah ini berasal dari **re-run lokal CPU yang identik** (skrip kernel
yang sama, folds dan snapshot yang sama, 115 detik): re-run lokal radar-4
sebelumnya terbukti identik dengan output kernel GPU-nya, dan port TypeScript
radar-5 di worktree ini mereproduksi angka Python sampai 4,4e-15 (0/128
prediksi berbeda) — jadi angka lokal ini dapat dipercaya sebagai hasil sweep,
dengan catatan konfirmasi GPU menyusul bila kernel selesai.

**Pemenang aturan adopsi ketat** (menang di SEMUA metrik utama di KEDUA set
seed, seleksi 1–4 + konfirmasi 5–8) — 4 dari 16 varian terstruktur:

| Kandidat | SEL MAPE / med\|log\| / Spear | CONF MAPE / med\|log\| / Spear | Pooled MAPE / med\|log\| / Spear |
|---|---|---|---|
| C2 super+Huber 0.5+cs0 | 833,60 / 1,25 / 0,41 | 808,62 / 1,21 / 0,42 | 821,11 / 1,23 / 0,41 |
| C1b super+cs0+k100 | 793,14 / 1,26 / 0,40 | 778,65 / 1,20 / 0,41 | 785,89 / 1,22 / 0,40 |
| **C2b super+Huber 0.25+cs0 (radar-5)** | **816,33 / 1,27 / 0,41** | **789,07 / 1,20 / 0,42** | **802,70 / 1,22 / 0,42** |
| H1 super+Huber 1.0+cs0 | 844,09 / 1,25 / 0,40 | 821,10 / 1,22 / 0,42 | 832,60 / 1,24 / 0,41 |
| Radar-4 (baseline) | 967,81 / 1,29 / 0,39 | 943,88 / 1,27 / 0,40 | 955,85 / 1,28 / 0,39 |

Gagal ketat: C1 (Spearman SEL seri 0,39), C3 (within-2x CONF seri 28,13).
**Random search 4.000 config: 0 dari 25 finalis lolos** aturan ketat.
Slope per kategori, ridge fitur, trimmed fit, intercept median, dan pooling
hierarkis dua level semuanya DITOLAK di pilot/sweep (lihat `sweep_r5_results.json`,
`random_search_r5_results.json`, `mc_r5_results_local.json` di worktree ini).

**Radar-5 = C2b** (super-pooling + Huber δ=0,25 + chain_step 0, shrink k=25,
growth 0,5, maturity on): terbaik dari 4 pemenang pada objektif primer brief
(median |log| 1,22 — terbaik bersama C1b; Spearman 0,42 — terbaik sendiri),
dan Huber adalah perbaikan yang direkomendasikan error-analysis §8 untuk
rezim rasio ekstrem.

**Kejujuran yang wajib ikut di laporan (bukan footnote):**

- Kemenangan median |log| KECIL dan TIDAK signifikan pada 95%: paired
  bootstrap 20.000× (pooled seeds 1–8) C2b: d_medlog +0,048, 95% CI
  [−0,021, +0,116], P(lebih baik) 0,90. Yang signifikan: MAPE (−153 poin,
  CI [92, 225]) dan within-5x (+1,67 poin, CI [0,29, 3,13]).
- Walk-forward (sekunder): radar-5 KALAH dari radar-4 pada median |log| di
  SEMUA cutoff (1/3: 1,20 vs 0,92; 1/2: 1,23 vs 0,86; 2/3: 1,21 vs 1,00),
  meski menang MAPE walk-forward di semua cutoff. Set kecil (31–63 train),
  33 comp tanpa listed_at ter-exclude — dilaporkan sebagai caveat.
- Lantai keluarga model ini (oracle in-sample, CURANG — diagnosis saja):
  category-mean median |log| 1,10. Miss khas pemimpin leaderboard
  (×2,53–2,97 → median |log| ≈0,93–1,09) berada DI/BAWAH lantai itu.
  **Top 100 via keluarga model ini saja tampak tidak terjangkau** (DUGAAN,
  bukan kepastian) — radar-5 memperbaiki radar-4, tapi gap ke cutoff top 100
  (judge 953.929; PERKIRAAN judge radar-4 ~880k–930k) tetap besar.
- Target desain TETAP GAGAL: MAPE 802,70% (target <35%), targets.passed false.
- **Rekomendasi submit: YA, bila bos memutuskan submit radar-5** — radar-5
  menang jujur di semua metrik kedua set seed dan sudah terverifikasi
  penuh (determinisme 2 run identik, verify-board PASS sealed + fresh,
  3 screenshot dibaca sendiri). Tapi ekspektasi harus jujur: ini perbaikan
  inkremental yang nyata, BUKAN lompatan ke top 100. Keputusan submit tetap
  di tangan bos; worktree ini TIDAK submit apa pun.
