(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationEntity = factory();
})(globalThis, function () {
  'use strict';

  function createEntity(id, seed = {}) {
    const rank = seed.cultivation?.rank || 1;
    const aptitude = seed.cultivation?.aptitude ?? 0.45;
    const cultivation = {
      rank, stage: seed.cultivation?.stage || 0, aptitude,
      progress: 0, insight: 0, essence: 0,
      essenceMax: Math.max(20, Math.round(34 + aptitude * 38 + (seed.cultivation?.stage || 0) * 8 + (rank - 1) * 12)),
      vitality: 100,
      ...(seed.cultivation || {})
    };
    const maxHealth = 60 + (rank * 18);
    return {
      id,
      identity: { name: seed.name || id, role: seed.role || '居民', tags: seed.tags || [] },
      position: { location: seed.location },
      faction: seed.faction || null,
      personality: seed.personality || {},
      cultivation,
      schedule: seed.schedule || {},
      goals: { active: seed.goals?.[0] || 'idle', queue: seed.goals || [] },
      needs: { energy: 100, hunger: 0, safety: 80 },
      body: { maxHealth, health: maxHealth, wounds: [], limbs: { head: 100, torso: 100, leftArm: 100, rightArm: 100, leftLeg: 100, rightLeg: 100 } },
      abilities: { gu: [], skills: [] },
      inventory: {},
      memory: { facts: {}, episodes: [] },
      alive: true
    };
  }

  function hasRequiredComponents(entity, components) {
    return components.every(component => entity?.[component] !== undefined && entity?.[component] !== null);
  }

  return { createEntity, hasRequiredComponents };
});
