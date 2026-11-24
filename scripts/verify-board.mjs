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

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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

// radar-3: every board row carries a conformal interval + a confidence flag, and the
// validation object in data.js matches validation_report.json at the repo root.
for (const r of board) {
  check(typeof r.implied_low_usd === 'number' && typeof r.implied_high_usd === 'number', `board row ${r.slug}: missing interval`);
  check(
    r.implied_low_usd > 0 && r.implied_low_usd <= r.implied_value_usd && r.implied_value_usd <= r.implied_high_usd,
    `board row ${r.slug}: interval does not bracket the point estimate (${r.implied_low_usd}, ${r.implied_value_usd}, ${r.implied_high_usd})`,
  );
  check(['high', 'medium', 'low'].includes(r.confidence), `board row ${r.slug}: confidence ${String(r.confidence)}`);
}
check(data.validation !== undefined, 'data.js has no validation object');
if (data.validation) {
  const v = data.validation;
  // Snapshot-relative, not hardcoded: the fresh 19 Nov snapshot has 121 live comps, so its
  // held-out count is 484, not the sealed snapshot's 512. Each live comp is held out once
  // per seed (4 seeds).
  const expectedComps = snapshot ? snapshot.protocols.filter((p) => (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0).length : 128;
  check(v.live_comps === expectedComps, `validation live_comps ${v.live_comps} (expected ${expectedComps} from the snapshot)`);
  check(v.held_out_predictions === expectedComps * 4, `validation held_out_predictions ${v.held_out_predictions} (expected ${expectedComps * 4})`);
  check(v.targets !== undefined && typeof v.targets.passed === 'boolean', 'validation targets missing');
  check(v.targets.passed === false, 'validation targets.passed must be false (both targets measured as failed)');
  check(v.note !== undefined && v.note.includes('xdai-stake-bridge'), 'validation note must name the outlier driver');
  check(Array.isArray(v.per_category) && v.per_category.length >= 30, `validation per_category ${Array.isArray(v.per_category) ? v.per_category.length : 0} rows (expected >=30)`);
  check(
    v.floor_sweep !== undefined && v.floor_sweep.length === 3 && v.floor_sweep.every((f) => f.top5_slugs.join(',') === v.floor_sweep[0].top5_slugs.join(',')),
    'floor sweep must show the same top five at $25M/$50M/$100M',
  );
}
const reportPath = join(process.cwd(), 'validation_report.json');
if (existsSync(reportPath)) {
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const rv = report.validation;
  // The report belongs to the sealed 14 Nov snapshot; a fresh snapshot's data.js must not
  // match it, so the match is enforced only when the snapshots agree.
  if (snapshot && report.snapshot_as_of && snapshot.as_of === report.snapshot_as_of) {
    check(
      rv !== undefined && rv.overall !== undefined && data.validation !== undefined &&
        rv.overall.mape_pct === data.validation.overall.mape_pct &&
        rv.conformal.global_q90_factor === data.validation.conformal.global_q90_factor,
      'validation_report.json does not match the validation object in data.js',
    );
  }
} else check(false, 'validation_report.json missing at the repo root');
check(data.model_version === 'radar-3', `model_version ${data.model_version} (expected radar-3)`);

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

// radar-3: the dashboard must render the new pieces — a KPI strip, an integrity strip, the
// 90% range column and the Validation tab (checked in the shipped text, not by running a browser).
const appJs = readFileSync(join(dashDir, 'app.js'), 'utf8');
const appCss = readFileSync(join(dashDir, 'app.css'), 'utf8');
check(/strip kpi/.test(appJs) && /strip integrity/.test(appJs), 'dashboard app.js: KPI/integrity strips missing');
check(/90% range/.test(appJs), 'dashboard app.js: interval column missing');
check(/renderValidation/.test(appJs) && /'validation', 'Validation'/.test(appJs), 'dashboard app.js: validation tab missing');
check(/conf-high/.test(appCss) && /conf-low/.test(appCss), 'dashboard app.css: confidence badges missing');
check(/position: sticky/.test(appCss), 'dashboard app.css: sticky table header missing');

const dossierSize = statSync(join(outDir, 'dossier.json')).size;
check(dossierSize <= 1_572_864, `dossier.json is ${bytes(dossierSize)}, gate allows 1.5 MiB`);

if (failures.length > 0) {
  process.stderr.write(`verify-board: FAIL (${failures.length})\n${failures.map((f) => `  - ${f}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(
  `verify-board: PASS — ${board.length} rows, ${dashFiles.length} dashboard files (${bytes(dashBytes)}, text ${bytes(dashText)}), ${shots.length} screenshots, dossier ${bytes(dossierSize)}\n`,
);
