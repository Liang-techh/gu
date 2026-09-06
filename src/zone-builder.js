(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationZoneBuilder = factory();
})(globalThis, function () {
  'use strict';

  function createZone(locationId, location) {
    const tags = location.tags || [];
    const resources = { water: 0, moonPetal: 0, food: 0, relicFragment: 0 };
    if (tags.includes('water')) resources.water = 8;
    if (tags.includes('resource')) { resources.moonPetal = 10; resources.food = 4; }
    if (tags.includes('relic')) resources.relicFragment = 3;
    if (tags.includes('market')) { resources.water = 5; resources.food = 5; }
    if (tags.includes('route')) { resources.water = 4; resources.food = 3; }
    if (tags.includes('inheritance')) resources.relicFragment = 6;
    return { id: locationId, danger: tags.includes('wild') ? 22 : 4, resources, population: 0, activity: 0, discoveries: [], visits: 0, weather: '雨' };
  }

  function buildZones(locations) {
    return Object.fromEntries(Object.entries(locations).map(([id, location]) => [id, createZone(id, location)]));
  }

  function weightedPopulation(state, table, random) {
    const total = table.reduce((sum, row) => sum + row.weight, 0);
    let needle = random(state) * total;
    for (const row of table) { needle -= row.weight; if (needle <= 0) return row; }
    return table[table.length - 1];
  }

  function seedPopulation(state, { locations, populationTables, random, createEntity }) {
    for (const [locationId, location] of Object.entries(locations)) {
      const zone = state.zones[locationId];
      const table = populationTables[location.population] || [];
      const count = location.type === 'wilderness' || location.type === 'ruin' ? 1 : 2;
      for (let i = 0; i < count && table.length; i++) {
        const row = weightedPopulation(state, table, random);
        const id = `ambient-${locationId}-${i + 1}`;
        const roll = () => random(state);
        const entity = createEntity(id, {
          name: `${row.role}·${String.fromCharCode('甲'.charCodeAt(0) + i)}`,
          role: row.role,
          faction: row.faction,
          location: locationId,
          personality: { ambition: 20 + Math.floor(roll() * 60), caution: 20 + Math.floor(roll() * 70), loyalty: 20 + Math.floor(roll() * 70), greed: 10 + Math.floor(roll() * 70), curiosity: 10 + Math.floor(roll() * 70) },
          cultivation: { rank: 1, stage: 0, aptitude: 0.35 + roll() * 0.35 },
          goals: row.goals,
          schedule: { morning: locationId, afternoon: locationId, evening: locationId, night: locationId }
        });
        state.entities[id] = entity;
        zone.population += 1;
      }
    }
  }

  return { createZone, buildZones, seedPopulation };
});
