(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationZoneRuntime = factory();
})(globalThis, function () {
  'use strict';

  // Qud analogue: Zone owns activation, suspension, cache timestamps and
  // queued work. Entity-level AI can remain detailed in the active zone while
  // suspended zones advance through a compact deterministic summary.
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clone = value => JSON.parse(JSON.stringify(value));

  function runtimeDefaults(clock, active = false) {
    return {
      active,
      suspended: !active,
      stale: false,
      lastActiveClock: active ? clock : null,
      lastCachedClock: clock,
      lastPlayerPresence: active ? clock : null,
      lastSettlementClock: clock,
      queuedEvents: [],
      offline: {
        hours: 0,
        ticks: 0,
        arrivals: 0,
        departures: 0,
        conflicts: 0,
        resourceYield: {},
        lastSummary: null
      }
    };
  }

  function ensure(zone, clock = 0, active = false) {
    if (!zone) return null;
    const defaults = runtimeDefaults(clock, active);
    const runtime = zone.runtime || {};
    runtime.active = runtime.active ?? active;
    runtime.suspended = runtime.suspended ?? !active;
    runtime.stale = runtime.stale ?? defaults.stale;
    runtime.lastActiveClock = runtime.lastActiveClock ?? defaults.lastActiveClock;
    runtime.lastCachedClock = Number.isFinite(Number(runtime.lastCachedClock)) ? Number(runtime.lastCachedClock) : clock;
    runtime.lastPlayerPresence = runtime.lastPlayerPresence ?? defaults.lastPlayerPresence;
    runtime.lastSettlementClock = Number.isFinite(Number(runtime.lastSettlementClock)) ? Number(runtime.lastSettlementClock) : clock;
    runtime.queuedEvents = Array.isArray(runtime.queuedEvents) ? runtime.queuedEvents.slice(-64) : [];
    runtime.offline = { ...defaults.offline, ...(runtime.offline || {}), resourceYield: { ...(runtime.offline?.resourceYield || {}) } };
    runtime.residency = {
      loadedIds: [...(runtime.residency?.loadedIds || [])],
      cachedIds: [...(runtime.residency?.cachedIds || [])],
      lastReconciledClock: Number.isFinite(Number(runtime.residency?.lastReconciledClock)) ? Number(runtime.residency.lastReconciledClock) : clock
    };
    runtime.offline.hours = Math.max(0, Number(runtime.offline.hours) || 0);
    runtime.offline.ticks = Math.max(0, Number(runtime.offline.ticks) || 0);
    zone.runtime = runtime;
    return runtime;
  }

  function ensureState(state, playerLocation) {
    const activeLocation = playerLocation || state.entities?.player?.position?.location;
    state.entityCache ||= {};
    hydrateLocation(state, activeLocation);
    for (const [id, zone] of Object.entries(state.zones || {})) ensure(zone, state.clock, id === activeLocation);
    if (activeLocation && state.zones?.[activeLocation]) activate(state, activeLocation, { clock: state.clock, settle: false });
    return state;
  }

  function cacheable(id, entity) {
    return id.startsWith('ambient-') && !entity.agent;
  }

  function hydrateLocation(state, locationId) {
    if (!locationId || !state.entityCache) return 0;
    let count = 0;
    for (const [id, entity] of Object.entries(state.entityCache)) {
      if (entity.position?.location !== locationId) continue;
      state.entities[id] = entity;
      delete state.entityCache[id];
      count += 1;
    }
    return count;
  }

  function reconcile(state, playerLocation) {
    const activeLocation = playerLocation || state.entities?.player?.position?.location;
    state.entityCache ||= {};
    hydrateLocation(state, activeLocation);
    for (const [id, entity] of Object.entries(state.entities || {})) {
      if (id === state.playerId || !cacheable(id, entity) || entity.position?.location === activeLocation) continue;
      state.entityCache[id] = clone(entity);
      delete state.entities[id];
    }
    for (const [id, zone] of Object.entries(state.zones || {})) {
      const runtime = ensure(zone, state.clock, id === activeLocation);
      runtime.residency.loadedIds = Object.values(state.entities || {}).filter(entity => entity.position?.location === id).map(entity => entity.id).sort();
      runtime.residency.cachedIds = Object.values(state.entityCache || {}).filter(entity => entity.position?.location === id).map(entity => entity.id).sort();
      runtime.residency.lastReconciledClock = state.clock;
    }
    return state;
  }

  function queue(state, locationId, event) {
    const zone = state.zones?.[locationId];
    if (!zone) return false;
    const runtime = ensure(zone, state.clock);
    runtime.queuedEvents.push({ ...event, queuedClock: state.clock });
    if (runtime.queuedEvents.length > 64) runtime.queuedEvents.splice(0, runtime.queuedEvents.length - 64);
    runtime.stale = true;
    return true;
  }

  function resourceFactor(state, zoneId, key) {
    const residents = [...Object.values(state.entities || {}), ...Object.values(state.entityCache || {})].filter(entity => entity.position?.location === zoneId && entity.faction);
    if (!residents.length) return 1;
    const bias = residents.reduce((sum, entity) => sum + Number(state.factions?.[entity.faction]?.interests?.resourceBias?.[key] || 0), 0) / residents.length;
    return Math.max(0.5, Math.min(1.8, 1 + bias));
  }

  function applyResources(state, zoneId, zone, days, summary, allowRelic = false) {
    const rates = { water: 2, moonPetal: 3, food: 1, relicFragment: allowRelic ? 0.2 : 0 };
    const caps = { water: 12, moonPetal: 16, food: 8, relicFragment: 3 };
    for (const [key, rate] of Object.entries(rates)) {
      if (zone.resources?.[key] === undefined) continue;
      const amount = rate * days * resourceFactor(state, zoneId, key);
      const before = zone.resources[key];
      zone.resources[key] = Math.min(caps[key], before + amount);
      summary.resourceYield[key] = (summary.resourceYield[key] || 0) + (zone.resources[key] - before);
    }
  }

  function summaryFor(zone, hours, clock) {
    const days = Math.max(0.01, hours / 24);
    const summary = {
      hours,
      days,
      ticks: Math.max(1, Math.floor(days)),
      resourceYield: {},
      activityDelta: -8 * days,
      dangerDelta: 0,
      residentMoves: 0,
      residentConflicts: 0,
      residentDeaths: 0,
      queuedEvents: zone.runtime.queuedEvents.length,
      settledClock: clock
    };
    return summary;
  }

  function stableRoll(value) {
    let hash = 2166136261;
    for (const ch of String(value)) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0) / 4294967296;
  }

  function offlineResidents(state, locationId, summary) {
    const zone = state.zones?.[locationId];
    const residents = Object.values(state.entityCache || {}).filter(entity => entity.position?.location === locationId);
    for (const entity of residents) {
      entity.needs ||= { energy: 50, hunger: 20, safety: 60 };
      entity.needs.energy = clamp((Number(entity.needs.energy) || 0) + 20 * summary.days, 0, 100);
      entity.needs.hunger = clamp((Number(entity.needs.hunger) || 0) - 25 * summary.days, 0, 100);
      entity.needs.safety = clamp((Number(entity.needs.safety) || 0) + (zone.danger < 45 ? 4 : -6) * summary.days, 0, 100);
      entity.body ||= { maxHealth: 60, health: 60, limbs: {}, wounds: [] };
      entity.body.maxHealth = Math.max(1, Number(entity.body.maxHealth) || 60);
      entity.body.health = clamp(Number(entity.body.health) || 0, 0, entity.body.maxHealth);
      const goals = entity.goals?.queue || [];
      const warPressure = Number(state.factions?.[entity.faction]?.interests?.war?.mobilization || 0);
      const neighbors = state.locations?.[locationId]?.neighbors || [];
      const shouldMove = neighbors.length && (zone.danger > 70 || goals.includes('travel') || goals.includes('returnHome') || (warPressure > 0.6 && (goals.includes('patrol') || goals.includes('prepareWar')))) && stableRoll(`${state.clock}:${entity.id}:${locationId}`) < Math.min(0.9, summary.days * (warPressure > 0.6 ? 0.55 : 0.45));
      if (shouldMove) {
        const destination = [...neighbors].sort((a, b) => (state.zones[a]?.danger || 0) - (state.zones[b]?.danger || 0) || a.localeCompare(b))[0];
        entity.position.location = destination;
        summary.residentMoves += 1;
        queue(state, locationId, { kind: 'departure', entityId: entity.id, destination });
        queue(state, destination, { kind: 'arrival', entityId: entity.id, origin: locationId });
        entity.memory ||= { facts: {}, episodes: [] };
        entity.memory.episodes ||= [];
        entity.memory.episodes.unshift({ clock: state.clock, subjectId: destination, kind: 'offline-move', valence: zone.danger > 70 ? -1 : 0, text: `在离线期间从${locationId}迁往${destination}。` });
        entity.memory.episodes = entity.memory.episodes.slice(0, 24);
      }
      if ((zone.danger > 80 || warPressure > 0.75) && stableRoll(`${state.clock}:conflict:${entity.id}`) < Math.min(0.5, summary.days * (warPressure > 0.75 ? 0.16 : 0.12))) {
        entity.body.health = Math.max(0, entity.body.health - Math.max(1, Math.round(zone.danger * 0.04)));
        summary.residentConflicts += 1;
        if (entity.body.health <= 0) { entity.alive = false; summary.residentDeaths += 1; }
      }
    }
  }

  function settle(state, locationId, hours, options = {}) {
    const zone = state.zones?.[locationId];
    if (!zone || hours <= 0) return null;
    const runtime = ensure(zone, state.clock);
    const clock = options.clock ?? state.clock;
    const summary = summaryFor(zone, hours, clock);
    const days = summary.days;
    offlineResidents(state, locationId, summary);
    const activityBefore = Number(zone.activity) || 0;
    zone.activity = Math.max(0, activityBefore + summary.activityDelta);
    summary.dangerDelta = zone.activity > 45 ? 1.5 * days : -0.5 * days;
    zone.danger = clamp((Number(zone.danger) || 0) + summary.dangerDelta, 0, 100);
    applyResources(state, locationId, zone, days, summary, Boolean(state.flags?.relicDiscovered));
    runtime.offline.hours += hours;
    runtime.offline.ticks += summary.ticks;
    runtime.offline.conflicts += (zone.danger > 70 ? summary.ticks : 0) + summary.residentConflicts;
    for (const event of runtime.queuedEvents) {
      if (event.kind === 'arrival') runtime.offline.arrivals += 1;
      if (event.kind === 'departure') runtime.offline.departures += 1;
    }
    runtime.offline.lastSummary = summary;
    runtime.offline.resourceYield = { ...runtime.offline.resourceYield, ...summary.resourceYield };
    runtime.lastSettlementClock = clock;
    runtime.lastCachedClock = clock;
    runtime.stale = false;
    return summary;
  }

  function foregroundDay(state, zone, random) {
    const runtime = ensure(zone, state.clock, true);
    zone.activity = Math.max(0, zone.activity - 12);
    zone.danger = clamp(zone.danger + (zone.activity > 45 ? 2 : -1), 0, 100);
    const summary = summaryFor(zone, 24, state.clock);
    applyResources(state, zone.id, zone, 1, summary, Boolean(state.flags?.relicDiscovered));
    zone.weather = random(state) < 0.65 ? '雨' : random(state) < 0.5 ? '晴' : '雾';
    runtime.lastSettlementClock = state.clock;
    runtime.lastCachedClock = state.clock;
    runtime.lastActiveClock = state.clock;
    runtime.lastPlayerPresence = state.clock;
    runtime.stale = false;
  }

  function activate(state, locationId, options = {}) {
    const zone = state.zones?.[locationId];
    if (!zone) return null;
    const clock = options.clock ?? state.clock;
    hydrateLocation(state, locationId);
    const runtime = ensure(zone, clock);
    const elapsed = Math.max(0, clock - runtime.lastSettlementClock);
    if (options.settle !== false && elapsed > 0) settle(state, locationId, elapsed, { clock });
    runtime.active = true;
    runtime.suspended = false;
    runtime.stale = false;
    runtime.lastActiveClock = clock;
    runtime.lastPlayerPresence = clock;
    runtime.lastCachedClock = clock;
    return runtime;
  }

  function suspend(state, locationId, options = {}) {
    const zone = state.zones?.[locationId];
    if (!zone) return null;
    const clock = options.clock ?? state.clock;
    const runtime = ensure(zone, clock);
    runtime.active = false;
    runtime.suspended = true;
    runtime.lastActiveClock = clock;
    runtime.lastCachedClock = clock;
    return runtime;
  }

  function transition(state, from, to, options = {}) {
    if (from && from !== to) suspend(state, from, options);
    const runtime = activate(state, to, options);
    reconcile(state, to);
    if (options.engine) {
      if (from && from !== to) options.engine.emit(state, 'zone.suspended', { location: from, to });
      options.engine.emit(state, 'zone.activated', { location: to, from });
    }
    return runtime;
  }

  function dailyTick(state, options = {}) {
    const playerLocation = options.playerLocation || state.entities?.player?.position?.location;
    const random = options.random || (() => 0.25);
    for (const [id, zone] of Object.entries(state.zones || {})) {
      const runtime = ensure(zone, state.clock, id === playerLocation);
      if (id === playerLocation && runtime.active) {
        foregroundDay(state, zone, random);
        continue;
      }
      const elapsed = Math.max(0, state.clock - runtime.lastSettlementClock);
      if (elapsed > 0) settle(state, id, elapsed, { clock: state.clock });
      runtime.active = false;
      runtime.suspended = true;
    }
  }

  function snapshot(zone) {
    if (!zone) return null;
    const runtime = ensure(zone);
    return {
      active: runtime.active,
      suspended: runtime.suspended,
      stale: runtime.stale,
      lastActiveClock: runtime.lastActiveClock,
      lastCachedClock: runtime.lastCachedClock,
      lastPlayerPresence: runtime.lastPlayerPresence,
      lastSettlementClock: runtime.lastSettlementClock,
      queuedEvents: runtime.queuedEvents.length,
      residency: { loaded: runtime.residency.loadedIds.length, cached: runtime.residency.cachedIds.length },
      offline: { ...runtime.offline, resourceYield: { ...runtime.offline.resourceYield } }
    };
  }

  return { ensure, ensureState, reconcile, hydrateLocation, queue, settle, activate, suspend, transition, dailyTick, snapshot };
});
