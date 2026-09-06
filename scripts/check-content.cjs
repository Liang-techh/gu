'use strict';

// Read-only schema validation for the content-driven world package.
const fs = require('node:fs');
const path = require('node:path');
const C = require('../src/content.js');
const S = require('../src/simulation.js');

const root = path.resolve(__dirname, '..');
const errors = [];
const fail = message => errors.push(message);
const locationIds = new Set(Object.keys(C.LOCATIONS));
const factionIds = new Set(Object.keys(C.FACTION_SEEDS));
const npcIds = new Set(Object.keys(C.NPC_SEEDS));
const goalIds = new Set(S.ENGINE.registries().goals);

for (const [id, location] of Object.entries(C.LOCATIONS)) {
  if (!Array.isArray(location.neighbors) || !location.neighbors.length) fail(`location ${id} has no neighbors`);
  if (!Array.isArray(location.tags) || !location.tags.length) fail(`location ${id} has no tags`);
  if (!C.POPULATION_TABLES[location.population]) fail(`location ${id} has no population table ${location.population}`);
  for (const neighbor of location.neighbors || []) {
    if (!locationIds.has(neighbor)) fail(`location ${id} points to missing neighbor ${neighbor}`);
    else if (!(C.LOCATIONS[neighbor].neighbors || []).includes(id)) fail(`location edge ${id} -> ${neighbor} is not reciprocal`);
  }
}

for (const [populationId, entries] of Object.entries(C.POPULATION_TABLES)) {
  if (!Array.isArray(entries) || !entries.length) fail(`population table ${populationId} is empty`);
  for (const entry of entries) {
    if (!entry.role || !Array.isArray(entry.goals) || !entry.goals.length) fail(`population ${populationId} has incomplete entry`);
    if (entry.faction && !factionIds.has(entry.faction)) fail(`population ${populationId} references missing faction ${entry.faction}`);
    for (const goal of entry.goals || []) if (!goalIds.has(goal)) fail(`population ${populationId} references unhandled goal ${goal}`);
  }
}

for (const [id, npc] of Object.entries(C.NPC_SEEDS)) {
  if (!npc.name || !npc.role || !locationIds.has(npc.location)) fail(`npc ${id} has incomplete identity/location`);
  if (npc.faction && !factionIds.has(npc.faction)) fail(`npc ${id} references missing faction ${npc.faction}`);
  if (!Array.isArray(npc.goals) || !npc.goals.length) fail(`npc ${id} has no goals`);
  for (const goal of npc.goals || []) if (!goalIds.has(goal)) fail(`npc ${id} references unhandled goal ${goal}`);
  for (const [period, target] of Object.entries(npc.schedule || {})) if (!locationIds.has(target)) fail(`npc ${id} schedule ${period} points to ${target}`);
  if (npc.fromDay !== undefined && (!Number.isInteger(npc.fromDay) || npc.fromDay < 1)) fail(`npc ${id} has invalid fromDay`);
}

for (const [id, note] of Object.entries(C.SOURCE_NOTES)) {
  const source = path.resolve(root, note.source);
  if (!source.startsWith(root + path.sep) || !fs.existsSync(source)) fail(`source ${id} is missing or escapes repository: ${note.source}`);
}

const contentIds = new Set();
for (const volume of C.CONTENT_INDEX.volumes || []) {
  if (!volume.id || contentIds.has(volume.id)) fail(`duplicate or empty volume id ${volume.id}`);
  contentIds.add(volume.id);
  for (const arc of volume.arcs || []) {
    for (const key of arc.sourceKeys || []) if (!C.SOURCE_NOTES[key]) fail(`arc ${arc.id} references missing source key ${key}`);
  }
}

for (const definition of C.CONTRACT_DEFS) {
  if (!npcIds.has(definition.giver)) fail(`contract ${definition.id} has missing giver ${definition.giver}`);
  for (const location of definition.locations || []) if (!locationIds.has(location)) fail(`contract ${definition.id} references missing location ${location}`);
  for (const flag of definition.flags || []) if (typeof flag !== 'string') fail(`contract ${definition.id} has invalid flag`);
}

for (const definition of C.CONVERSATION_DEFS) {
  if (!npcIds.has(definition.speaker)) fail(`conversation ${definition.id} has missing speaker ${definition.speaker}`);
  for (const location of definition.locations || []) if (!locationIds.has(location)) fail(`conversation ${definition.id} references missing location ${location}`);
  for (const choice of definition.choices || []) {
    const faction = choice.effects?.faction?.id;
    if (faction && !factionIds.has(faction)) fail(`conversation ${definition.id} references missing faction ${faction}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: content schema is valid (${locationIds.size} locations, ${npcIds.size} NPC seeds, ${factionIds.size} factions, ${Object.keys(C.SOURCE_NOTES).length} source notes).`);
}
