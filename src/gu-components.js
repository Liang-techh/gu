(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationGuComponents = factory();
})(globalThis, function () {
  'use strict';

  function objectComponent(id, defaults = {}) {
    return {
      ensure: entity => {
        entity[id] ||= {};
        for (const [key, value] of Object.entries(defaults)) if (entity[id][key] === undefined) entity[id][key] = Array.isArray(value) ? [...value] : { ...value };
        return entity[id];
      }
    };
  }

  function register({ engine, body, equipment, effect, brain, condition, ability, knowledge }) {
    engine.registerComponent('identity', {
      ...objectComponent('identity', { name: '未知实体', role: '居民', tags: [] }),
      serialize: ({ value }) => ({ ...value, tags: [...(value.tags || [])] }),
      deserialize: ({ value }) => ({ ...value, tags: [...(value.tags || [])] })
    });
    engine.registerComponent('position', objectComponent('position', { location: null, cell: null }));
    engine.registerComponent('faction', { ensure: entity => { if (entity.faction === undefined) entity.faction = null; return entity.faction; } });
    engine.registerComponent('personality', objectComponent('personality'));
    engine.registerComponent('cultivation', objectComponent('cultivation', { rank: 1, stage: 0, aptitude: 0.45, progress: 0, insight: 0, essence: 0, essenceMax: 20, vitality: 100 }));
    engine.registerComponent('schedule', objectComponent('schedule'));
    engine.registerComponent('goals', {
      ensure: entity => {
        entity.goals ||= {};
        entity.goals.active ||= 'idle';
        entity.goals.queue ||= [];
        entity.goals.history ||= [];
        return entity.goals;
      },
      serialize: ({ value }) => ({ ...value, queue: [...(value.queue || [])], history: [...(value.history || [])] }),
      deserialize: ({ value }) => ({ ...value, queue: [...(value.queue || [])], history: [...(value.history || [])] })
    });
    engine.registerComponent('needs', objectComponent('needs', { energy: 100, hunger: 0, safety: 80 }));
    engine.registerComponent('abilities', {
      ensure: entity => ability.ensure(entity),
      serialize: ({ value }) => ({ ...value, gu: [...(value.gu || [])], skills: [...(value.skills || [])] }),
      deserialize: ({ value }) => ({ ...value, gu: [...(value.gu || [])], skills: [...(value.skills || [])] })
    });
    engine.registerComponent('inventory', objectComponent('inventory'));
    engine.registerComponent('memory', {
      ensure: entity => {
        entity.memory ||= { facts: {}, episodes: [] };
        entity.memory.facts ||= {};
        entity.memory.episodes ||= [];
        return entity.memory;
      },
      serialize: ({ value }) => ({ ...value, facts: { ...(value.facts || {}) }, episodes: [...(value.episodes || [])] }),
      deserialize: ({ value }) => ({ ...value, facts: { ...(value.facts || {}) }, episodes: [...(value.episodes || [])] })
    });
    engine.registerComponent('knowledge', {
      ensure: entity => knowledge.ensure(entity),
      serialize: ({ value }) => ({ ...value, facts: { ...(value.facts || {}) }, masks: { ...(value.masks || {}) }, suspicion: { ...(value.suspicion || {}) }, sources: [...(value.sources || [])] }),
      deserialize: ({ value }) => ({ ...value, facts: { ...(value.facts || {}) }, masks: { ...(value.masks || {}) }, suspicion: { ...(value.suspicion || {}) }, sources: [...(value.sources || [])] })
    });
    engine.registerComponent('conditions', {
      ensure: entity => condition.ensure(entity),
      serialize: ({ value }) => ({ active: [...(value.active || [])] }),
      deserialize: ({ value }) => ({ active: [...(value.active || [])] })
    });
    engine.registerComponent('body', {
      ensure: entity => body.ensure(entity),
      serialize: ({ value }) => ({ ...value, limbs: { ...(value.limbs || {}) }, wounds: [...(value.wounds || [])] }),
      deserialize: ({ value }) => ({ ...value, limbs: { ...(value.limbs || {}) }, wounds: [...(value.wounds || [])] })
    });
    engine.registerComponent('equipment', {
      ensure: entity => equipment.ensure(entity),
      serialize: ({ value }) => ({ slots: { ...(value.slots || {}) }, history: [...(value.history || [])] }),
      deserialize: ({ value }) => ({ slots: { ...(value.slots || {}) }, history: [...(value.history || [])] })
    });
    engine.registerComponent('effects', {
      ensure: entity => effect.ensure(entity),
      serialize: ({ value }) => ({ ...value, active: (value.active || []).map(item => ({ ...item, data: { ...(item.data || {}) } })) }),
      deserialize: ({ value }) => ({ ...value, active: (value.active || []).map(item => ({ ...item, data: { ...(item.data || {}) } })) })
    });
    engine.registerComponent('brain', { ensure: entity => brain.ensure(entity), onAttach: ({ entity, value }) => value || brain.ensure(entity) });
    engine.registerComponent('agent', { ensure: entity => { if (entity.agent === undefined) entity.agent = null; return entity.agent; } });
    engine.registerComponent('alive', { ensure: entity => { if (entity.alive === undefined) entity.alive = true; return entity.alive; } });
  }

  return { register };
});
