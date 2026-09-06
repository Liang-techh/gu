(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./content.js'), require('./history.js'), require('./zone-builder.js'), require('./zone-runtime.js'), require('./npc-ai.js'), require('./entity.js'), require('./conversation.js'), require('./rumor.js'), require('./action-catalog.js'), require('./director.js'), require('./default-goals.js'), require('./intent.js'), require('./ability.js'), require('./condition.js'), require('./body.js'), require('./equipment.js'), require('./effect.js'), require('./provenance.js'), require('./consequence.js'), require('./contracts.js'), require('./repeatable-systems.js'), require('./gu-director-rules.js'), require('./gu-event-rules.js'), require('./knowledge.js'), require('./identity.js'), require('./pursuit.js'), require('./agency.js'), require('./market.js'), require('./brain.js'), require('./social.js'), require('./combat.js'), require('./gu-systems.js'), require('./gu-components.js'), require('./gu-goals.js'), require('./gu-listeners.js'), require('./gu-actions.js'), require('./gu-world.js'), require('./gu-state.js'), require('./faction-pacts.js'), require('./gu-effects.js'), require('./gu-affordances.js'), require('./local-map.js'), require('./local-objects.js'));
  else root.GuSimulation = factory(root.GuSimulationEngine, root.GuSimulationContent, root.GuSimulationHistory, root.GuSimulationZoneBuilder, root.GuSimulationZoneRuntime, root.GuSimulationNpcAI, root.GuSimulationEntity, root.GuSimulationConversation, root.GuSimulationRumor, root.GuSimulationActionCatalog, root.GuSimulationDirector, root.GuSimulationDefaultGoals, root.GuSimulationIntent, root.GuSimulationAbility, root.GuSimulationCondition, root.GuSimulationBody, root.GuSimulationEquipment, root.GuSimulationEffect, root.GuSimulationProvenance, root.GuSimulationConsequence, root.GuSimulationContracts, root.GuSimulationRepeatableSystems, root.GuDirectorRules, root.GuEventRules, root.GuSimulationKnowledge, root.GuSimulationIdentity, root.GuSimulationPursuit, root.GuSimulationAgency, root.GuSimulationMarket, root.GuSimulationBrain, root.GuSimulationSocial, root.GuSimulationCombat, root.GuSimulationGuSystems, root.GuSimulationGuComponents, root.GuSimulationGuGoals, root.GuSimulationGuListeners, root.GuSimulationGuActions, root.GuSimulationGuWorld, root.GuSimulationGuState, root.GuSimulationFactionPacts, root.GuSimulationGuEffects, root.GuSimulationGuAffordances, root.GuSimulationLocalMap, root.GuSimulationLocalObjects);
})(globalThis, function (Engine, Content, History, ZoneBuilder, ZoneRuntime, NpcAI, Entity, Conversation, Rumor, ActionCatalog, Director, DefaultGoals, Intent, Ability, Condition, Body, Equipment, Effect, Provenance, Consequence, Contracts, RepeatableSystems, DirectorRules, EventRules, Knowledge, Identity, Pursuit, Agency, Market, Brain, Social, Combat, GuSystems, GuComponents, GuGoals, GuListeners, GuActions, GuWorld, GuState, FactionPacts, GuEffects, GuAffordances, LocalMap, LocalObjects) {
  'use strict';

  if (!Engine) throw new Error('GuSimulationEngine must load before simulation.js');
  if (!Content) throw new Error('GuSimulationContent must load before simulation.js');
  if (!GuSystems) throw new Error('GuSimulationGuSystems must load before simulation.js');
  if (!GuComponents) throw new Error('GuSimulationGuComponents must load before simulation.js');
  if (!GuGoals) throw new Error('GuSimulationGuGoals must load before simulation.js');
  if (!GuListeners) throw new Error('GuSimulationGuListeners must load before simulation.js');
  if (!GuActions) throw new Error('GuSimulationGuActions must load before simulation.js');
  if (!GuWorld) throw new Error('GuSimulationGuWorld must load before simulation.js');
  if (!GuState) throw new Error('GuSimulationGuState must load before simulation.js');
  if (!FactionPacts) throw new Error('GuSimulationFactionPacts must load before simulation.js');
  if (!GuEffects) throw new Error('GuSimulationGuEffects must load before simulation.js');
  if (!GuAffordances) throw new Error('GuSimulationGuAffordances must load before simulation.js');
  if (!LocalMap) throw new Error('GuSimulationLocalMap must load before simulation.js');
  if (!LocalObjects) throw new Error('GuSimulationLocalObjects must load before simulation.js');
  if (!Identity) throw new Error('GuSimulationIdentity must load before simulation.js');
  if (!Pursuit) throw new Error('GuSimulationPursuit must load before simulation.js');
  if (!Agency) throw new Error('GuSimulationAgency must load before simulation.js');
  if (!Market) throw new Error('GuSimulationMarket must load before simulation.js');
  if (!Brain) throw new Error('GuSimulationBrain must load before simulation.js');
  if (!Social) throw new Error('GuSimulationSocial must load before simulation.js');
  if (!Combat) throw new Error('GuSimulationCombat must load before simulation.js');
  if (!History) throw new Error('GuSimulationHistory must load before simulation.js');
  if (!ZoneBuilder) throw new Error('GuSimulationZoneBuilder must load before simulation.js');
  if (!ZoneRuntime) throw new Error('GuSimulationZoneRuntime must load before simulation.js');
  if (!Body) throw new Error('GuSimulationBody must load before simulation.js');
  if (!Equipment) throw new Error('GuSimulationEquipment must load before simulation.js');
  if (!NpcAI) throw new Error('GuSimulationNpcAI must load before simulation.js');
  if (!Entity) throw new Error('GuSimulationEntity must load before simulation.js');
  if (!Conversation) throw new Error('GuSimulationConversation must load before simulation.js');
  if (!Rumor) throw new Error('GuSimulationRumor must load before simulation.js');
  if (!ActionCatalog) throw new Error('GuSimulationActionCatalog must load before simulation.js');
  if (!Director) throw new Error('GuSimulationDirector must load before simulation.js');
  if (!DefaultGoals) throw new Error('GuSimulationDefaultGoals must load before simulation.js');
  if (!Intent) throw new Error('GuSimulationIntent must load before simulation.js');
  if (!Ability) throw new Error('GuSimulationAbility must load before simulation.js');
  if (!Condition) throw new Error('GuSimulationCondition must load before simulation.js');
  if (!Effect) throw new Error('GuSimulationEffect must load before simulation.js');
  if (!Consequence) throw new Error('GuSimulationConsequence must load before simulation.js');
  if (!Contracts) throw new Error('GuSimulationContracts must load before simulation.js');
  if (!RepeatableSystems) throw new Error('GuSimulationRepeatableSystems must load before simulation.js');
  if (!DirectorRules) throw new Error('GuDirectorRules must load before simulation.js');
  if (!EventRules) throw new Error('GuEventRules must load before simulation.js');
  if (!Knowledge) throw new Error('GuSimulationKnowledge must load before simulation.js');

  const SCHEMA_VERSION = 2;
  const { CONTENT_VERSION, APTITUDE, LOCATIONS, POPULATION_TABLES, FACTION_SEEDS, FACTION_INTERESTS, GU_SEEDS, EQUIPMENT_DEFS, LOCAL_OBJECT_SEEDS, NPC_SEEDS, SOURCE_NOTES, CONTENT_INDEX, CONTRACT_DEFS, CONVERSATION_DEFS } = Content;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const copy = value => JSON.parse(JSON.stringify(value));
  const hash = value => {
    let h = 2166136261;
    for (const ch of String(value)) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  };
  const random = state => {
    let x = state.rng >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state.rng = (x >>> 0) || 1;
    return state.rng / 4294967296;
  };
  const choose = (state, values) => values[Math.floor(random(state) * values.length)];
  const keyOf = (a, b) => [a, b].sort().join('::');
  const day = state => Math.floor(state.clock / 24) + 1;
  const hour = state => state.clock % 24;
  const phase = state => hour(state) < 6 ? 'night' : hour(state) < 12 ? 'morning' : hour(state) < 18 ? 'afternoon' : 'evening';

  function relation(state, a, b) {
    const key = keyOf(a, b);
    if (!state.relationships[key]) state.relationships[key] = { trust: 0, fear: 0, debt: 0, affinity: 0, lastSeen: state.clock };
    return state.relationships[key];
  }

  function affectFaction(state, factionId, attitudeDelta = 0, tensionDelta = 0) {
    const faction = state.factions[factionId];
    if (!faction) return;
    faction.attitude += attitudeDelta;
    faction.tension += tensionDelta;
  }

  function log(state, type, text, data = {}) {
    const sameClockEvent = [...(state.events?.recent || [])].reverse().find(event => event.clock === state.clock);
    const eventProvenance = data.eventProvenance || state.events?.active?.provenance || sameClockEvent?.provenance || null;
    state.logSequence = (Number(state.logSequence) || 0) + 1;
    const entry = { id: `e${state.logSequence}`, clock: state.clock, day: day(state), type, text, data, provenance: eventProvenance };
    History.record(state, entry);
    state.log.unshift(entry);
    state.events.history.push(entry);
    if (state.events.history.length > 512) state.events.history.splice(0, state.events.history.length - 512);
    if (state.log.length > 160) state.log.length = 160;
    return entry;
  }

  function remember(state, ownerId, subjectId, memory) {
    const owner = state.entities[ownerId] || state.entityCache?.[ownerId];
    if (!owner) return;
    owner.memory ||= { facts: {}, episodes: [] };
    owner.memory.facts[subjectId] ||= {};
    Object.assign(owner.memory.facts[subjectId], memory.facts || {});
    owner.memory.episodes.unshift({ clock: state.clock, subjectId, kind: memory.kind || 'observation', valence: memory.valence || 0, text: memory.text || '' });
    owner.memory.episodes = owner.memory.episodes.slice(0, 24);
    const currentEvent = [...(state.events?.recent || [])].reverse().find(event => event.clock === state.clock);
    const provenance = memory.provenance || (currentEvent?.provenance?.id ? [currentEvent.provenance.id] : []);
    Knowledge.record(owner, subjectId, memory.facts || {}, { kind: memory.kind, clock: state.clock, source: memory.source || memory.kind || 'memory', confidence: memory.confidence, provenance });
    if (memory.kind === 'suspicion' || memory.kind === 'threat' || memory.kind === 'rumor' || memory.kind === 'rumor-social') {
      Knowledge.raiseSuspicion(owner, subjectId, memory.kind === 'suspicion' ? 10 : memory.kind === 'threat' ? 12 : 3, { clock: state.clock, reason: memory.kind });
    }
  }

  let contractRuntime;
  let repeatableRuntime;
  let directorRulesRuntime;
  let eventRulesRuntime;
  let pursuitRuntime;
  let agencyRuntime;
  let marketRuntime;
  let socialRuntime;
  let combatRuntime;
  let localObjectRuntime;
  let guWorldRuntime;
  let stateNormalizer;
  function directorTick(state) {
    return Director.tick(state, { engine: Engine, day, log });
  }


  function resolveDirectorEvent(state, choice) {
    return Director.resolve(state, choice, {
      engine: Engine,
      advance,
      onChoiceResolved: ({ state: world, event, choice: selected }) => {
        const choiceDef = event.choices.find(item => item.id === selected);
        if (!choiceDef || !['ignore', 'avoid'].includes(selected) && choiceDef.consequence !== 'ignored') return;
        const consequence = Consequence.record(world, {
          kind: 'ignored_opportunity',
          actorId: world.playerId,
          source: event.source?.source || event.source || event.id,
          location: world.entities[world.playerId]?.position?.location,
          reason: `你放弃或回避了“${event.title}”中的机会。`,
          data: { eventId: event.id, choice: selected },
          pressure: 0.25
        });
        Engine.emit(world, 'world.consequence', { actorId: world.playerId, location: consequence.location, source: consequence.source, kind: consequence.kind, consequenceId: consequence.id, eventId: event.id });
      }
    });
  }


  function normalize(state) { return stateNormalizer.normalize(state); }

  function registerInteractionHandlers() {
    socialRuntime.registerInteractions(Engine);
  }

  function relValence(state, npcId) {
    const rel = relation(state, npcId, 'player');
    return clamp(rel.trust + rel.affinity - rel.fear, -100, 100);
  }

  function advance(state, hours, cause = 'action') {
    for (let i = 0; i < hours; i++) {
      const oldDay = day(state);
      state.clock += 1;
      Engine.runSystems('hour', { state, cause });
      if (day(state) !== oldDay) Engine.runSystems('day', { state, cause });
    }
    directorTick(state);
    normalize(state);
    contractRuntime.refresh(state);
    if (cause !== 'npc') state.director.lastTick = Math.min(state.director.lastTick, state.clock);
  }

  function requirePlayer(state) { return state.entities[state.playerId]; }
  function requireSameLocation(state, npcId) {
    const npc = state.entities[npcId];
    if (!npc || !npc.alive) throw new Error('目标不存在');
    if (npc.position.location !== requirePlayer(state).position.location) throw new Error('目标不在当前位置');
    return npc;
  }

  function requireNearby(state, npcId) {
    const npc = requireSameLocation(state, npcId);
    const player = requirePlayer(state);
    if (LocalMap && LocalMap.distance(player.position.cell, npc.position.cell) > 2) throw new Error('目标还在视野之外，请先走近一些');
    return npc;
  }

  function damageEntity(state, targetId, amount, sourceId, kind = 'strike') {
    return combatRuntime.damage(state, targetId, amount, sourceId, kind);
  }

  function beginConflict(state, targetId, kind = 'challenge') {
    const p = state.entities.player;
    const target = requireNearby(state, targetId);
    if (targetId === state.playerId) throw new Error('不能与自己交锋');
    state.combat = { kind, attacker: 'player', defender: targetId, round: 1, guard: false, startedAt: state.clock };
    Engine.emit(state, 'combat.started', { attackerId: 'player', defenderId: targetId, kind, location: p.position.location });
    relation(state, 'player', targetId).fear += 2;
    remember(state, targetId, 'player', { kind: 'conflict', valence: -10, text: `${p.identity.name}主动把关系推向了冲突。` });
    log(state, 'combat_start', `你与${target.identity.name}在${LOCATIONS[p.position.location].name}交锋。`, { targetId, kind });
  }

  function action(state, command) {
    const p = requirePlayer(state);
    const id = command.id;
    if (state.combat) throw new Error('冲突中只能选择攻击、防守、催动蛊术或脱身');
    if (state.events.active) throw new Error('请先处理当前世界事件');
    const registered = Engine.runAction(id, { state, command, p });
    if (registered.handled) return;
    throw new Error('未知行动');
  }

  function interpret(text, state) {
    return Intent.parse(text, state, { locations: LOCATIONS, entities: state.entities });
  }

  function dispatch(source, command) {
    if (!source || source.schema !== SCHEMA_VERSION) return { ok: false, state: source, message: '存档版本不兼容' };
    const state = copy(source);
    try {
      if (state.entities.player.cultivation.vitality <= 0) throw new Error('你已经失去行动能力');
      if (command.type === 'resolve_event') resolveDirectorEvent(state, command.choice);
      else if (command.type === 'combat') {
        const registered = Engine.runAction(command.id, { state, command, p: state.entities.player });
        if (!registered.handled) throw new Error('未知冲突动作');
      }
      else if (command.type === 'action') action(state, command);
      else throw new Error('未知指令类型');
      normalize(state);
      return { ok: true, state };
    } catch (error) {
      return { ok: false, state: source, message: error.message };
    }
  }

  function validate(raw) {
    const state = typeof raw === 'string' ? JSON.parse(raw) : copy(raw);
    if (!state || state.schema !== SCHEMA_VERSION || !state.entities?.player || !state.factions || !state.events || !state.zones) throw new Error('无效的 simulation-first 存档');
    if (!Number.isInteger(state.clock) || !Number.isInteger(state.rng) || state.rng === 0) throw new Error('存档随机状态损坏');
    if (!LOCATIONS[state.entities.player.position.location]) throw new Error('存档地点不存在');
    History.ensure(state);
    Engine.deserializeState(state);
    normalize(state);
    return state;
  }

  function snapshot(state) {
    const p = state.entities.player;
    return {
      day: day(state), hour: hour(state), phase: phase(state), location: p.position.location,
      player: { ...p.cultivation, name: Identity.visible(p, 'player', Knowledge).name, trueName: p.identity.name, activeMask: p.knowledge.activeMask, inventory: copy(p.inventory), equipment: copy(p.equipment), abilities: copy(p.abilities), needs: copy(p.needs), identity: copy(Identity.visible(p, 'player', Knowledge)) },
      combat: copy(state.combat || null), rebirth: copy(state.rebirth), encounters: copy(state.encounters),
      nearby: Engine.query(state, e => e.id !== 'player' && e.alive && e.position.location === p.position.location).map(e => { const identity = Identity.visible(e, 'player', Knowledge); return { id: e.id, name: identity.name, role: identity.role, tags: identity.tags, masked: identity.masked, goal: e.goals.active, brain: { mode: e.brain?.mode || 'idle', current: e.brain?.current?.goal || e.goals.active, plan: copy(e.brain?.plan || []).slice(0, 3), lastPerceptionClock: e.brain?.blackboard?.lastPerceptionClock ?? null }, relationship: copy(relation(state, 'player', e.id)), memory: e.memory.episodes[0] || null, effects: copy(e.effects?.active || []), suspicion: Knowledge.suspicion(e, 'player') }; }),
      factions: Object.values(state.factions).map(f => ({ id: f.id, name: f.name, influence: f.influence, tension: f.tension, attitude: f.attitude, market: copy(f.market || null) })),
      activeEvent: copy(state.events.active), zone: copy(state.zones[p.position.location]), zones: Object.fromEntries(Object.entries(state.zones).map(([id, zone]) => [id, ZoneRuntime.snapshot(zone)])), arena: copy(state.arena), inheritance: copy(state.inheritance), wolfCrisis: copy(state.wolfCrisis), marketShock: copy(state.marketShock), frontier: copy(state.frontier), tower: copy(state.tower), central: copy(state.central), blessedLand: copy(state.blessedLand), shadowNetwork: copy(state.shadowNetwork), intel: copy(state.intel), pursuit: copy(state.pursuit), agency: copy(state.agency), market: copy(state.market), social: copy(state.social), combatLedger: copy(state.combatLedger), worldWar: copy(state.worldWar), eternalWar: copy(state.eternalWar), dreamRealm: copy(state.dreamRealm), coalitions: copy(state.coalitions), contracts: copy(state.contracts), consequences: copy(state.consequences), provenance: copy(state.provenance), eventStream: copy(state.events.pending || []), domainEvents: copy(state.events.recent || []), engine: { components: Engine.COMPONENTS, registries: { ...Engine.registries(), effects: Effect.registry() } }, history: History.summary(state), log: state.log.slice(0, 20).map(copy)
    };
  }

  contractRuntime = Contracts.createRuntime({ definitions: CONTRACT_DEFS, day, copy, relation, affectFaction, remember, log, advance });
  GuComponents.register({ engine: Engine, body: Body, equipment: Equipment, effect: Effect, brain: Brain, condition: Condition, ability: Ability, knowledge: Knowledge });
  repeatableRuntime = RepeatableSystems.createRuntime({ engine: Engine, random, clamp, relation, remember, log, damageEntity, advance, consequence: Consequence.record });
  pursuitRuntime = Pursuit.createRuntime({ engine: Engine, createEntity: Entity.createEntity, locations: LOCATIONS, random, clamp, relation, remember, log, advance, knowledge: Knowledge });
  marketRuntime = Market.createRuntime({ engine: Engine, clamp, random, factionInterests: FACTION_INTERESTS });
  socialRuntime = Social.createRuntime({ engine: Engine, relation, remember, log, affectFaction, condition: Condition, market: marketRuntime });
  combatRuntime = Combat.createRuntime({ engine: Engine, body: Body, condition: Condition, effect: Effect, remember, log, consequence: Consequence.record, relation, random, ability: Ability, guSeeds: GU_SEEDS, clamp, advance });
  agencyRuntime = Agency.createRuntime({ engine: Engine, locations: LOCATIONS, random, clamp, relation, remember, log, advance, knowledge: Knowledge, market: marketRuntime });
  const guEffectDefinitions = GuEffects.register({ engine: Engine, effect: Effect });
  const affordanceRuntime = GuAffordances.register({ engine: Engine, locations: LOCATIONS, random, clamp, remember, log, consequence: Consequence.record, damageEntity, effect: Effect, advance, copy });
  localObjectRuntime = LocalObjects.createRuntime({ locations: LOCATIONS, seeds: LOCAL_OBJECT_SEEDS, localMap: LocalMap });
  stateNormalizer = GuState.createRuntime({
    engine: Engine, social: Social, combat: Combat, condition: Condition,
    consequence: Consequence, knowledge: Knowledge, identity: Identity,
    equipment: Equipment, brain: Brain, zoneRuntime: ZoneRuntime,
    market: marketRuntime, factionInterests: FACTION_INTERESTS, locations: LOCATIONS, localMap: LocalMap, localObjects: localObjectRuntime, copy, clamp
  });
  guWorldRuntime = GuWorld.createRuntime({
    schema: SCHEMA_VERSION, contentIndex: CONTENT_INDEX, contentVersion: CONTENT_VERSION, aptitude: APTITUDE,
    locations: LOCATIONS, populationTables: POPULATION_TABLES, factionSeeds: FACTION_SEEDS,
    factionInterests: FACTION_INTERESTS, npcSeeds: NPC_SEEDS, sourceNotes: SOURCE_NOTES,
    history: History, entity: Entity, identity: Identity, knowledge: Knowledge,
    zoneBuilder: ZoneBuilder, zoneRuntime: ZoneRuntime, copy, hash, random, day,
    relation, affectFaction, remember, log, advance, localMap: LocalMap, localObjects: localObjectRuntime
  });
  directorRulesRuntime = DirectorRules.createRuntime({ engine: Engine, day, sourceNotes: SOURCE_NOTES });
  eventRulesRuntime = EventRules.createRuntime({ engine: Engine, day, sourceNotes: SOURCE_NOTES, activateSeed: guWorldRuntime.activateSeed, relation, remember, log, affectFaction, advance, clamp, applyOpening: guWorldRuntime.applyOpening, pursuit: pursuitRuntime, consequence: Consequence.record, factionPacts: FactionPacts });
  directorRulesRuntime.registerRules();
  eventRulesRuntime.registerHandlers();
  GuGoals.register({ engine: Engine, locations: LOCATIONS, clamp, relation, remember, log, factionPacts: FactionPacts, affordances: affordanceRuntime, localObjects: localObjectRuntime });
  DefaultGoals.register({ engine: Engine, remember, market: marketRuntime, log, factionPacts: FactionPacts, affordances: affordanceRuntime });
  registerInteractionHandlers();
  GuListeners.register({ engine: Engine, rumor: Rumor, locations: LOCATIONS, remember, clamp, identity: Identity, knowledge: Knowledge, log });
  GuActions.register({
    engine: Engine, locations: LOCATIONS, guSeeds: GU_SEEDS, equipmentDefs: EQUIPMENT_DEFS,
    zoneRuntime: ZoneRuntime, consequence: Consequence.record, remember, log, damageEntity,
    advance, random, copy, relation, requireSameLocation, requireNearby, beginConflict, ability: Ability,
    body: Body, equipment: Equipment, conversation: Conversation, conversationDefs: CONVERSATION_DEFS,
    day, affectFaction, identity: Identity, knowledge: Knowledge, contractRuntime,
    repeatableRuntime, pursuitRuntime, agencyRuntime, combatRuntime, marketRuntime,
    rebirth: guWorldRuntime.rebirth, factionPacts: FactionPacts, affordances: affordanceRuntime, localMap: LocalMap, localObjects: localObjectRuntime
  });
  GuSystems.register({
    engine: Engine, history: History, zoneRuntime: ZoneRuntime, npcAI: NpcAI, brain: Brain,
    social: socialRuntime, combat: combatRuntime, market: marketRuntime, pursuit: pursuitRuntime, knowledge: Knowledge,
    agency: agencyRuntime, condition: Condition, effect: Effect, locations: LOCATIONS, phase,
    hour, day, random, clamp, relation, remember, log, relValence, consequence: Consequence.record,
    damageEntity, factionPacts: FactionPacts, localMap: LocalMap, localObjects: localObjectRuntime
  });
  return { SCHEMA_VERSION, CONTENT_VERSION, CONTENT_INDEX, CONTRACT_DEFS, CONVERSATION_DEFS, LOCATIONS, FACTION_SEEDS, FACTION_INTERESTS, GU_SEEDS, EQUIPMENT_DEFS, LOCAL_OBJECT_SEEDS, SOURCE_NOTES, LOCAL_MAP: LocalMap, LOCAL_OBJECTS: localObjectRuntime, ENGINE: Engine, ENTITY: Entity, CONDITION: Condition, EQUIPMENT: Equipment, EFFECTS: Effect, CONSEQUENCES: Consequence, PROVENANCE: Provenance, SOCIAL: socialRuntime, COMBAT: combatRuntime, BODY: Body, BRAIN: Brain, GOAL_HANDLER: Brain.goalHandler, KNOWLEDGE: Knowledge, IDENTITY: Identity, PURSUIT: pursuitRuntime, AGENCY: agencyRuntime, MARKET: marketRuntime, CONTRACTS: contractRuntime, REPEATABLE_SYSTEMS: repeatableRuntime, DIRECTOR_RULES: directorRulesRuntime, EVENT_RULES: eventRulesRuntime, ZONE_BUILDER: ZoneBuilder, ZONE_RUNTIME: ZoneRuntime, NPC_AI: NpcAI, DEFAULT_GOALS: DefaultGoals, CONVERSATION_RUNTIME: Conversation, RUMOR: Rumor, ACTION_CATALOG: ActionCatalog, DIRECTOR: Director, INTENT: Intent, ABILITY: Ability, FACTION_PACTS: FactionPacts, GU_EFFECTS: guEffectDefinitions, AFFORDANCES: affordanceRuntime, GU_COMPONENTS: GuComponents, GU_GOALS: GuGoals, GU_LISTENERS: GuListeners, GU_ACTIONS: GuActions, GU_SYSTEMS: GuSystems, GU_WORLD: guWorldRuntime, GU_STATE: stateNormalizer, newWorld: guWorldRuntime.newWorld, dispatch, interpret, validate, snapshot, day, hour, phase };
});
