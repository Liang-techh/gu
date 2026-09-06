(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationLocalMap = factory();
})(globalThis, function () {
  'use strict';

  const WIDTH = 7;
  const HEIGHT = 5;
  const DIRECTIONS = Object.freeze({
    north: { x: 0, y: -1, label: '北' },
    east: { x: 1, y: 0, label: '东' },
    south: { x: 0, y: 1, label: '南' },
    west: { x: -1, y: 0, label: '西' }
  });
  const ORDER = Object.freeze(['north', 'east', 'south', 'west']);

  function hash(value) {
    let h = 2166136261;
    for (const ch of String(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return (h >>> 0) || 1;
  }

  function key(cell) { return `${cell.x},${cell.y}`; }

  function profile(locationId, location = {}) {
    const tags = new Set(location.tags || []);
    const terrain = tags.has('water') ? 'water' : tags.has('wild') ? 'grass' : tags.has('ruin') ? 'stone' : tags.has('market') ? 'road' : 'courtyard';
    const blocked = new Set();
    const salt = hash(locationId);
    const count = tags.has('wild') || tags.has('ruin') ? 5 : 2;
    for (let i = 0; i < count; i++) {
      const x = 1 + ((salt >>> (i * 5)) % (WIDTH - 2));
      const y = 1 + ((salt >>> (i * 3 + 7)) % (HEIGHT - 2));
      if ((x === 3 && y === 2) || (x === 3 && y === 1) || (x === 3 && y === 3)) continue;
      blocked.add(`${x},${y}`);
    }
    return { id: locationId, width: WIDTH, height: HEIGHT, terrain, blocked: [...blocked], neighbors: [...(location.neighbors || [])] };
  }

  function inBounds(cell, map) { return Boolean(cell) && cell.x >= 0 && cell.x < map.width && cell.y >= 0 && cell.y < map.height; }
  function isWalkable(cell, map) { return inBounds(cell, map) && !map.blocked.includes(key(cell)); }
  function allCells(map) { const result = []; for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) result.push({ x, y }); return result; }

  function spawnCell(locationId, entityId = 'entity', index = 0, location = {}) {
    const map = profile(locationId, location);
    const preferred = [
      { x: 3, y: 2 }, { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 1 }, { x: 3, y: 3 },
      { x: 2, y: 1 }, { x: 4, y: 1 }, { x: 2, y: 3 }, { x: 4, y: 3 }
    ];
    const ordered = [...preferred, ...allCells(map).sort((a, b) => hash(`${entityId}:${key(a)}`) - hash(`${entityId}:${key(b)}`))];
    const open = ordered.filter(cell => isWalkable(cell, map));
    return { ...(open[index % Math.max(1, open.length)] || { x: 3, y: 2 }) };
  }

  function normalizeCell(locationId, cell, location = {}, entityId = 'entity') {
    const map = profile(locationId, location);
    if (cell && Number.isInteger(Number(cell.x)) && Number.isInteger(Number(cell.y)) && isWalkable({ x: Number(cell.x), y: Number(cell.y) }, map)) return { x: Number(cell.x), y: Number(cell.y) };
    return spawnCell(locationId, entityId, entityId === 'player' ? 0 : hash(entityId) % 9, location);
  }

  function layoutEntities(entities, locations) {
    const groups = {};
    for (const entity of Object.values(entities || {})) {
      const locationId = entity.position?.location;
      if (locationId && locations[locationId]) (groups[locationId] ||= []).push(entity);
    }
    for (const [locationId, group] of Object.entries(groups)) {
      group.sort((a, b) => (a.id === 'player' ? -1 : b.id === 'player' ? 1 : a.id.localeCompare(b.id)));
      group.forEach((entity, index) => { entity.position.cell = spawnCell(locationId, entity.id, index, locations[locationId]); });
    }
  }

  function entryCell(locationId, location, direction, entityId = 'entity') {
    const map = profile(locationId, location);
    const edge = { north: { x: 3, y: map.height - 1 }, east: { x: 0, y: 2 }, south: { x: 3, y: 0 }, west: { x: map.width - 1, y: 2 } }[direction];
    if (isWalkable(edge, map)) return edge;
    return spawnCell(locationId, entityId, 0, location);
  }

  function step(locationId, location, cell, direction) {
    const delta = DIRECTIONS[direction];
    if (!delta) throw new Error('未知的移动方向');
    const map = profile(locationId, location);
    const target = { x: cell.x + delta.x, y: cell.y + delta.y };
    if (isWalkable(target, map)) return { kind: 'step', cell: target, direction, map };
    if (!inBounds(target, map)) {
      const neighbor = map.neighbors[ORDER.indexOf(direction)];
      if (neighbor) return { kind: 'exit', location: neighbor, direction, map };
      return { kind: 'blocked', reason: 'edge', direction, map };
    }
    return { kind: 'blocked', reason: 'terrain', direction, map };
  }

  function distance(a, b) { return Math.abs((a?.x || 0) - (b?.x || 0)) + Math.abs((a?.y || 0) - (b?.y || 0)); }
  function lineOfSight(map, from, to, radius = 4) {
    if (!isWalkable(from, map) || !isWalkable(to, map) || distance(from, to) > radius) return false;
    const dx = to.x - from.x; const dy = to.y - from.y; const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 1; i < steps; i++) {
      const cell = { x: Math.round(from.x + (dx * i) / steps), y: Math.round(from.y + (dy * i) / steps) };
      if (!isWalkable(cell, map)) return false;
    }
    return true;
  }
  function visible(locationId, location, from, to, radius = 4) { return lineOfSight(profile(locationId, location), from, to, radius); }
  function terrainSymbol(terrain) { return ({ water: '~', grass: '·', stone: '▪', road: '·', courtyard: '·' }[terrain] || '·'); }

  return { WIDTH, HEIGHT, DIRECTIONS, ORDER, profile, inBounds, isWalkable, spawnCell, normalizeCell, layoutEntities, entryCell, step, distance, lineOfSight, visible, terrainSymbol };
});
