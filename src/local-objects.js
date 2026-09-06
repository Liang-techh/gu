(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationLocalObjects = factory();
})(globalThis, function () {
  'use strict';

  // Content-owned points of interest. They are deliberately local: an object
  // only enters the player's knowledge after a visible, situated interaction.
  function createRuntime({ locations, seeds = {}, localMap }) {
    function seedObject(locationId, seed, index) {
      const object = { ...seed };
      object.id = String(seed.id);
      object.location = locationId;
      object.cell = seed.cell ? { x: Number(seed.cell.x), y: Number(seed.cell.y) } : localMap.spawnCell(locationId, `object:${object.id}`, index + 2, locations[locationId]);
      object.remaining = seed.kind === 'resource' ? Math.max(0, Number(seed.amount ?? seed.remaining ?? 1)) : null;
      object.discovered = !!seed.discovered;
      object.resolved = !!seed.resolved;
      object.active = seed.active !== false;
      return object;
    }

    function ensure(state) {
      state.localObjects ||= {};
      for (const [locationId, location] of Object.entries(locations || {})) {
        const bucket = state.localObjects[locationId] ||= { objects: [] };
        bucket.objects ||= [];
        const existing = new Map(bucket.objects.map(object => [object.id, object]));
        for (const [index, seed] of (seeds[locationId] || []).entries()) {
          const object = existing.get(seed.id) || seedObject(locationId, seed, index);
          object.location = locationId;
          object.cell = localMap.normalizeCell(locationId, object.cell, location, `object:${object.id}`);
          object.active = object.active !== false;
          object.discovered = !!object.discovered;
          object.resolved = !!object.resolved;
          if (object.kind === 'resource') object.remaining = Math.max(0, Number(object.remaining ?? object.amount ?? 0));
          if (!existing.has(seed.id)) bucket.objects.push(object);
        }
        bucket.objects = bucket.objects.filter(object => object && object.id);
        for (const object of bucket.objects) {
          object.location = locationId;
          object.cell = localMap.normalizeCell(locationId, object.cell, location, `object:${object.id}`);
          object.active = object.active !== false;
          object.discovered = !!object.discovered;
          object.resolved = !!object.resolved;
          if (object.kind === 'resource') object.remaining = Math.max(0, Number(object.remaining ?? object.amount ?? 0));
        }
      }
      return state.localObjects;
    }

    function visible(state, actor) {
      ensure(state);
      const locationId = actor?.position?.location;
      const location = locations?.[locationId];
      const cell = localMap.normalizeCell(locationId, actor?.position?.cell, location, actor?.id || 'actor');
      return (state.localObjects?.[locationId]?.objects || []).filter(object => object.active && localMap.visible(locationId, location, cell, object.cell, 4));
    }

    function get(state, locationId, objectId) {
      ensure(state);
      return (state.localObjects?.[locationId]?.objects || []).find(object => object.id === objectId) || null;
    }

    function interact(state, actor, objectId, mode = 'inspect') {
      const locationId = actor?.position?.location;
      const location = locations?.[locationId];
      const object = get(state, locationId, objectId);
      if (!object || !object.active) throw new Error('这里没有这样的发现');
      const actorCell = localMap.normalizeCell(locationId, actor.position?.cell, location, actor.id || 'actor');
      if (!localMap.visible(locationId, location, actorCell, object.cell, 4)) throw new Error('目标在视野之外');
      const distance = localMap.distance(actorCell, object.cell);
      if (['gather', 'practice', 'follow'].includes(mode) && distance > 1) throw new Error('还需要再走近一些');
      if (mode === 'gather') {
        if (object.kind !== 'resource') throw new Error('这不是可以直接采集的资源');
        if (object.remaining <= 0) throw new Error('这里已经没有可采集的资源了');
        object.remaining -= 1;
        if (object.remaining <= 0) object.active = false;
        return { mode, object, amount: 1 };
      }
      if (mode === 'practice') {
        if (object.kind !== 'practice') throw new Error('这里没有适合练习的地方');
        object.discovered = true;
        return { mode, object, amount: 1 };
      }
      if (mode === 'follow') {
        if (!['trace', 'relic'].includes(object.kind)) throw new Error('这条发现还不能追踪');
        if (!object.discovered) throw new Error('先调查清楚它留下的痕迹');
        object.resolved = true;
        object.active = false;
        return { mode, object, amount: 1 };
      }
      object.discovered = true;
      return { mode: 'inspect', object, amount: 1 };
    }

    return { ensure, visible, get, interact };
  }

  return { createRuntime };
});
