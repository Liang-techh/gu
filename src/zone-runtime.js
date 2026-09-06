(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationZoneRuntime = factory();
})(globalThis, function () {
  'use strict';

  // Qud analogue: Zone owns activation, suspension, cache timestamps and
  // queued work. Entity-level AI can remain detailed in the active zone while
  // suspended zones advance through a compact deterministic summary.
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
    const existing = zone.runtime || {};
    const defaults = runtimeDefaults(clock, active);
    zone.runtime = {
      ...defaults,
      ...existing,
      active: existing.active ?? active,
      suspended: existing.suspended ?? !active,
      queuedEvents: Array.isArray(existing.queuedEvents) ? existing.queuedEvents.slice(-64) : [],
      offline: { ...defaults.offline, ...(existing.offline || {}), resourceYield: { ...(existing.offline?.resourceYield || {}) } }
    };
    zone.runtime.lastCachedClock = Number.isFinite(Number(zone.runtime.lastCachedClock)) ? Number(zone.runtime.lastCachedClock) : clock;
    zone.runtime.lastSettlementClock = Number.isFinite(Number(zone.runtime.lastSettlementClock)) ? Number(zone.runtime.lastSettlementClock) : clock;
    zone.runtime.offline.hours = Math.max(0, Number(zone.runtime.offline.hours) || 0);
    zone.runtime.offline.ticks = Math.max(0, Number(zone.runtime.offline.ticks) || 0);
    return zone.runtime;
  }

  function ensureState(state, playerLocation) {
    const activeLocation = playerLocation || state.entities?.player?.position?.location;
    for (const [id, zone] of Object.entries(state.zones || {})) ensure(zone, state.clock, id === activeLocation);
    if (activeLocation && state.zones?.[activeLocation]) activate(state, activeLocation, { clock: state.clock, settle: false });
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

  function applyResources(zone, days, summary, allowRelic = false) {
    const rates = { water: 2, moonPetal: 3, food: 1, relicFragment: allowRelic ? 0.2 : 0 };
    const caps = { water: 12, moonPetal: 16, food: 8, relicFragment: 3 };
    for (const [key, rate] of Object.entries(rates)) {
      if (zone.resources?.[key] === undefined) continue;
      const amount = rate * days;
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
      queuedEvents: zone.runtime.queuedEvents.length,
      settledClock: clock
    };
    return summary;
  }

  function settle(state, locationId, hours, options = {}) {
    const zone = state.zones?.[locationId];
    if (!zone || hours <= 0) return null;
    const runtime = ensure(zone, state.clock);
    const clock = options.clock ?? state.clock;
    const summary = summaryFor(zone, hours, clock);
    const days = summary.days;
    const activityBefore = Number(zone.activity) || 0;
    zone.activity = Math.max(0, activityBefore + summary.activityDelta);
    summary.dangerDelta = zone.activity > 45 ? 1.5 * days : -0.5 * days;
    zone.danger = clamp((Number(zone.danger) || 0) + summary.dangerDelta, 0, 100);
    applyResources(zone, days, summary, Boolean(state.flags?.relicDiscovered));
    runtime.offline.hours += hours;
    runtime.offline.ticks += summary.ticks;
    runtime.offline.conflicts += zone.danger > 70 ? summary.ticks : 0;
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
    applyResources(zone, 1, summary, Boolean(state.flags?.relicDiscovered));
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
      offline: { ...runtime.offline, resourceYield: { ...runtime.offline.resourceYield } }
    };
  }

  return { ensure, ensureState, queue, settle, activate, suspend, transition, dailyTick, snapshot };
});
