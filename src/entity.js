(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationEntity = factory();
})(globalThis, function () {
  'use strict';

  function createEntity(id, seed = {}) {
    const maxHealth = 60 + ((seed.cultivation?.rank || 1) * 18);
    return {
      id,
      identity: { name: seed.name || id, role: seed.role || '居民', tags: seed.tags || [] },
      position: { location: seed.location },
      faction: seed.faction || null,
      personality: seed.personality || {},
      cultivation: seed.cultivation || null,
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
