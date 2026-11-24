# Laporan lompatan radar-6 — 24 Nov 2026

Perintah bos 24 Nov 19:00 WIB: "Buat lompatannya agar performa meningkat dan unggul
jadi leaderboard." Target: menutup gap ke cutoff top-100 (judge 953.929; kita 822.309;
gap +131.620, ~16%). TANPA submit, TANPA merge, TANPA push repo. Keputusan submit
tetap di tangan bos.

**Vonis di depan: lompatan model TIDAK ada.** Dari 30+ pendekatan yang berbeda secara
fundamental dan 18 kombinasi grid, TIDAK SATU PUN yang lolos aturan adopsi ketat
(menang di SEMUA metrik utama di KEDUA set seed). Yang ditemukan adalah recalibrasi
inkremental yang nyata dan signifikan secara statistik — slope tetap 0,55 + Huber
δ=0,05 — yang memperbaiki radar-5 sebesar ~1% pada typical miss dan ~8% pada MAPE.
Gap ke top 100 TIDAK tertutup. Yang masih kurang ada di §7.

## 1. Diagnosis yang harus dipecahkan (angka PASTI)

Dari radar-5 (4-fold × 8 seed, 1.024 prediksi): MAPE 802,70%, median |log| 1,22
(miss ×3,4), within 2x/5x 28,52%/60,94%, Spearman 0,42, konformal 90% ×25,25,
bias +727,72%. Target desain (<35% MAPE) GAGAL.

- **Lantai struktural.** SD ln(rasio mcap/TVL) dalam kategori 2,08 → prediktor
  rata-rata-kategori sempurna pun punya lantai median |log| ≈1,40 (estimasi dari
  SD; lebih buruk dari 1,28 radar-4). TVL hanya menjelaskan R²=0,19 varians
  ln(mcap). Oracle in-sample (CURANG, diagnosis saja — melihat token yang
  diprediksi): category-mean 1,099; category-MEDIAN 0,850; cat × TVL-band 1,004;
  cat × age-null 0,780; cat × TVLband × age-null 0,440 (sel terakhir overfit).
- **Hanya satu rezim yang bekerja.** Rasio 0,1–1 (48 comp): MAPE 65,33%, Spearman
  0,86. Di luar itu gagal dua arah: rasio <0,01 diprediksi median 33× terlalu
  tinggi; rasio >1 diprediksi 0,12× terlalu rendah.
- **MAPE didominasi outlier.** 10 outlier menyumbang 82,91% total APE;
  xdai-stake-bridge sendiri 44% (TVL $223,4M vs mcap $56K, rasio 0,00025).
- **Kategori terlemah:** Canonical Bridge (bimodal), Yield, Cross Chain Bridge.
- **Pemimpin leaderboard:** typical miss walk-forward ×2,53–2,97 (median |log|
  ≈0,93–1,09); board 192–198 baris; ada token odds + Brier, farm verdicts,
  ledger 758 protokol, tabel ablasi. Cutoff top-100 = 953.929 (rank 100
  amber-kestrel-87; rank 1 966.767; 18.752 entri); pita top-100 hanya 12.838
  poin lebarnya — gap kita >10× lipat pita itu.

## 2. Metode (agar angka ini bisa diulang)

- Harness Python yang sama dengan radar-5 (`sweep_r5.py` + `fold_assignments.json`
  dari `gen_folds.mjs` — JANGAN dihitung ulang di Python, sort string Python ≠
  JS localeCompare). Semua kandidat dinilai 4-fold × 8 seed (seleksi 1–4 +
  konfirmasi 5–8), 1.024 prediksi, metrik yang sama. Bootstrap berpasangan
  20.000×; walk-forward sebagai metrik sekunder.
- Harness TER VERIFIKASI mereproduksi radar-5 secara eksak sebelum sweep:
  ALL MAPE 802,70 / med|log| 1,22 / Spearman 0,42 / w2x 28,52 / w5x 60,94 /
  bias 727,72 / konformal ×25,25; SEL 816,33/1,27/0,41; CONF 789,07/1,20/0,42.
- Semua fitur HANYA dari 10 field sealed (TVL, change_7d, listed_at/umur +
  flag null, jumlah chain, kategori, mcap untuk kalibrasi). chainTvls DITOLAK
  (bukan field sealed) — tidak ada kandidat yang memakainya. Tanpa data luar.
- File kerja: `~/workspace/makefun/token-radar-r6-scratch/` — `eda.py`, `eda2.py`,
  `sweep_r6.py`, `sweep_r6b.py`, `sweep_r6c.py`, `sweep_r6d.py` (+ log + JSON
  hasil). Hasil ringkas disalin ke worktree ini: `sweep_r6_results.json`,
  `sweep_r6b_results.json`, `sweep_r6d_results.json`.

## 3. EDA — apa yang ada di data (dan apa yang tidak ada)

- **Umur tidak menjelaskan rasio.** 33/128 comp tanpa listed_at (null-age);
  korelasi umur vs ln(rasio) ≈ 0. Profil null-age: mean ln(rasio) −1,56 vs
  known −1,47 (level sama). Kategori terbanyak null-age: Canonical Bridge 6,
  Dexs 5, Lending 4, Yield Aggregator 4.
- **Pita TVL punya gradien kuat** (mean ln(rasio): <$25M −0,68; $25–100M −1,54;
  $100M–1B −2,42; >$1B −3,65). R² ln(rasio)~lnTVL 0,168; +kuadrat TIDAK menambah
  (0,168) — TIDAK ada kelengkungan, jadi slope tunggal sudah benar bentuknya.
- **Cross-tab TVL × rasio:** TVL <$25M: 25/59 rasio >1; TVL >$1B: 0/14 rasio
  >1, 11/14 di bawah 0,1. Rasio tinggi hanya ada di TVL kecil.
- **k-NN LOO** (analog protocol atas fitur sealed): median |log| 1,33–1,70 —
  LEBIH BURUK dari radar-5 (1,22). Kedekatan di ruang fitur tidak memprediksi
  rasio.
- **Identitas chain lemah.** chains[0]==Ethereum vs lain: −1,48 vs −1,51 (tidak
  ada sinyal). SD per chain 0,87–1,7 pada n kecil, tumpang tindih karena
  multi-chain.
- **Kesimpulan EDA:** tidak ada satu pun fitur sealed yang menjelaskan varians
  rasio DALAM kategori. In-sample oracle median (0,85) jauh di bawah apa pun
  yang transfer ke held-out (1,22) — keunggulan oracle TIDAK transfer karena
  128 comp yang noisy: model yang lebih fleksibel = overfit.

## 4. Ronde 1 — pendekatan yang berbeda secara fundamental (sweep_r6.py)

Semua angka pooled (MAPE / med|log| / Spearman). Radar-5: **802,70 / 1,22 / 0,42**.
TIDAK ADA yang lolos adopsi ketat.

| Kandidat | MAPE | med\|log\| | Spearman | Nasib |
|---|---:|---:|---:|---|
| MED-k10 (intercept median kategori) | 1089,84 | 1,29 | 0,39 | gagal |
| MED-k25 | 942,57 | 1,28 | 0,40 | gagal |
| MED-k50 | 886,71 | 1,28 | 0,40 | gagal |
| MED-k25+NULL (efek age-null) | 1410,77 | 1,31 | 0,36 | gagal |
| R5+NULL | 1203,19 | 1,28 | 0,37 | gagal |
| MED-k25+TVLB (geser pita TVL) | 1077,37 | 1,29 | 0,37 | gagal |
| MED-k25+NULL+TVLB | 1464,75 | 1,31 | 0,33 | gagal |
| REGIME-l2=1 (mixture 2 rezim) | 907,88 | 1,29 | 0,34 | gagal |
| REGIME-l2=10 | 833,75 | 1,28 | 0,34 | gagal |
| REGIME-hard | 1553,96 | 1,32 | 0,38 | gagal |
| RIDGE lam=1 / 10 / 100 | 4701,55 / 3952,81 / 2328,23 | 1,46 / 1,38 / 1,33 | 0,32 / 0,34 / 0,39 | gagal |
| RIDGE+mults | 2856,01 | 1,43 | 0,33 | gagal |
| GBM-t100 / t200 | 4047,66 / 4047,66 | 1,47 / 1,47 | 0,26 / 0,26 | gagal (angka identik di log — perlu dicek ulang bila dipakai) |
| Ensemble (5 kombinasi) | 1315–2246 | 1,27–1,38 | — | gagal |

**Pelajaran ronde 1:** intercept median (yang "seharusnya" lebih robust) kalah dari
mean Huber; efek age-null dan geser pita TVL MEMPERBURUK (oracle in-sample mereka
tidak transfer); mixture 2 rezim tidak bisa mengklasifikasi rezim dari fitur
sealed; ridge/GBM overfit 128 comp; ensemble dari model-model yang sama-sama
lemah tetap lemah.

## 5. Ronde 2 — slope, dekomposisi, dan grid fokus

### 5a. Varian slope (sweep_r6b.py)

- R4-OLS reproduksi eksak: SEL 967,81/1,29/0,39; CONF 943,88/1,27/0,40; ALL
  955,85/1,28/0,39; **walk-forward 0,92/0,86/1,00** — mengonfirmasi klaim
  COMPLIANCE-radar5.
- SLOPE-POOLED Huber δ=0,25: ALL MAPE 774,14 (lebih baik dari R5), med|log| 1,24
  (lebih buruk), Spearman 0,40, w2x 30,18, w5x 58,89, konformal ×26,01; WF
  1,13/1,09/1,13. GAGAL adopsi ketat.
- SLOPE-FIXED 0,55: ALL MAPE 746,49, med|log| 1,22 (seri pooled), Spearman 0,41,
  w2x 29,30, w5x 58,98, konformal ×25,87; WF 1,13/1,11/1,09. GAGAL adopsi ketat.
- SLOPE-FIXED 0,48: MAPE 737,10, med|log| 1,28. SLOPE-FIXED 0,40: MAPE 736,18,
  med|log| 1,34. Slope yang lebih kecil memperbaiki MAPE tapi merusak median —
  MAPE dan median |log| menarik ke arah berlawanan di bawah 0,55.
- Huber δ=0,05/0,10/0,15 (struktur R5): MAPE 784,42/787,19/791,13, med|log|
  1,23, Spearman 0,41 — kalah tipis med|log| + Spearman.
- PIECEWISE slope (2 slope per pita TVL): CATASTROPHIC — MAPE 251.388.122
  (slope per pita dari n≈30 meledak; konsep DITOLAK).
- R5 fit on known-age only: MAPE 769,28, med|log| 1,29. R5 no-maturity: MAPE
  987,55, med|log| 1,25 (maturity membantu). R5 no-growth: MAPE 843,26,
  med|log| 1,22 (growth membantu MAPE).

### 5b. Dekomposisi walk-forward (sweep_r6c.py)

- Random-CV known-age only (n=760): R4 med|log| 1,12 MAPE 605,12 Spearman 0,30;
  R5 med|log| 1,18 MAPE 511,39 Spearman 0,32 — comp null-age merugikan kedua
  model (~0,1–0,16 med|log|), dan di subset known-age R4 malah lebih baik
  med|log| dari R5 (keunggulan R5 di random-CV berasal dari comp null-age).
- Walk-forward detail: R4 0,92/0,86/1,00; R5 1,20/1,23/1,21. Per-comp WF 1/2:
  R4 lebih baik pada 26/48 comp, median diff hanya −0,04 — keunggulan WF R4
  didorong segelintir comp (solstice −1,24; yield-basis −1,04; anvil −0,98);
  sampling error kecil kemungkinan berperan.
- **Super-group pooling adalah penyebab WF buruk:** R4+super WF 1,08/1,37/1,01
  (vs R4 0,92/0,86/1,00 — memburuk tajam); R4 chain0 WF 0,96/0,85/1,00 (chain
  ~netral); R5 super-OFF WF 0,81/1,07/1,23 (lebih baik dari R5 di 1/3 dan 1/2);
  R5 chain0.03 WF 1,23/1,23/1,21 (chain tidak berpengaruh). **Super-group
  intercepts membantu random-CV (train 96 comp) tapi merusak walk-forward
  (train 31–63 comp, kategori tipis meminjam intercept super-group yang tidak
  menggeneralisasi ke token baru).** Ini temuan struktural terpenting ronde 2 —
  tapi mematikan super-group JUGA merusak random-CV, jadi tidak ada jalan
  menang di kedua protokol sekaligus dari sini.
- **Board top-5 DENGAN filter rankability (TANPA floor $50M, 198 baris — hanya
  pembanding antar model, BUKAN board yang dikirim):** R5: Steakhouse $131,6M,
  Sentora $126,3M, Gauntlet $93,9M, Veda $90,6M, USDD $68,6M, total $2,06B.
  SLOPE-POOLED Huber: Steakhouse $71,2M, Sentora $68,3M, Gauntlet $55,3M,
  Veda $53,4M, USDD $42,7M, total $1,75B. SLOPE-FIXED 0,48: Steakhouse $60,0M,
  total $1,70B. SLOPE-FIXED 0,55: Steakhouse $79,6M, total $1,80B.
  **Slope tetap 0,55 menempatkan nilai teratas di rentang kalibrasi pemimpin
  (rank 1 $68,7M; rank 7 $73,1M; rank 100 $90,2M)** — radar-5 ($131,6M) berada
  di atas semuanya.

### 5c. Grid fokus slope × Huber δ × super-group (sweep_r6d.py, 18 kombinasi)

**Strict-adoption passes: [] (0/18).** Terbaik: **slope=0,55, δ=0,05, super=on**:

| | SEL | CONF |
|---|---|---|
| Radar-6 (0,55 / 0,05 / on) | MAPE 749,39; med 1,24; Spear 0,41; w2x 28,52; w5x 59,38; conf ×24,88 | MAPE 729,57; med 1,22; Spear 0,42; w2x 29,69; w5x 58,01; conf ×24,28 |
| Radar-5 | MAPE 816,33; med 1,27; Spear 0,41; w2x 28,13; w5x 61,13; conf ×24,32 | MAPE 789,07; med 1,20; Spear 0,42; w2x 28,91; w5x 60,74; conf ×24,28 |

Pooled: MAPE 739,48% (R5 802,70%), med|log| 1,22 (seri), Spearman 0,41 (R5 0,42),
w2x 29,10% (R5 28,52%), w5x 58,69% (R5 60,94%), konformal ×24,78 (R5 ×25,25),
bias +664,53% (R5 +727,72%). **Paired bootstrap 20.000× (radar-6 vs radar-5):
d median|log| mean −0,013, 95% CI [−0,022, −0,005], P(lebih baik) 1,00 —
SIGNIFIKAN; d MAPE mean −63,5, 95% CI [−121,5, −16,1], P 1,00 — SIGNIFIKAN.**
Walk-forward: 1,13/1,10/1,09 (lebih baik dari R5 di semua cutoff).

Jadi kandidat terbaik ini menang SIGNIFIKAN di 2 metrik headline + walk-forward +
kalibrasi nilai teratas, tapi GAGAL aturan adopsi ketat (kalah within-5x di kedua
set, seri Spearman, kalah med|log| CONF + konformal SEL). Ia di-ship sebagai
radar-6 dengan label JUJUR ini — bukan sebagai pelolos adopsi.

## 6. Radar-6 yang di-ship (worktree token-radar-r6)

- **Model:** slope TETAP 0,55 (bukan fitted) + Huber IRLS δ=0,05 + super-group
  intercepts (thin cats) + shrink k=25 + growth 0,5 + maturity on + chain_step 0.
  Port TypeScript di `lib/model.ts` (parameter `fixed_slope` baru); validasi TS
  mereproduksi angka Python grid sampai 2 desimal di semua metrik pooled.
- **Angka resmi (sealed 14 Nov, 4-fold × 8 seed, 1.024 prediksi):** MAPE 739,48%,
  median |log| 1,22 (×3,4), within 2x/5x 29,10%/58,69%, Spearman 0,41, konformal
  90% ×24,78, bias +664,53%. Split 50/50: MAPE 733,11%, med|log| 1,22, Spearman
  0,42. **targets.passed: false** (MAPE 739,48% vs target <35%; hanya RWA lolos
  ambang kategori besar, 49,74% ≤ 60%).
- **Board (floor $50M, 178 baris):** Steakhouse $79,6M, Gauntlet $60,9M, Veda
  $58,8M, USDD $46,8M, Upshift $35,3M; total $1,43B. Fresh 19 Nov: 176 baris,
  top-4 sama, MAPE 776,10%, med|log| 1,26, Spearman 0,42.
- **Verifikasi:** determinisme validasi 2 run byte-identik (sha256
  `8df00bfa…`); determinisme build board 2 run byte-identik (board.json
  `0753d62a…`, data.js `88921085…`); verify-board PASS snapshot sealed 14 Nov
  (178 baris) + segar 19 Nov (176 baris); 3 screenshot dibaca sendiri (board
  178 baris/$1,43B/$79,6M; detail Steakhouse slope 0,5500, range $3,2M–$1,97B;
  validation MAPE 739,48%, ×3,4).
- **GPU:** kernel `hermansmithz/makefun-token-radar-r6-leap-sweep` (T4) di-push 24 Nov
  ~19:24 WIB; status terverifikasi langsung ~19:28 WIB: UNKNOWN (antre, belum ada
  output). Konfirmasi GPU masih PENDING (kernel radar-5 masih UNKNOWN setelah
  >2 jam antre). Angka laporan dari run lokal CPU yang identik; skrip kernel
  yang sama dijalankan lokal untuk verifikasi rakitan dan mereproduksi angka
  scratch. Catat di `RENDER-JOBS.md`.

## 7. Vonis jujur + apa yang masih kurang

**Apakah lompatan ini menutup gap ke top 100? TIDAK.** Perbaikan radar-6 atas
radar-5 adalah ~1% (median |log|) sampai ~8% (MAPE); gap ke cutoff top-100
adalah ~16% (judge 822.309 → 953.929, +131.620). Bahkan bila perbaikan ini
diterjemahkan 1:1 ke skor juri (PERKIRAAN, bukan klaim), kita tetap jauh dari
cutoff. Tiga hal yang masih kurang — dan tidak satu pun bisa dipecahkan dari
dalam 10 field sealed:

1. **Fitur penjelas varians rasio dalam kategori.** In-sample oracle median
   (0,85) vs held-out terbaik (1,22): ada sinyal yang tidak tertangkap fitur
   sealed. Kandidat yang diizinkan S&K sudah habis diuji; yang tersisa
   (chainTvls, data luar) DITOLAK oleh S&K — bukan karena tidak dicoba, tapi
   karena tidak boleh dipakai.
2. **Fitur presentasi pemimpin.** Token odds + Brier, farm verdicts berkos,
   ledger 758 protokol, tabel ablasi — ini memengaruhi skor juri lewat kriteria
   selain model (kelengkapan, kejujuran, kegunaan). Radar-6 tidak menambahnya
   (model dulu, presentasi kedua; dan modelnya tidak lolos adopsi ketat).
   Bila bos mau, ini ronde berikutnya yang sah: bangun presentasi itu di atas
   model radar-6 dan ukur lewat submit.
3. **Skor juri nyata.** Semua angka di atas adalah validasi held-out, BUKAN skor
   juri. Satu-satunya cara mengukur posisi sebenarnya adalah submit (radar-5
   atau radar-6) dan membaca skor yang keluar. Keputusan submit di tangan bos.

**Rekomendasi:** bila bos memutuskan submit untuk mengukur skor juri, bawa
radar-6 (bukan radar-5): perbaikan signifikan secara statistik, walk-forward
lebih baik, dan nilai teratas terkalibrasi seperti pemimpin. Ekspektasi harus
jujur: ini perbaikan inkremental yang nyata, BUKAN lompatan ke top 100.
