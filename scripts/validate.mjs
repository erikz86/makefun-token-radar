// validate.mjs — run the held-out validation (lib/validation.ts) on one snapshot and write
// validation_report.json beside this script's repository root. The same numbers are embedded
// in data.js by main.ts (buildRadar); this file is the auditable, human-readable copy.
//
// Usage:
//   node scripts/validate.mjs [snapshot.json] [out.json]
// Defaults: the kit's sealed snapshot, ./validation_report.json
//
// The validation is deterministic (fixed seeds, seeded PRNG): re-running it on the same
// snapshot writes byte-identical JSON.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSnapshot, impliedValue, MODEL, buildBoard } from '../lib/model.ts';
import { validateSnapshot } from '../lib/validation.ts';

const here = dirname(fileURLToPath(import.meta.url));
const snapshotPath = process.argv[2] ?? '/home/hatch/workspace/makefun/token-radar-01-kit/input/snapshot.json';
const outPath = process.argv[3] ?? join(here, '..', 'validation_report.json');

const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
const liveComps = snapshot.protocols
  .filter((p) => (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0)
  .map((p) => ({
    slug: p.slug,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
  }));

const { report } = validateSnapshot({
  comps: liveComps,
  asOf: snapshot.as_of,
  compMin: MODEL.comp_min,
  predict: (comp, multiples) => impliedValue(comp, snapshot.as_of, multiples, MODEL).implied,
  buildBoardWithFloor: (floorUsd) => {
    const b = buildBoard({ ...snapshot, floor_usd: floorUsd }, MODEL);
    return { rows: b.length, totalImpliedUsd: b.reduce((n, r) => n + r.implied_value_usd, 0), top5: b.slice(0, 5).map((r) => r.slug) };
  },
});

const doc = {
  generated_from: snapshotPath,
  snapshot_as_of: snapshot.as_of,
  snapshot_source: snapshot.source,
  model_version: 'radar-3',
  validation: report,
};
writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
process.stdout.write(
  `validation: ${report.live_comps} live comps, ${report.held_out_predictions} held-out predictions, ` +
    `overall MAPE ${report.overall.mape_pct}% (median ${report.overall.median_abs_pct}%, median |log| ${report.overall.median_abs_log}, Spearman ${report.overall.spearman_rank}), ` +
    `conformal 90% global factor x${report.conformal.global_q90_factor}, targets passed: ${report.targets.passed}\n` +
    `validation: wrote ${outPath}\n`,
);
