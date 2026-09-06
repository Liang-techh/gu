(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationGuEffects = factory();
})(globalThis, function () {
  'use strict';

  // Content-side effect definitions. The generic EffectRack owns stacking and
  // expiry; this package only gives novel/world hazards their semantics.
  function register({ effect, engine }) {
    effect.register('environmentExposure', {
      stackable: false,
      onApply: ({ state, entity, effect: instance }) => state && engine.emit(state, 'environment.effect_applied', { entityId: entity.id, effectId: instance.id, effectKind: instance.kind, location: instance.data?.location, danger: instance.data?.danger || 0 }),
      onRefresh: ({ state, entity, effect: instance }) => state && engine.emit(state, 'environment.effect_refreshed', { entityId: entity.id, effectId: instance.id, effectKind: instance.kind, location: instance.data?.location, danger: instance.data?.danger || 0 }),
      onExpire: ({ state, entity, effect: instance }) => state && engine.emit(state, 'environment.effect_expired', { entityId: entity.id, effectId: instance.id, effectKind: instance.kind, location: instance.data?.location })
    });
    effect.register('terrainFatigue', {
      stackable: false,
      onApply: ({ state, entity, effect: instance }) => state && engine.emit(state, 'environment.effect_applied', { entityId: entity.id, effectId: instance.id, effectKind: instance.kind, location: instance.data?.location }),
      onExpire: ({ state, entity, effect: instance }) => state && engine.emit(state, 'environment.effect_expired', { entityId: entity.id, effectId: instance.id, effectKind: instance.kind, location: instance.data?.location })
    });
    return ['environmentExposure', 'terrainFatigue'];
  }

  return { register };
});
