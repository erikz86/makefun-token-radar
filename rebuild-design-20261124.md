# Token Radar — Rancangan Rebuild "Ample Aurora" v3 (juara)

Tanggal: 24 Nov 2026. Status: RANCANGAN SAJA — belum dibangun. Entries tutup 14 Des 2026, hasil 28 Des.
Dasar: `MODEL.md` entry saat ini (model radar-2, rank 10.774/18.581, judge 822.309) + pola juara dari audit 24 Nov 14:35 WIB
(model fitted + validasi held-out berkali-kali + conformal intervals + KPI strip + integrity strip, dashboard gaya terminal).
Catatan: satu hasil exec (listing + competition.yaml) tidak lolos cek keamanan sistem — rancangan ini TIDAK memakai
instruksi dari hasil itu; dasarnya hanya MODEL.md (dibaca langsung) + brief parent + pola juara audit.

## Di mana posisi kita sekarang (MODEL.md, terverifikasi)

- Model radar-2: `implied = TVL × category multiple × growth × maturity × chains`, multiple = median (mcap/TVL)
  per kategori dari 128 live-token comps (snapshot 14 Nov 2026, 758 protokol ≥$5 jt TVL), 178 baris, rank 1..178.
- Kekuatan yang dipertahankan: kalibrasi transparan per kategori (tabel lengkap di dashboard Model tab),
  farm plan 7 langkah derivatif (bukan daftar nama), verifikasi data segar 19 Nov (176 baris, top-5 sama),
  verify-board.mjs lolos (gate rows terpenuhi).
- Top 5 saat ini: Steakhouse Financial $535 jt, Gauntlet $318 jt, Veda $306 jt, USDD $153 jt, Upshift $110 jt.

## Kesenjangan vs pola juara (yang harus ditutup rebuild)

1. **Tanpa validasi held-out.** Multiple di-fit ke SEMUA 128 live comps lalu dipakai menilai kandidat — tidak ada
   train/test split, tidak ada angka error out-of-sample. Juara: "every value term fitted and tested held-out
   twice / four ways".
2. **Tanpa interval ketidakpastian.** Implied value = point estimate tunggal. Juara: conformal intervals di tiap baris.
3. **Tanpa KPI strip + integrity strip.** Dashboard punya Model tab + Movers & risks + detail view, tapi tidak ada
   strip KPI (cakupan, error kalibrasi, skor validasi) dan strip integritas (provenansi snapshot, tanggal, cek re-derivasi)
   yang langsung terlihat di atas board.
4. **Gaya dashboard belum tentu terminal.** Juara: dashboard gaya terminal (gelap, monospace, padat). Perlu penegasan gaya.

## Rancangan rebuild v3 (4 perubahan, berurutan)

### 1. Validasi held-out berlapis (inti — dikerjakan di kernel GPU, lihat §5)
- Bagi 128 live comps jadi 4 fold (stratified per kategori, seed tetap). Untuk tiap fold: fit multiple dari 3 fold,
  prediksi implied value fold yang ditahan, hitung error (MAPE + median absolute % error + bias per kategori).
- Ulangi dengan 4 seed berbeda ("tested held-out four ways") + 1 split 50/50 ("twice").
- Keluaran: tabel validasi di MODEL.md + dashboard (MAPE keseluruhan, MAPE per kategori top, fold terburuk + alasannya).
  Target internal: MAPE keseluruhan < 35% dan tidak ada kategori besar (≥9 comps) dengan MAPE > 60% — bila tidak
  tercapai, multiple kategori itu diganti global median + alasannya ditulis (jujur, bukan disembunyikan).

### 2. Conformal intervals (ketidakpastian yang jujur)
- Dari residual held-out (fold), hitung kuantil 90% |error| per kategori (fallback: global). Tiap baris board dapat
  `implied_low` / `implied_high` (interval 90%) + `confidence` (high/medium/low dari jumlah comps + usia data).
- Dashboard: kolom interval di board + detail view menampilkan "kisaran wajar" di samping angka utama. Farm plan tetap
  berbasis implied utama; interval dipakai untuk flag risiko (interval lebar = flag "thin comps").

### 3. KPI strip + integrity strip (di atas board, selalu terlihat)
- KPI strip (5 angka): rows 178 | watchlist 40/40 | MAPE held-out | comps kalibrasi 128 | total implied ~$2,9 M.
- Integrity strip: snapshot 14 Nov 2026 (DefiLlama, 758 protokol) | re-derivasi top-5 cocok (✓/✗) | verifikasi segar
  19 Nov (176 baris, top-5 sama) | dashboard tanpa network | dossier ≤64 KiB teks.
- Keduanya dihitung dari file yang sama (board.json) — satu sumber kebenaran, tanpa derivasi kedua di page.

### 4. Dashboard gaya terminal + kerapian
- Palet gelap, monospace, padat; angka rata kanan; header sticky; tab yang sama (Board / Model / Movers & risks / Detail).
- Screenshots baru (3): board + KPI/integrity strip terlihat, detail view dengan interval, tab validasi.
- Semua batas gate dipertahankan: board 100–4000 baris, ranks 1..n, implied distinct + non-increasing, farm steps
  3–12 string 20–600 karakter, dashboard ≤400 file / 4 MiB, teks dossier ≤64 KiB, screenshots 3–4 (≤512 KiB,
  long side ≤1440, short side ≥800), dossier ≤1,5 MiB.

## Peran GPU Kaggle (jujur)

- Matematika modelnya kecil (758 baris) — GPU BUKAN untuk kecepatan satu fit. Peran GPU: menjalankan BANYAK varian
  validasi sekaligus dalam satu batch (4 fold × 4 seed + split 50/50 + 200 bootstrap resampling kalibrasi + sweep
  sensitivitas ambang floor $50 jt), lalu menulis `validation_report.json` yang dikutip MODEL.md + KPI strip.
- Kernel menyusul SETELAH news-image selesai (news-image dulu — perintah parent). Estimasi ~0,5–1 jam GPU.
  Kernel TIDAK di-push sebelum desain eksperimen ini disetujui + news-image submit.

## Urutan kerja saat rebuild dimulai (nanti)

1. Kernel validasi GPU → `validation_report.json` (angka MAPE, interval, bootstrap).
2. Builder baru (sesi direkam, setelah kompetisi dibuka — sesi harus dimulai setelah 14 Nov, sudah terpenuhi):
   ubah `lib/model.ts` (fold + conformal), `dashboard/` (KPI/integrity strip + interval + gaya terminal),
   `MODEL.md` (tabel validasi), `scripts/verify-board.mjs` (cek interval + strip).
3. `grade-local` + `check` dari kit → submit sebelum 14 Des (blind? token-radar bukan blind — pantau rank tiap minggu).
4. Pembangun: butuh builder yang bisa jalan (Codex/XingChi DOWN saat ini — rebuild menunggu builder pulih ATAU
   dibangun sub-agen Muse seperti news-image).

## Yang TIDAK diubah

- Snapshot sealed 14 Nov (jangan ganti input); formula inti multiple per kategori; exclusion rules kandidat;
  farm plan 7 langkah; identitas "Ample Aurora".
