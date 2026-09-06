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
  ['investigation', ['铁血冷', '铁若男', '青茅山']],
  ['whiteBone', ['白骨山']],
  ['merchantCity', ['商家城', '铁若男']],
  ['threeKings', ['三王传承', '三叉山']],
  ['heavenClimb', ['天梯山', '狐仙福地']],
  ['northernWar', ['北原', '黑盟大军', '黑楼兰', '王帐']],
  ['imperialCourt', ['王庭福地', '八十八角真阳楼', '巨阳仙尊']],
  ['tribeCrisis', ['中小型', '太白云生', '灭族']],
  ['towerFormation', ['八十八角真阳楼', '王庭福地', '真阳楼']],
  ['foxReturn', ['狐仙福地', '北原', '方源']],
  ['sectPressure', ['仙鹤门', '方正', '福地']],
  ['immortalAuction', ['拍卖大会', '秦百胜', '仙蛊']]
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
