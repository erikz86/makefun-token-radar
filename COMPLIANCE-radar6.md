# Kepatuhan S&K — radar-6 (worktree token-radar-r6)

Tanggal: 24 Nov 2026. Batas keras bos 24 Nov 17:55 WIB: sistem + skills WAJIB
sesuai S&K kompetisi. Dokumen ini mencatat pemeriksaan competition.yaml yang
dilakukan sebelum sweep GPU radar-6 di-push, dan keputusan yang diambil.
Perintah bos 24 Nov 19:00 WIB: "Buat lompatannya agar performa meningkat dan
unggul jadi leaderboard" — TANPA submit, TANPA merge, TANPA push repo.

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
  network. Kandidat ini tidak diuji di sweep radar-6, sama seperti di radar-5.
- **DITOLAK: semua data luar lainnya** (audit, twitter, change_1d/1h,
  tokenBreakdowns, deskripsi, dsb.) dengan alasan yang sama.
- **DIIZINKAN: hanya fitur dari sepuluh field sealed** — TVL, change_7d,
  listed_at (umur + flag null), jumlah chains, kategori, mcap (kalibrasi saja).
  Semua kandidat sweep radar-6 memakai fitur ini saja: median intercepts,
  age-null, TVL-band, regime mixture (fitur: ln TVL, kategori bridge/staking,
  flag null-age, change_7d, jumlah chain), ridge, GBM, ensemble, grid slope
  tetap × Huber δ × super-group. Tidak satu pun memakai chainTvls atau data luar.
- **Snapshot segar 19 Nov 2026 HANYA untuk verifikasi lokal** (praktik radar-4/5:
  `verify-board` pada snapshot segar membuktikan model tidak bergantung pada
  satu file). Snapshot segar TIDAK dipakai sebagai input fit, TIDAK melatih
  model, TIDAK mengganti snapshot sealed, dan TIDAK masuk ke program graded.
  Bila ini dianggap ragu, yang diverifikasi hanyalah ketahanan — angka laporan
  tetap dari snapshot sealed 14 Nov.
- **Token odds / farm verdicts berkos / ledger / tabel ablasi** — hanya
  ditulis/diklaim bila benar-benar dibangun dan terverifikasi di worktree ini;
  tidak ada klaim atas fitur yang belum ada. Radar-6 TIDAK menambah fitur
  presentasi itu: model dulu, presentasi kedua — dan modelnya tidak lolos
  adopsi ketat, jadi tidak ada presentasi baru yang dibangun di atasnya.

## Aturan pelaporan (diterapkan di laporan akhir)

- Angka validasi dilaporkan persis seperti hasil ukur (MAPE, median |log|,
  within-2x/5x, Spearman, konformal, bias). Target gagal = gagal.
- Angka "buang outlier" / oracle in-sample HANYA berlabel DIAGNOSIS, tidak pernah
  jadi angka laporan dan tidak menggantikan MAPE resmi.
- Setiap angka estimasi diberi label PERKIRAAN yang jelas dan dipisah dari
  angka ukur. Posisi leaderboard hanya dari skor juri/server yang sudah keluar.
  Tidak ada klaim skor juri/posisi leaderboard untuk radar-6 — hanya perkiraan
  yang dilabeli PERKIRAAN.
- Adopsi: hanya model yang menang di SEMUA metrik utama di KEDUA set seed
  (seleksi 1–4 dan konfirmasi 5–8). Seri pada satu metrik = gagal adopsi ketat.
  **Radar-6 TIDAK lolos aturan ini** (lihat bawah) — dan dokumen ini mengatakannya
  di depan, bukan di footnote.

## Status sweep + GPU

- Kernel `hermansmithz/makefun-token-radar-r6-leap-sweep` (T4) di-push 24 Nov ~19:24 WIB
  (skrip `sweep_r6_kernel.py`, dirakit dari `sweep_r5.py` + `sweep_r6.py` +
  `sweep_r6d.py`; CATATAN: slug aktual di Kaggle berasal dari judul kernel,
  "Makefun Token Radar R6 Leap Sweep", bukan dari `id` di kernel-metadata.json).
  Push terkonfirmasi: POST /kernels/push HTTP 200, version 1,
  ref `/code/hermansmithz/makefun-token-radar-r6-leap-sweep`
  (https://www.kaggle.com/code/hermansmithz/makefun-token-radar-r6-leap-sweep);
  peringatan kosmetik: semua tag ditolak server (invalid tags, sama seperti
  kernel news-image). Poll `run` timeout setelah 600 dtk dengan status terakhir
  UNKNOWN. Status terverifikasi langsung ~19:28 WIB via `kaggle_kernel.py status`:
  **UNKNOWN (antre, belum ada output)** — sama seperti kernel radar-5 yang masih
  UNKNOWN setelah >2 jam antre. Konfirmasi GPU r6 kemungkinan juga lama.
- Skrip kernel yang sama dijalankan lokal di CPU untuk verifikasi rakitan
  (`/tmp/r6-kernel-local/`): hasilnya mereproduksi angka scratch (lihat
  `leap-report-radar6.md` § verifikasi). **Konfirmasi GPU masih PENDING.**
  Angka di bawah ini berasal dari **run lokal CPU yang identik** (skrip yang
  sama, folds dan snapshot yang sama). Port TypeScript radar-6 di worktree ini
  mereproduksi angka Python grid sampai 2 desimal di semua metrik pooled
  (MAPE 739,48% persis; median |log| 1,22; Spearman 0,41; within-2x 29,10%;
  within-5x 58,69%; konformal ×24,78) — jadi angka lokal ini dapat dipercaya
  sebagai hasil sweep, dengan catatan konfirmasi GPU menyusul bila kernel selesai.
- TIDAK ada submit, claim, push repo, atau merge ke repo utama dari worktree ini.

## Hasil sweep + adopsi (24 Nov 2026)

**TIDAK ADA kandidat yang lolos aturan adopsi ketat** — 0 dari 30+ pendekatan
di ronde 1 (median intercepts, age-null, TVL-band, regime mixture, ridge, GBM,
ensemble) dan 0 dari 18 kombinasi di grid ronde 2d (slope × Huber δ ×
super-group). Radar-5 (802,70 / 1,22 / 0,42) tetap terbaik pooled di ronde 1;
grid ronde 2d menemukan satu-satunya perbaikan yang signifikan secara statistik:

| Kandidat | SEL MAPE / med\|log\| / Spear / w2x / w5x / conf | CONF MAPE / med\|log\| / Spear / w2x / w5x / conf | Pooled MAPE / med\|log\| / Spear |
|---|---|---|---|
| **GRID slope=0,55, δ=0,05, super=on (radar-6)** | **749,39 / 1,24 / 0,41 / 28,52 / 59,38 / ×24,88** | **729,57 / 1,22 / 0,42 / 29,69 / 58,01 / ×24,28** | **739,48 / 1,22 / 0,41** |
| Radar-5 (C2b, baseline) | 816,33 / 1,27 / 0,41 / 28,13 / 61,13 / ×24,32 | 789,07 / 1,20 / 0,42 / 28,91 / 60,74 / ×24,28 | 802,70 / 1,22 / 0,42 |

Radar-6 menang MAPE di kedua set, menang median |log| di SEL tapi kalah di CONF,
seri Spearman di kedua set, dan KALAH within-5x di kedua set (59,38 vs 61,13;
58,01 vs 60,74) — maka **gagal adopsi ketat**. Rincian semua 30+ kandidat ada di
`sweep_r6_results.json`, `sweep_r6b_results.json`, `sweep_r6d_results.json` dan
`leap-report-radar6.md`.

**Kejujuran yang wajib ikut di laporan (bukan footnote):**

- Perbaikan median |log| dan MAPE SIGNIFIKAN pada 95%: paired bootstrap 20.000×
  (pooled seeds 1–8) radar-6 vs radar-5: d median|log| −0,013, 95% CI
  [−0,022, −0,005], P(lebih baik) 1,00; d MAPE −63,5 poin, 95% CI [−121,5, −16,1],
  P(lebih baik) 1,00. Jadi recalibrasi ini nyata, bukan noise — tapi KECIL
  (~1% pada typical miss, ~8% pada mean) dan tidak memperbaiki metrik yang
  kalah (within-5x).
- Walk-forward (sekunder): radar-6 MENANG dari radar-5 pada median |log| di
  SEMUA cutoff (1/3: 1,13 vs 1,20; 1/2: 1,10 vs 1,23; 2/3: 1,09 vs 1,21), tapi
  MASIH KALAH dari radar-4 (0,92/0,86/1,00). Set kecil (31–63 train), 33 comp
  tanpa listed_at ter-exclude — dilaporkan sebagai caveat.
- Lantai keluarga model ini (oracle in-sample, CURANG — diagnosis saja):
  category-MEDIAN median |log| 0,85; category-mean 1,10. Miss khas pemimpin
  leaderboard (×2,53–2,97 → median |log| ≈0,93–1,09) berada DI ATAS lantai
  median-oracle tapi DI BAWAH lantai mean-oracle — artinya top 100 butuh model
  yang mendekati oracle median, dan 30+ pendekatan yang diuji TIDAK ada yang
  mendekat (terbaik held-out 1,22 vs oracle 0,85). **Top 100 via pendekatan
  yang diuji di ronde ini tampak tidak terjangkau** (DUGAAN, bukan kepastian) —
  radar-6 memperbaiki radar-5, tapi gap ke cutoff top 100 (judge 953.929; kita
  822.309; gap +131.620, ~16%) tetap besar: perbaikan radar-6 ~1–8% vs gap 16%.
- Nilai teratas board radar-6 SEKARANG terkalibrasi seperti pemimpin: Steakhouse
  $79,6M (radar-5: $131,6M); pemimpin menunjukkan $68,7M (rank 1), $73,1M
  (rank 7), $90,2M (rank 100). Total board $1,43B (178 baris, floor $50M).
- Target desain TETAP GAGAL: MAPE 739,48% (target <35%), targets.passed false.
  Hanya RWA yang lolos ambang kategori besar (49,74% ≤ 60%).
- **Rekomendasi submit: keputusan di tangan bos.** Radar-6 adalah model
  terbaik yang terverifikasi dari ronde lompatan — recalibrasi inkremental yang
  nyata dan signifikan secara statistik, BUKAN lompatan ke top 100 — dan sudah
  terverifikasi penuh (determinisme 2 run byte-identik untuk validasi dan build
  board, verify-board PASS sealed 14 Nov + segar 19 Nov, 3 screenshot dibaca
  sendiri). Bila bos memutuskan submit untuk mengukur skor juri yang sebenarnya,
  radar-6 adalah kandidat yang dibawa (bukan radar-5), karena nilai teratasnya
  terkalibrasi seperti pemimpin dan walk-forward-nya lebih baik. Tapi ekspektasi
  harus jujur: ini TIDAK menutup gap ke top 100. Worktree ini TIDAK submit apa pun.
