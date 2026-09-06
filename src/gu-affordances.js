(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationGuAffordances = factory();
})(globalThis, function () {
  'use strict';

  // Qud analogue: a zone exposes affordances through interaction handlers.
  // The UI may list them, but the simulation remains the authority that
  // decides whether an affordance is currently valid and what it changes.
  function register({ engine, locations, random, clamp, remember, log, consequence, damageEntity, advance, copy }) {
    const definitions = new Map();
    const locationTags = (state, p) => state.locations?.[p.position.location]?.tags || locations[p.position.location]?.tags || [];
    const locationDefinition = (state, p) => state.locations?.[p.position.location] || locations[p.position.location] || {};
    const locationSupports = (state, p, id) => locationDefinition(state, p).interactions?.includes(id) === true;
    const zoneFor = (state, p) => state.zones?.[p.position.location];
    const emit = (state, type, payload) => engine.emit(state, type, payload);
    const actorName = actor => actor.id === 'player' ? '你' : actor.identity?.name || actor.id;
    const advanceIfRequested = (state, context, hours, reason) => { if (context.advanceTime !== false) advance(state, hours, reason); };

    function add(id, definition) {
      definitions.set(id, { id, ...definition });
      engine.registerInteraction(id, context => {
        const definitionForContext = definitions.get(id);
        if (!definitionForContext.when(context)) return false;
        return definitionForContext.perform(context);
      });
    }

    add('observeZone', {
      label: '观察区域',
      kind: 'environment',
      when: ({ state, p }) => Boolean(zoneFor(state, p)),
      perform: context => {
        const { state, p } = context;
        const zone = zoneFor(state, p);
        zone.visits = (zone.visits || 0) + 1;
        zone.activity = (zone.activity || 0) + 2;
        p.cultivation.insight += 1 + (zone.danger > 60 ? 1 : 0);
        state.facts.observationCount = (state.facts.observationCount || 0) + 1;
        remember(state, p.id, p.position.location, { kind: 'observation', valence: 1, confidence: 0.82, text: `${actorName(p)}观察了${locations[p.position.location].name}的资源、危险与活动痕迹。`, facts: { observedLocation: p.position.location, observedDanger: zone.danger, observedResources: copy(zone.resources), observedAt: state.clock } });
        emit(state, 'zone.observed', { actorId: p.id, location: p.position.location, danger: zone.danger, activity: zone.activity, resources: copy(zone.resources) });
        log(state, 'zone_observation', `${actorName(p)}观察了${locations[p.position.location].name}，把这里的资源与危险写入自己的判断。`, { actorId: p.id, location: p.position.location, danger: zone.danger, resources: copy(zone.resources) });
        advanceIfRequested(state, context, 1, 'observe_zone');
        return { ok: true, location: p.position.location, danger: zone.danger };
      }
    });

    add('forage', {
      label: '采集区域资源',
      kind: 'environment',
      when: ({ state, p }) => locationSupports(state, p, 'forage') && Boolean(zoneFor(state, p)),
      perform: context => {
        const { state, p } = context;
        const loc = p.position.location;
        const zone = zoneFor(state, p);
        const inventory = p.inventory ||= {};
        const gathered = {};
        if (loc === 'riverbank') {
          const amount = Math.min(3, zone.resources.water);
          if (amount < 1) throw new Error('河滩的水源暂时不足');
          zone.resources.water -= amount; inventory.water = (inventory.water || 0) + amount; gathered.water = amount;
        } else if (loc === 'bambooForest') {
          const petals = Math.min(2, zone.resources.moonPetal);
          if (petals < 1) throw new Error('竹林里的月兰花瓣已经被采得差不多了');
          zone.resources.moonPetal -= petals; zone.resources.food = Math.max(0, zone.resources.food - 1); inventory.moonPetal = (inventory.moonPetal || 0) + petals; inventory.food = (inventory.food || 0) + 1; gathered.moonPetal = petals; gathered.food = 1;
        } else {
          const fragment = Math.min(1, zone.resources.relicFragment);
          if (fragment < 1) throw new Error('石缝里暂时没有新的遗藏碎片');
          zone.resources.relicFragment -= fragment; inventory.relicFragment = (inventory.relicFragment || 0) + fragment; state.flags.relicDiscovered = true; gathered.relicFragment = fragment;
        }
        zone.activity += 12; zone.visits = (zone.visits || 0) + 1;
        emit(state, 'world.resource_gathered', { actorId: p.id, location: loc, gathered, resources: copy(inventory) });
        if (random(state) < zone.danger / 260) { damageEntity(state, p.id, 4 + zone.danger * 0.08, 'world', 'environment'); p.needs.safety -= 8; }
        p.cultivation.insight += random(state) < 0.35 ? 1 : 0;
        log(state, 'environment_forage', `${actorName(p)}在${locations[loc].name}采集了资源，区域活动和竞争痕迹同时上升。`, { actorId: p.id, location: loc, gathered });
        advanceIfRequested(state, context, 2, 'forage');
        return { ok: true, location: loc, gathered };
      }
    });

    add('searchRelic', {
      label: '搜索遗藏痕迹',
      kind: 'environment',
      when: ({ state, p }) => {
        const tags = locationTags(state, p);
        return locationSupports(state, p, 'searchRelic') || tags.includes('relic') || tags.includes('inheritance') || tags.includes('hidden');
      },
      perform: context => {
        const { state, p } = context;
        const zone = zoneFor(state, p);
        const loc = p.position.location;
        const quality = clamp(0.25 + p.cultivation.insight * 0.012 + (zone.danger > 45 ? 0.12 : 0), 0, 0.95);
        const found = random(state) < quality;
        zone.activity += 8; zone.visits = (zone.visits || 0) + 1; p.needs.energy -= 5; p.needs.safety -= zone.danger > 55 ? 4 : 1;
        if (found) {
          p.cultivation.insight += 3; state.facts.relicInterest = (state.facts.relicInterest || 0) + 1; state.facts[`relicClue:${loc}`] = (state.facts[`relicClue:${loc}`] || 0) + 1;
          remember(state, p.id, loc, { kind: 'relic-clue', valence: 3, confidence: quality, text: `${actorName(p)}在${locations[loc].name}找到一段尚未完整的遗藏线索。`, facts: { relicClue: true, relicLocation: loc, relicConfidence: quality } });
        } else {
          remember(state, p.id, loc, { kind: 'failed-search', valence: -1, confidence: 0.45, text: `${actorName(p)}在${locations[loc].name}搜索无果，但确认这里的痕迹并非自然形成。`, facts: { failedRelicSearch: true, relicLocation: loc } });
          consequence(state, { kind: 'failed_relic_search', actorId: p.id, source: 'searchRelic', location: loc, reason: '搜索遗藏失败留下时间与暴露成本，后来者可能从活动痕迹中推断你的目标。', data: { location: loc, quality, danger: zone.danger }, tension: 0.5, pressure: 0.08 });
        }
        emit(state, 'zone.relic_search', { actorId: p.id, location: loc, found, quality, activity: zone.activity });
        log(state, 'relic_search', found ? `${actorName(p)}在${locations[loc].name}发现了可以继续核验的遗藏线索。` : `${actorName(p)}在${locations[loc].name}没有拿到遗藏，但留下了搜索痕迹。`, { actorId: p.id, location: loc, found, quality });
        advanceIfRequested(state, context, 3, 'search_relic');
        return { ok: true, found, quality, location: loc };
      }
    });

    add('scoutZone', {
      label: '侦查区域',
      kind: 'environment',
      when: ({ state, p }) => {
        const tags = locationTags(state, p);
        const front = Object.values(state.worldWar?.fronts || {}).some(item => item.active && item.location === p.position.location);
        return tags.includes('wild') || tags.includes('route') || tags.includes('war') || front;
      },
      perform: context => {
        const { state, p } = context;
        const zone = zoneFor(state, p); const loc = p.position.location; const front = Object.values(state.worldWar?.fronts || {}).find(item => item.active && item.location === loc);
        p.needs.energy -= 6; p.needs.safety -= 3; p.cultivation.insight += 2; zone.activity += 5; state.facts[`scouted:${loc}`] = (state.facts[`scouted:${loc}`] || 0) + 1;
        if (front) { front.pressure = Math.max(0, front.pressure - 2); front.lastActionDay = Math.floor(state.clock / 24) + 1; }
        remember(state, p.id, 'world', { kind: 'zone-scout', valence: 2, confidence: 0.72, text: `${actorName(p)}侦查了${locations[loc].name}，把危险、活动和可能的补给缺口记入判断。`, facts: { scoutedLocation: loc, frontId: front?.id || null, danger: zone.danger } });
        emit(state, 'zone.scouted', { actorId: p.id, location: loc, danger: zone.danger, activity: zone.activity, frontId: front?.id || null });
        log(state, 'zone_scout', `${actorName(p)}侦查了${locations[loc].name}，获得了可以影响下一步行动的局部情报。`, { actorId: p.id, location: loc, danger: zone.danger, frontId: front?.id || null });
        advanceIfRequested(state, context, 2, 'scout_zone');
        return { ok: true, location: loc, frontId: front?.id || null };
      }
    });

    function available(state, p) {
      return [...definitions.values()].filter(definition => definition.when({ state, p })).map(definition => ({ id: definition.id, label: definition.label, kind: definition.kind }));
    }

    function execute(id, context) {
      const definition = definitions.get(id);
      if (!definition || !definition.when(context)) return false;
      return engine.runInteraction(id, context);
    }

    function executeForActor(id, state, actor, options = {}) {
      return execute(id, { state, p: actor, actor, source: options.source || 'npc', advanceTime: options.advanceTime === true });
    }

    return { definitions, available, execute, executeForActor };
  }

  return { register };
});
