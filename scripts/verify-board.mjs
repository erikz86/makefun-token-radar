// verify-board.mjs — the gate's own checks, run locally on one out/ directory before
// every submit. It reads board.json, data.js and dossier.json plus the dashboard and
// screenshots the program copied, and fails loudly on the first problem.
//
// Usage:
//   node scripts/verify-board.mjs [out-dir] [snapshot.json]
// Defaults: out, the kit's sealed snapshot.
//
// What it checks, in the gate's own terms (reference/gate.json): the board has 100 to
// 4000 rows, ranks exactly 1..n, implied values non-increasing and not all equal, every
// watchlist slug present, every farm plan 3 to 12 steps of 20 to 600 characters; the
// dashboard is at most 400 files and 4 MiB with no network reference and its text under
// the 64 KiB dossier cap; 3 or 4 screenshots, each at most 512 KiB, long side at most
// 1440, short side at least 800; the dossier at most 1.5 MiB. It also re-derives the top
// five implied values from the snapshot figures in the page's own arithmetic, so a
// drift between the model and the dashboard is caught here, not by the judge.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const outDir = process.argv[2] ?? 'out';
const snapshotPath = process.argv[3] ?? null;

const failures = [];
function check(ok, message) {
  if (!ok) failures.push(message);
  return ok;
}
function bytes(n) {
  return `${(n / 1024).toFixed(1)} KiB`;
}

const board = JSON.parse(readFileSync(join(outDir, 'board.json'), 'utf8')).rows;
check(board.length >= 100 && board.length <= 4000, `board has ${board.length} rows, gate wants 100..4000`);
check(
  board.every((r, i) => r.rank === i + 1),
  'ranks are not exactly 1..n',
);
check(
  board.every((r, i) => i === 0 || r.implied_value_usd <= board[i - 1].implied_value_usd),
  'implied values are not non-increasing',
);
check(
  board.length < 2 || board[0].implied_value_usd !== board[board.length - 1].implied_value_usd,
  'all rows share one implied value',
);
const badSteps = board.filter(
  (r) => r.farm_steps.length < 3 || r.farm_steps.length > 12 || r.farm_steps.some((s) => s.length < 20 || s.length > 600),
);
check(badSteps.length === 0, `${badSteps.length} rows have farm steps outside 3..12 steps of 20..600 chars`);
const distinct = new Set(board.map((r) => r.implied_value_usd)).size;
check(distinct === board.length, `${board.length - distinct} rows share an implied value with another row`);

let snapshot = null;
if (snapshotPath) {
  snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  check(missing.length === 0, `board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`);
  check(board.length >= snapshot.watchlist.length, 'board is smaller than the watchlist');
}

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(join(outDir, 'data.js'), 'utf8'), ctx);
const data = ctx.window.RADAR;
check(data.rows.length === board.length, `data.js carries ${data.rows.length} rows, board.json ${board.length}`);
check(
  data.rows.every((r, i) => r.slug === board[i].slug && r.implied_value_usd === board[i].implied_value_usd),
  'data.js rows do not match board.json row for row',
);
check(
  Array.isArray(data.insights?.gainers) && data.insights.gainers.length === 5 && data.insights.efficient.length === 5,
  'insights are missing the movers or the efficient list',
);
check(
  data.rows.every((r) => Array.isArray(r.farm_steps) && r.farm_steps.length === board.find((b) => b.slug === r.slug).farm_steps.length),
  'data.js farm steps do not match board.json',
);

// The page's own arithmetic, re-derived here: TVL x multiple x growth x maturity x chains.
if (snapshot) {
  const m = data.model;
  for (const row of board.slice(0, 5)) {
    const growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d ?? 0));
    const growthMult = 1 + (growth / 100) * m.growth_weight;
    const age = row.age_days ?? m.unknown_age_days;
    const maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    const chainMult = 1 + m.chain_step * Math.min(Math.max(row.chains.length - 1, 0), m.chain_max);
    const recomputed = Math.max(1, Math.round(row.tvl_usd * row.model.category_multiple * growthMult * maturity * chainMult));
    check(recomputed === row.implied_value_usd, `#${row.rank} ${row.slug}: recomputed $${recomputed}, board says $${row.implied_value_usd}`);
  }
}

const dashDir = join(outDir, 'dashboard');
const dashFiles = readdirSync(dashDir).filter((f) => statSync(join(dashDir, f)).isFile());
check(dashFiles.length <= 400, `dashboard has ${dashFiles.length} files, gate allows 400`);
let dashBytes = 0;
let dashText = 0;
for (const f of dashFiles) {
  const buf = readFileSync(join(dashDir, f));
  dashBytes += buf.length;
  const text = buf.toString('utf8');
  dashText += Buffer.byteLength(text);
  check(!/https?:\/\//.test(text) && !/src\s*=\s*"http/.test(text), `dashboard/${f} references the network`);
}
check(dashBytes <= 4_194_304, `dashboard is ${bytes(dashBytes)}, gate allows 4 MiB`);
check(dashText <= 65_536, `dashboard text is ${bytes(dashText)}, dossier cap is 64 KiB`);

const shotDir = join(outDir, 'screenshots');
const shots = readdirSync(shotDir).filter((f) => statSync(join(shotDir, f)).isFile());
check(shots.length >= 3 && shots.length <= 4, `${shots.length} screenshots, gate wants 3 or 4`);
for (const f of shots) {
  const size = statSync(join(shotDir, f)).size;
  check(size <= 524_288, `screenshots/${f} is ${bytes(size)}, gate allows 512 KiB`);
}
// JPEG dimensions without a decoder: SOF0/SOF2 marker carries height and width.
for (const f of shots) {
  const buf = readFileSync(join(shotDir, f));
  let w = 0;
  let h = 0;
  for (let i = 2; i + 9 < buf.length; i++) {
    if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2)) {
      h = buf.readUInt16BE(i + 5);
      w = buf.readUInt16BE(i + 7);
      break;
    }
  }
  check(w > 0 && h > 0, `screenshots/${f}: no JPEG size marker found`);
  if (w > 0) check(Math.max(w, h) <= 1440 && Math.min(w, h) >= 800, `screenshots/${f} is ${w}x${h}, gate wants long side <=1440, short side >=800`);
}

const dossierSize = statSync(join(outDir, 'dossier.json')).size;
check(dossierSize <= 1_572_864, `dossier.json is ${bytes(dossierSize)}, gate allows 1.5 MiB`);

if (failures.length > 0) {
  process.stderr.write(`verify-board: FAIL (${failures.length})\n${failures.map((f) => `  - ${f}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(
  `verify-board: PASS — ${board.length} rows, ${dashFiles.length} dashboard files (${bytes(dashBytes)}, text ${bytes(dashText)}), ${shots.length} screenshots, dossier ${bytes(dossierSize)}\n`,
);
