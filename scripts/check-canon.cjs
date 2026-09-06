'use strict';
// Read-only verification against the user's checked-in novel. Never downloads or rewrites it.
const fs = require('node:fs');
const path = require('node:path');
const S = require('../src/simulation.js');
const root = path.resolve(__dirname, '..');
const checks = [
  ['opening', ['古月方源', '青茅山', '古月山寨', '学堂']],
  ['academy', ['空窍', '元海', '古月方正', '青铜真元']],
  ['relic', ['酒虫', '竹林', '河滩', '石缝']],
  ['market', ['商队', '青茅山', '提前到来']],
  ['auction', ['贾富', '拍卖会']],
  ['wolf', ['狼潮', '三寨联盟', '古月山寨']],
  ['tournament', ['三族大比武', '索赔', '熊家寨']],
  ['investigation', ['铁血冷', '铁若男', '青茅山']]
];
const failures = [];
let total = 0;
for (const [id, terms] of checks) {
  const source = S.SOURCE_NOTES[id];
  const file = path.resolve(root, source.source);
  if (!file.startsWith(root + path.sep)) { failures.push(`Invalid source path: ${source.source}`); continue; }
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { failures.push(`Missing source: ${source.source}`); continue; }
  for (const term of terms) { total += 1; if (!text.includes(term)) failures.push(`Not found: ${term} in ${source.source}`); }
}
if (failures.length) { console.error([...new Set(failures)].join('\n')); process.exitCode = 1; }
else console.log(`PASS: ${total} novel term/source checks across ${checks.length} source chapters. This verifies wording, not fictional plot or numerical rules.`);
