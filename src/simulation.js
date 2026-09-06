(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./content.js'), require('./history.js'), require('./zone-builder.js'), require('./zone-runtime.js'), require('./npc-ai.js'), require('./entity.js'), require('./conversation.js'), require('./rumor.js'), require('./action-catalog.js'), require('./director.js'), require('./default-goals.js'), require('./intent.js'), require('./ability.js'), require('./condition.js'), require('./body.js'), require('./contracts.js'), require('./repeatable-systems.js'), require('./gu-director-rules.js'), require('./gu-event-rules.js'), require('./knowledge.js'), require('./identity.js'), require('./pursuit.js'), require('./agency.js'), require('./market.js'), require('./brain.js'));
  else root.GuSimulation = factory(root.GuSimulationEngine, root.GuSimulationContent, root.GuSimulationHistory, root.GuSimulationZoneBuilder, root.GuSimulationZoneRuntime, root.GuSimulationNpcAI, root.GuSimulationEntity, root.GuSimulationConversation, root.GuSimulationRumor, root.GuSimulationActionCatalog, root.GuSimulationDirector, root.GuSimulationDefaultGoals, root.GuSimulationIntent, root.GuSimulationAbility, root.GuSimulationCondition, root.GuSimulationBody, root.GuSimulationContracts, root.GuSimulationRepeatableSystems, root.GuDirectorRules, root.GuEventRules, root.GuSimulationKnowledge, root.GuSimulationIdentity, root.GuSimulationPursuit, root.GuSimulationAgency, root.GuSimulationMarket, root.GuSimulationBrain);
})(globalThis, function (Engine, Content, History, ZoneBuilder, ZoneRuntime, NpcAI, Entity, Conversation, Rumor, ActionCatalog, Director, DefaultGoals, Intent, Ability, Condition, Body, Contracts, RepeatableSystems, DirectorRules, EventRules, Knowledge, Identity, Pursuit, Agency, Market, Brain) {
  'use strict';

  if (!Engine) throw new Error('GuSimulationEngine must load before simulation.js');
  if (!Content) throw new Error('GuSimulationContent must load before simulation.js');
  if (!Identity) throw new Error('GuSimulationIdentity must load before simulation.js');
  if (!Pursuit) throw new Error('GuSimulationPursuit must load before simulation.js');
  if (!Agency) throw new Error('GuSimulationAgency must load before simulation.js');
  if (!Market) throw new Error('GuSimulationMarket must load before simulation.js');
  if (!Brain) throw new Error('GuSimulationBrain must load before simulation.js');
  if (!History) throw new Error('GuSimulationHistory must load before simulation.js');
  if (!ZoneBuilder) throw new Error('GuSimulationZoneBuilder must load before simulation.js');
  if (!ZoneRuntime) throw new Error('GuSimulationZoneRuntime must load before simulation.js');
  if (!Body) throw new Error('GuSimulationBody must load before simulation.js');
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
  if (!Contracts) throw new Error('GuSimulationContracts must load before simulation.js');
  if (!RepeatableSystems) throw new Error('GuSimulationRepeatableSystems must load before simulation.js');
  if (!DirectorRules) throw new Error('GuDirectorRules must load before simulation.js');
  if (!EventRules) throw new Error('GuEventRules must load before simulation.js');
  if (!Knowledge) throw new Error('GuSimulationKnowledge must load before simulation.js');

  const SCHEMA_VERSION = 2;
  const { CONTENT_VERSION, APTITUDE, LOCATIONS, POPULATION_TABLES, FACTION_SEEDS, GU_SEEDS, NPC_SEEDS, SOURCE_NOTES, CONTENT_INDEX, CONTRACT_DEFS, CONVERSATION_DEFS } = Content;
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
    const entry = { id: `e${state.events.history.length + 1}`, clock: state.clock, day: day(state), type, text, data };
    History.record(state, entry);
    state.log.unshift(entry);
    state.events.history.push(entry);
    if (state.log.length > 160) state.log.length = 160;
    return entry;
  }

  function remember(state, ownerId, subjectId, memory) {
    const owner = state.entities[ownerId];
    if (!owner) return;
    owner.memory ||= { facts: {}, episodes: [] };
    owner.memory.facts[subjectId] ||= {};
    Object.assign(owner.memory.facts[subjectId], memory.facts || {});
    owner.memory.episodes.unshift({ clock: state.clock, subjectId, kind: memory.kind || 'observation', valence: memory.valence || 0, text: memory.text || '' });
    owner.memory.episodes = owner.memory.episodes.slice(0, 24);
    Knowledge.record(owner, subjectId, memory.facts || {}, { kind: memory.kind, clock: state.clock, source: memory.source || memory.kind || 'memory', confidence: memory.confidence, provenance: memory.provenance || [] });
    if (memory.kind === 'suspicion' || memory.kind === 'threat' || memory.kind === 'rumor' || memory.kind === 'rumor-social') {
      Knowledge.raiseSuspicion(owner, subjectId, memory.kind === 'suspicion' ? 10 : memory.kind === 'threat' ? 12 : 3, { clock: state.clock, reason: memory.kind });
    }
  }

  function activateSeed(state, id) {
    if (state.entities[id]) return state.entities[id];
    const seed = NPC_SEEDS[id];
    if (!seed) throw new Error(`内容包中不存在 NPC：${id}`);
    const entity = Entity.createEntity(id, seed);
    state.entities[id] = entity;
    if (state.facts.latentNpcs) delete state.facts.latentNpcs[id];
    remember(state, id, 'world', { kind: 'arrival', text: `${seed.name}进入了青茅山的公共视野。`, facts: { arrivedDay: day(state) } });
    log(state, 'world_arrival', `${seed.name}进入了当前区域的公共视野。`, { npcId: id });
    return entity;
  }

  let contractRuntime;
  let repeatableRuntime;
  let directorRulesRuntime;
  let eventRulesRuntime;
  let pursuitRuntime;
  let agencyRuntime;
  let marketRuntime;

  function newWorld(options = {}) {
    const seed = String(options.seed ?? '青茅山');
    const aptitudeName = APTITUDE[options.aptitude] ? options.aptitude : '丙等';
    const state = {
      schema: SCHEMA_VERSION,
      content: { id: CONTENT_INDEX.id, version: CONTENT_VERSION },
      history: History.create(seed, { id: CONTENT_INDEX.id, version: CONTENT_VERSION }),
      contracts: { available: [], active: {}, completed: [] },
      seed,
      rng: hash(seed),
      clock: 6,
      playerId: 'player',
      entities: {},
      locations: copy(LOCATIONS),
      zones: {},
      factions: {},
      relationships: {},
      facts: {},
      flags: { openingRiteResolved: false, moonlightRumor: false, relicDiscovered: false, marketArrived: false, auctionHeld: false, allianceCouncil: false, wolfTide: false, tournamentAnnounced: false, investigationArrived: false, merchantCityOpened: false, arenaTrial: false, threeKingsAwakened: false, heavenClimbRumor: false, northernFrontierOpened: false, blackCampaign: false, imperialCourtOpened: false, trueYangTowerFormed: false, foxFairyLandOpened: false, centralContinentOpened: false, immortalAuctionOpened: false, sectPressureActive: false, shadowSectRebuilt: false, fiveRegionsWarOpened: false, southernFrontOpened: false, westernFrontOpened: false, heavenlyCourtOpened: false, divineEmperorOpened: false, twoHeavensOpened: false, madDemonCaveOpened: false, dreamSurgeOpened: false, starHostPlanOpened: false },
      events: { active: null, pending: [], recent: [], history: [], sequence: 0 },
      combat: null,
      arena: { location: 'merchantCity', active: false, matches: 0, wins: 0, losses: 0, streak: 0, reputation: 0 },
      inheritance: { location: 'threeForkMountain', active: false, attempts: 0, round: 0, difficulty: 1, discoveries: [], completed: false },
      frontier: { location: 'northernPlains', opened: false, supply: 72, campaignPressure: 0, battles: 0, casualties: 0 },
      tower: { location: 'trueYangTower', formed: false, floors: 0, attempts: 0, discoveries: [], active: false },
      central: { foxOpened: false, centralOpened: false, auctionActive: false, lotsSold: 0, auctionHeat: 0, sectPressure: 0, marketSupply: 72, marketScarcity: 28, rumorCredibility: 58, marketDebt: 0, marketReputation: 0, tracePressure: 0 },
      worldWar: { shadowRebuilt: false, fiveRegions: false, southern: false, western: false, heavenly: false, heat: 0 },
      eternalWar: { divineEmperor: false, twoHeavens: false, madDemonCave: false, dream: false, starHost: false, dreamPressure: 0, cosmicHeat: 0, dives: 0, successes: 0, failures: 0 },
      intel: { leads: [], cases: {} },
      pursuit: { teams: {}, sequence: 0, alert: 0, contacts: 0 },
      agency: { commissions: {}, sequence: 0, reputation: 0, completed: 0, failed: 0 },
      market: { prices: {}, supply: {}, demand: {}, transactions: [], day: 1 },
      director: { pressure: 0, lastTick: 0, thread: [], history: [], cooldowns: {}, beat: 'opening' },
      log: [],
      version: 1
    };
    for (const [id, faction] of Object.entries(FACTION_SEEDS)) state.factions[id] = { id, ...copy(faction), relations: {} };
    state.entities.player = Entity.createEntity('player', {
      name: String(options.name || '古月族人').slice(0, 20), role: '玩家', faction: 'guYue', location: 'academy',
      cultivation: { rank: 1, stage: 0, aptitude: APTITUDE[aptitudeName], aptitudeName, progress: 0, essence: 32, essenceMax: 50, vitality: 100, insight: 8 },
      schedule: {}, goals: ['survive', 'grow']
    });
    state.entities.player.inventory = { water: 5, moonPetal: 6, wine: 1, stones: 8 };
    state.entities.player.body.health = state.entities.player.body.maxHealth;
    state.entities.player.needs = { energy: 92, hunger: 8, safety: 70 };
    Identity.ensure(state.entities.player, Knowledge);
    for (const [id, seedData] of Object.entries(NPC_SEEDS)) {
      if (seedData.fromDay && seedData.fromDay > day(state)) { state.facts.latentNpcs ||= {}; state.facts.latentNpcs[id] = seedData.fromDay; }
      else state.entities[id] = Entity.createEntity(id, seedData);
    }
    state.zones = ZoneBuilder.buildZones(LOCATIONS);
    ZoneRuntime.ensureState(state, state.entities.player.position.location);
    ZoneBuilder.seedPopulation(state, { locations: LOCATIONS, populationTables: POPULATION_TABLES, random, createEntity: Entity.createEntity });
    for (const id of Object.keys(state.entities)) remember(state, id, 'world', { kind: 'origin', text: '青茅山的雨季刚刚开始。', facts: { region: '青茅山' } });
    relation(state, 'player', 'fangyuan').fear = 4;
    relation(state, 'player', 'fangzheng').trust = 6;
    relation(state, 'player', 'guYue').trust = 8;
    const factionIds = Object.keys(state.factions);
    for (const a of factionIds) for (const b of factionIds) if (a !== b) state.factions[a].relations[b] = a === 'guYue' && ['bai', 'xiong', 'demonic'].includes(b) ? -24 : 0;
    state.events.active = openingEvent(state);
    log(state, 'world_started', `第${day(state)}日，青茅山的开窍大典即将开始。`, { source: SOURCE_NOTES.opening });
    return state;
  }

  function openingEvent(state) {
    return {
      id: 'openingRite', type: 'rite', title: '开窍大典前的选择',
      text: '宗祖祠堂的灯火映在雨幕里。你可以把自己的真实资质交给家族，也可以先观察，再决定要让谁知道。',
      source: SOURCE_NOTES.academy,
      choices: [
        { id: 'reveal', label: '如实参加开窍大典', hint: '获得家族信任，减少隐匿空间。' },
        { id: 'observe', label: '先观察家老与同辈的反应', hint: '获得线索与秘密，降低初始公开度。' },
        { id: 'challenge', label: '主动展示胆识', hint: '提高威胁感，也可能让竞争者记住你。' }
      ]
    };
  }

  function directorTick(state) {
    return Director.tick(state, { engine: Engine, day, log });
  }


  function applyOpening(state, choice) {
    const p = state.entities.player;
    state.flags.openingRiteResolved = true;
    state.events.active = null;
    if (choice === 'reveal') {
      relation(state, 'player', 'guYue').trust += 12;
      affectFaction(state, 'guYue', 5, -1);
      p.memory.facts.world.opening = '公开参加开窍大典';
      log(state, 'choice', '你如实参加开窍大典，家族开始把你视作可培养的变量。');
    } else if (choice === 'observe') {
      p.cultivation.insight += 4;
      p.cultivation.essence += 4;
      p.memory.facts.world.opening = '观察后再决定';
      remember(state, 'fangyuan', 'player', { kind: 'observation', valence: 4, text: '这个人知道什么时候不说话。' });
      log(state, 'choice', '你先观察局势，获得了线索，也让自己没有立刻被归类。');
    } else {
      state.director.pressure += 2;
      relation(state, 'player', 'mobei').fear += 7;
      relation(state, 'player', 'chicheng').fear += 5;
      log(state, 'choice', '你主动展示胆识，竞争者和家老都记住了你的名字。');
    }
    advance(state, 1, 'openingRite');
  }

  function resolveDirectorEvent(state, choice) {
    return Director.resolve(state, choice, { engine: Engine, advance });
  }


  function normalize(state) {
    const p = state.entities.player;
    for (const entity of Object.values(state.entities || {})) { Knowledge.ensure(entity); Identity.ensure(entity, Knowledge); Brain.ensure(entity); }
    Engine.initializeComponents(state);
    ZoneRuntime.ensureState(state, p?.position?.location);
    state.contracts ||= { available: [], active: {}, completed: [] };
    state.contracts.available ||= []; state.contracts.active ||= {}; state.contracts.completed ||= [];
    state.arena ||= { location: 'merchantCity', active: false, matches: 0, wins: 0, losses: 0, streak: 0, reputation: 0 };
    state.inheritance ||= { location: 'threeForkMountain', active: false, attempts: 0, round: 0, difficulty: 1, discoveries: [], completed: false };
    state.frontier ||= { location: 'northernPlains', opened: false, supply: 72, campaignPressure: 0, battles: 0, casualties: 0 };
    state.tower ||= { location: 'trueYangTower', formed: false, floors: 0, attempts: 0, discoveries: [], active: false };
    state.central ||= { foxOpened: false, centralOpened: false, auctionActive: false, lotsSold: 0, auctionHeat: 0, sectPressure: 0, marketSupply: 72, marketScarcity: 28, rumorCredibility: 58, marketDebt: 0, marketReputation: 0, tracePressure: 0 };
    state.central.marketSupply ??= 72; state.central.marketScarcity ??= 28; state.central.rumorCredibility ??= 58; state.central.marketDebt ??= 0; state.central.marketReputation ??= 0; state.central.tracePressure ??= 0;
    state.worldWar ||= { shadowRebuilt: false, fiveRegions: false, southern: false, western: false, heavenly: false, heat: 0 };
    state.eternalWar ||= { divineEmperor: false, twoHeavens: false, madDemonCave: false, dream: false, starHost: false, dreamPressure: 0, cosmicHeat: 0, dives: 0, successes: 0, failures: 0 };
    state.intel ||= { leads: [], cases: {} }; state.intel.leads ||= []; state.intel.cases ||= {};
    state.intel.leads = state.intel.leads.slice(0, 256);
    state.pursuit ||= { teams: {}, sequence: 0, alert: 0, contacts: 0 }; state.pursuit.teams ||= {}; state.pursuit.sequence = Math.max(0, Number(state.pursuit.sequence) || 0); state.pursuit.alert = clamp(Number(state.pursuit.alert) || 0, 0, 100); state.pursuit.contacts = Math.max(0, Number(state.pursuit.contacts) || 0);
    state.agency ||= { commissions: {}, sequence: 0, reputation: 0, completed: 0, failed: 0 }; state.agency.commissions ||= {}; state.agency.sequence = Math.max(0, Number(state.agency.sequence) || 0); state.agency.reputation = clamp(Number(state.agency.reputation) || 0, -100, 100); state.agency.completed = Math.max(0, Number(state.agency.completed) || 0); state.agency.failed = Math.max(0, Number(state.agency.failed) || 0);
    state.market ||= { prices: {}, supply: {}, demand: {}, transactions: [], day: 1 }; marketRuntime.ensure(state); state.market.transactions = state.market.transactions.slice(0, 256);
    state.director ||= { pressure: 0, lastTick: 0, thread: [], history: [], cooldowns: {}, beat: 'opening' };
    state.director.thread ||= []; state.director.history ||= []; state.director.cooldowns ||= {};
    state.arena.matches = Math.max(0, Number(state.arena.matches) || 0); state.arena.wins = Math.max(0, Number(state.arena.wins) || 0); state.arena.losses = Math.max(0, Number(state.arena.losses) || 0); state.arena.streak = Math.max(0, Number(state.arena.streak) || 0); state.arena.reputation = Math.max(0, Number(state.arena.reputation) || 0);
    state.inheritance.attempts = Math.max(0, Number(state.inheritance.attempts) || 0); state.inheritance.round = Math.max(0, Number(state.inheritance.round) || 0); state.inheritance.difficulty = Math.max(1, Number(state.inheritance.difficulty) || 1); state.inheritance.discoveries ||= [];
    state.frontier.supply = clamp(Number(state.frontier.supply) || 0, 0, 100); state.frontier.campaignPressure = clamp(Number(state.frontier.campaignPressure) || 0, 0, 100); state.frontier.battles = Math.max(0, Number(state.frontier.battles) || 0); state.frontier.casualties = Math.max(0, Number(state.frontier.casualties) || 0);
    state.tower.floors = Math.max(0, Number(state.tower.floors) || 0); state.tower.attempts = Math.max(0, Number(state.tower.attempts) || 0); state.tower.discoveries ||= [];
    state.central.lotsSold = Math.max(0, Number(state.central.lotsSold) || 0); state.central.auctionHeat = clamp(Number(state.central.auctionHeat) || 0, 0, 100); state.central.sectPressure = clamp(Number(state.central.sectPressure) || 0, 0, 100); state.central.marketSupply = clamp(Number(state.central.marketSupply) || 0, 0, 100); state.central.marketScarcity = clamp(Number(state.central.marketScarcity) || 0, 0, 100); state.central.rumorCredibility = clamp(Number(state.central.rumorCredibility) || 0, 0, 100); state.central.marketDebt = clamp(Number(state.central.marketDebt) || 0, 0, 100); state.central.marketReputation = clamp(Number(state.central.marketReputation) || 0, -100, 100); state.central.tracePressure = clamp(Number(state.central.tracePressure) || 0, 0, 100);
    state.worldWar.heat = clamp(Number(state.worldWar.heat) || 0, 0, 100);
    state.eternalWar.dreamPressure = clamp(Number(state.eternalWar.dreamPressure) || 0, 0, 100);
    state.eternalWar.cosmicHeat = clamp(Number(state.eternalWar.cosmicHeat) || 0, 0, 100);
    state.eternalWar.dives = Math.max(0, Number(state.eternalWar.dives) || 0);
    state.eternalWar.successes = Math.max(0, Number(state.eternalWar.successes) || 0);
    state.eternalWar.failures = Math.max(0, Number(state.eternalWar.failures) || 0);
    for (const entity of Engine.queryWith(state, 'cultivation')) {
      Condition.ensure(entity);
      const c = entity.cultivation;
      c.rank = clamp(Number(c.rank) || 1, 1, 9);
      c.stage = clamp(Number(c.stage) || 0, 0, 3);
      c.aptitude = clamp(Number(c.aptitude) || 0.45, 0, 1);
      c.progress = clamp(Number(c.progress) || 0, 0, 100);
      c.insight = Math.max(0, Number(c.insight) || 0);
      c.essenceMax = Math.max(20, Math.round(34 + c.aptitude * 38 + c.stage * 8 + (c.rank - 1) * 12));
      c.essence = clamp(Number(c.essence) || 0, 0, c.essenceMax);
    }
    p.cultivation.rank = clamp(p.cultivation.rank, 1, 9);
    p.cultivation.stage = clamp(p.cultivation.stage, 0, 3);
    p.cultivation.essenceMax = Math.max(20, Math.round(34 + p.cultivation.aptitude * 38 + p.cultivation.stage * 8 + (p.cultivation.rank - 1) * 12));
    p.cultivation.essence = clamp(p.cultivation.essence, 0, p.cultivation.essenceMax);
    p.cultivation.progress = clamp(p.cultivation.progress, 0, 100);
    p.cultivation.vitality = clamp(p.cultivation.vitality, 0, 100);
    if (!p.body) p.body = { maxHealth: 78, health: 78, wounds: [], limbs: { head: 100, torso: 100, leftArm: 100, rightArm: 100, leftLeg: 100, rightLeg: 100 } };
    p.body.maxHealth = Math.max(1, Number(p.body.maxHealth) || 78);
    p.body.health = clamp(Number(p.body.health) || 0, 0, p.body.maxHealth);
    p.cultivation.vitality = clamp((p.body.health / p.body.maxHealth) * 100, 0, 100);
    for (const entity of Engine.queryWith(state, 'body', 'alive')) {
      entity.body.maxHealth = Math.max(1, Number(entity.body.maxHealth) || 1);
      entity.body.health = clamp(Number(entity.body.health) || 0, 0, entity.body.maxHealth);
      if (entity.body.health <= 0) entity.alive = false;
    }
    p.needs.energy = clamp(p.needs.energy, 0, 100);
    p.needs.hunger = clamp(p.needs.hunger, 0, 100);
    for (const faction of Object.values(state.factions)) {
      faction.influence = clamp(faction.influence, 0, 100);
      faction.tension = clamp(faction.tension, 0, 100);
      faction.attitude = clamp(faction.attitude, -100, 100);
    }
    for (const zone of Object.values(state.zones || {})) {
      zone.danger = clamp(Number(zone.danger) || 0, 0, 100);
      zone.activity = clamp(Number(zone.activity) || 0, 0, 100);
      zone.visits = Math.max(0, Number(zone.visits) || 0);
      for (const key of Object.keys(zone.resources || {})) zone.resources[key] = Math.max(0, Number(zone.resources[key]) || 0);
    }
  }

  function registerGoalHandlers() {
    Engine.registerGoal('secureResources', ({ state, npc, faction }) => {
      if (!['bambooForest', 'riverbank'].includes(npc.position.location)) return false;
      const zone = state.zones[npc.position.location];
      if (zone?.resources.moonPetal > 0) { zone.resources.moonPetal -= 1; npc.inventory.moonPetal = (npc.inventory.moonPetal || 0) + 1; }
      if (zone) zone.activity += 4;
      if (faction) faction.influence += 0.4;
      Engine.emit(state, 'npc.goal_action', { npcId: npc.id, goal: 'secureResources', location: npc.position.location, faction: npc.faction });
      log(state, 'npc_goal_action', `${npc.identity.name}为了资源在${LOCATIONS[npc.position.location].name}搜寻。`, { npcId: npc.id, goal: 'secureResources' });
      return true;
    });
    Engine.registerGoal('findRelic', ({ state, npc }) => {
      if (!['bambooForest', 'riverbank', 'cliffCave'].includes(npc.position.location)) return false;
      state.facts.relicInterest = (state.facts.relicInterest || 0) + 1;
      state.director.pressure = clamp(state.director.pressure + 0.4, 0, 10);
      remember(state, npc.id, 'world', { kind: 'secret', valence: 2, text: '竹林深处的遗藏并不只吸引一个人。', facts: { relicInterest: true } });
      Engine.emit(state, 'npc.goal_action', { npcId: npc.id, goal: 'findRelic', location: npc.position.location, fact: 'relicInterest' });
      log(state, 'npc_goal_action', `${npc.identity.name}在追查一条关于遗藏的线索。`, { npcId: npc.id, goal: 'findRelic' });
      return true;
    });
    Engine.registerGoal('winRivalry', ({ state, npc }) => {
      if (npc.position.location !== 'academy') return false;
      state.factions.guYue.tension += 0.7;
      relation(state, npc.id, 'fangzheng').affinity -= 1;
      Engine.emit(state, 'npc.goal_action', { npcId: npc.id, goal: 'winRivalry', location: npc.position.location, faction: npc.faction });
      log(state, 'npc_goal_action', `${npc.identity.name}在学堂争取表现，竞争压力上升。`, { npcId: npc.id, goal: 'winRivalry' });
      return true;
    });
    Engine.registerGoal('trade', ({ state, npc, faction }) => {
      if (!['caravanCamp', 'village'].includes(npc.position.location)) return false;
      if (faction) faction.influence += 0.6;
      state.facts.marketActivity = (state.facts.marketActivity || 0) + 1;
      Engine.emit(state, 'npc.goal_action', { npcId: npc.id, goal: 'trade', location: npc.position.location, faction: npc.faction });
      log(state, 'npc_goal_action', `${npc.identity.name}完成了一次交易，商路继续流动。`, { npcId: npc.id, goal: 'trade' });
      return true;
    });
    Engine.registerGoal('protectBrother', ({ state }) => {
      relation(state, 'fangzheng', 'fangyuan').trust += 0.4;
      remember(state, 'fangzheng', 'fangyuan', { kind: 'family', valence: 1, text: '你仍然把方源视作需要证明自己的兄长。' });
      return true;
    });
    Engine.registerGoal('avoidPlayer', ({ state, npc }) => {
      npc.needs.safety = clamp(npc.needs.safety + 2, 0, 100);
      remember(state, npc.id, 'player', { kind: 'avoidance', valence: -1, text: '你暂时不想和这个人再次碰面。' });
      return true;
    });
    Engine.registerGoal('findFood', ({ state, npc }) => {
      const zone = state.zones[npc.position.location];
      if (!zone?.resources.food) return false;
      zone.resources.food -= 1;
      npc.needs.hunger = clamp(npc.needs.hunger - 18, 0, 100);
      zone.activity += 2;
      Engine.emit(state, 'npc.goal_action', { npcId: npc.id, goal: 'findFood', location: npc.position.location });
      return true;
    });
    Engine.registerGoal('gainRecognition', ({ state, npc, faction }) => {
      if (faction) faction.influence += 0.3;
      state.director.pressure = clamp(state.director.pressure + 0.1, 0, 10);
      remember(state, npc.id, 'world', { kind: 'ambition', valence: 1, text: `${npc.identity.name}在压力上升时选择争取存在感。` });
      return true;
    });
    Engine.registerGoal('prepareAlliance', ({ state, npc }) => {
      state.facts.allianceInterest = (state.facts.allianceInterest || 0) + 1;
      if (npc.faction === 'guYue') state.factions.guYue.relations.bai += 0.2;
      return true;
    });
  }

  function registerInteractionHandlers() {
    Engine.registerInteraction('help', ({ state, p, npc, relation: r, memoryBoost }) => {
      r.trust += 7 + memoryBoost; r.debt += 1;
      if (npc.faction) affectFaction(state, npc.faction, 2, -0.5);
      remember(state, npc.id, 'player', { kind: 'help', valence: 10, text: `${p.identity.name}曾在关键时刻帮助过你。`, facts: { helped: true } });
      log(state, 'social', `${npc.identity.name}接受了你的帮助，人情被记在账上。`);
      return true;
    });
    Engine.registerInteraction('threaten', ({ state, p, npc, relation: r }) => {
      r.fear += 9; r.trust -= 5;
      Condition.apply(npc, 'afraid', { duration: 18, intensity: 1, source: p.id, clock: state.clock });
      if (npc.faction) affectFaction(state, npc.faction, -2, 2);
      state.director.pressure += 1;
      remember(state, npc.id, 'player', { kind: 'threat', valence: -8, text: `${p.identity.name}让你感到危险。` });
      log(state, 'social', `你向${npc.identity.name}施压，短期得到让步，长期留下阴影。`);
      return true;
    });
    Engine.registerInteraction('trade', ({ state, p, npc, relation: r }) => {
      if ((p.inventory.stones || 0) < 1) throw new Error('元石不足');
      p.inventory.stones -= 1; p.inventory.water += 1; r.trust += 2;
      if (npc.faction) affectFaction(state, npc.faction, 1, 0);
      log(state, 'social', `你与${npc.identity.name}完成了一次小交易。`);
      return true;
    });
    Engine.registerInteraction('listen', ({ state, p, npc, relation: r, memoryBoost }) => {
      r.trust += 1 + memoryBoost * 0.2; p.cultivation.insight += 1;
      remember(state, npc.id, 'player', { kind: 'conversation', valence: 2, text: `你和${p.identity.name}谈过一次。` });
      log(state, 'social', `你与${npc.identity.name}交谈，双方更新了对彼此的判断。`);
      return true;
    });
  }

  function registerEventListeners() {
    Engine.registerEventListener('*', 'rumorPropagation', ({ state, event }) => {
      Rumor.propagate(state, event, { locations: LOCATIONS, query: Engine.query, remember });
    });
    Engine.registerEventListener('world.travel', 'zoneVisitAccounting', ({ state, event }) => {
      const zone = state.zones[event.payload.to];
      if (!zone) return;
      zone.visits += 1;
      zone.activity += 2;
    });
    Engine.registerEventListener('arena.match', 'arenaCrowdActivity', ({ state, event }) => {
      const zone = state.zones.merchantCity;
      if (zone) zone.activity += event.payload.result === 'win' ? 5 : 3;
    });
    Engine.registerEventListener('inheritance.round', 'inheritanceFrontierPressure', ({ state, event }) => {
      const zone = state.zones.threeForkMountain;
      if (zone) {
        zone.activity += event.payload.result === 'success' ? 5 : 2;
        zone.danger += event.payload.result === 'success' ? 1 : 0.5;
      }
    });
    Engine.registerEventListener('frontier.patrol', 'frontierWarPressure', ({ state, event }) => {
      const zone = state.zones[state.frontier.location];
      if (zone) zone.activity += event.payload.result === 'success' ? 8 : 5;
      if (state.factions.black) state.factions.black.tension += event.payload.result === 'success' ? 0.5 : 1.5;
    });
    Engine.registerEventListener('tower.floor', 'towerCompetitionPressure', ({ state, event }) => {
      const zone = state.zones.trueYangTower;
      if (zone) { zone.activity += event.payload.result === 'success' ? 7 : 4; zone.danger += event.payload.result === 'success' ? 1 : 2; }
      if (state.factions.giantSun) state.factions.giantSun.tension += event.payload.result === 'success' ? 0.5 : 1;
    });
    Engine.registerEventListener('auction.lot', 'auctionMarketActivity', ({ state, event }) => {
      const zone = state.zones.immortalAuction;
      if (zone) zone.activity += event.payload.result === 'bid' ? 8 : 4;
      if (state.factions.auctionImmortals) state.factions.auctionImmortals.tension += event.payload.result === 'bid' ? 0.8 : ['raise', 'rumor'].includes(event.payload.result) ? 1.2 : 0.2;
      if (event.payload.trace >= 10) {
        state.director.pressure = clamp(state.director.pressure + Math.min(0.5, event.payload.trace * 0.005), 0, 10);
        const qin = state.entities.qinbaisheng;
        if (qin) Identity.exposeTrace(state.entities.player, qin, state.clock, Knowledge, '拍卖追踪');
      }
    });
    Engine.registerEventListener('market.trade', 'marketActivity', ({ state, event }) => {
      const zone = state.zones[event.payload.location];
      if (zone) zone.activity += event.payload.side === 'buy' ? 2 : 1;
      const faction = event.payload.factionId && state.factions[event.payload.factionId];
      if (faction) faction.influence += event.payload.side === 'buy' ? 0.15 : 0.1;
      const actor = state.entities[event.payload.actorId];
      log(state, 'market_trade', `${actor?.identity?.name || '某人'}在${LOCATIONS[event.payload.location]?.name || event.payload.location}完成了一笔${event.payload.side === 'buy' ? '买入' : '卖出'}。`, { ...event.payload });
    });
    Engine.registerEventListener('dream.dive', 'dreamRealmPressure', ({ state, event }) => {
      const zone = state.zones.dreamRealms;
      if (zone) { zone.activity += event.payload.result === 'success' ? 8 : 12; zone.danger += event.payload.result === 'success' ? 1 : 3; }
      if (state.factions.dreamPathForces) state.factions.dreamPathForces.tension += event.payload.result === 'success' ? 0.4 : 1.2;
    });
  }

  function performConversation(state, command, p) {
    const npc = requireSameLocation(state, command.target);
    const result = Conversation.resolve(CONVERSATION_DEFS, state, command, { day, relation, remember, log, affectFaction });
    Engine.emit(state, 'social.conversation', { actorId: p.id, targetId: npc.id, conversationId: result.definition.id, choiceId: result.choice.id });
    relation(state, 'player', npc.id).lastSeen = state.clock;
    advance(state, 1, 'conversation');
  }

  function identityAction(state, command, p) {
    const mode = command.mode || 'wear';
    if (mode === 'wear') {
      const mask = Identity.wear(p, command.maskId || 'anonymous', state.clock, Knowledge);
      remember(state, 'player', 'world', { kind: 'secret', source: 'identity:wear', text: `你换上了“${mask.label}”的身份面具。`, facts: { activeMask: p.knowledge.activeMask, publicIdentity: mask.label } });
      log(state, 'identity_mask', `你开始以“${mask.label}”的身份行动。`, { mode, maskId: p.knowledge.activeMask, strength: mask.strength });
    } else if (mode === 'drop') {
      const mask = Identity.wear(p, 'trueName', state.clock, Knowledge);
      log(state, 'identity_mask', `你摘下面具，恢复公开身份“${mask.label}”。`, { mode, maskId: 'trueName' });
    } else if (mode === 'reveal') {
      const target = state.entities[command.target];
      if (!target || target.id === 'player' || target.position.location !== p.position.location) throw new Error('只能向同地点的 NPC 摊牌');
      Identity.reveal(p, target, state.clock, Knowledge, '主动摊牌');
      const rel = relation(state, 'player', target.id);
      rel.trust += 5; rel.fear = Math.max(0, rel.fear - 2);
      log(state, 'identity_mask', `你向${target.identity.name}摊牌，真实身份被写入对方记忆。`, { mode, targetId: target.id, maskId: p.knowledge.activeMask });
      Engine.emit(state, 'identity.revealed', { actorId: 'player', targetId: target.id, maskId: p.knowledge.activeMask, location: p.position.location });
    } else throw new Error('未知的身份行动');
    advance(state, 1, 'identity_mask');
  }

  function registerActionHandlers() {
    Engine.registerAction('accept_contract', ({ state, command }) => contractRuntime.accept(state, command.contractId));
    Engine.registerAction('complete_contract', ({ state, command }) => contractRuntime.complete(state, command.contractId));
    Engine.registerAction('arena_match', ({ state, p }) => repeatableRuntime.arenaMatch(state, p));
    Engine.registerAction('inheritance_round', ({ state, p }) => repeatableRuntime.inheritanceRound(state, p));
    Engine.registerAction('frontier_patrol', ({ state, p }) => repeatableRuntime.frontierPatrol(state, p));
    Engine.registerAction('tower_floor', ({ state, p }) => repeatableRuntime.towerFloor(state, p));
    Engine.registerAction('auction_lot', ({ state, command, p }) => repeatableRuntime.auctionLot(state, p, command));
    Engine.registerAction('identity_mask', ({ state, command, p }) => identityAction(state, command, p));
    Engine.registerAction('pursuit_agent', ({ state, command, p }) => pursuitRuntime.contactAction(state, p, command));
    Engine.registerAction('commission_agent', ({ state, command, p }) => agencyRuntime.recruit(state, p, command));
    Engine.registerAction('dream_dive', ({ state, p }) => repeatableRuntime.dreamDive(state, p));
    Engine.registerAction('conversation', ({ state, command, p }) => performConversation(state, command, p));
    Engine.registerActionHook('after', '*', 'actionMetrics', ({ state, command }) => {
      state.facts.actionCounts ||= {};
      state.facts.actionCounts[command.id] = (state.facts.actionCounts[command.id] || 0) + 1;
    });
  }

  function relValence(state, npcId) {
    const rel = relation(state, npcId, 'player');
    return clamp(rel.trust + rel.affinity - rel.fear, -100, 100);
  }

  function dailyTick(state) {
    marketRuntime.dailyTick(state);
    for (const npc of Engine.queryWith(state, 'needs', 'memory')) {
      if (npc.id === 'player') continue;
      npc.needs.energy = clamp(npc.needs.energy + 35, 0, 100);
      npc.needs.hunger = clamp(npc.needs.hunger - 25, 0, 100);
      for (const episode of npc.memory.episodes) episode.valence *= 0.985;
    }
    const p = state.entities.player;
    ZoneRuntime.dailyTick(state, { playerLocation: p.position.location, random });
    const rel = relation(state, 'player', 'guYue');
    state.factions.guYue.tension += p.cultivation.rank > 1 ? 1 : 0;
    state.factions.bai.tension += state.factions.guYue.tension > 45 ? 1 : 0;
    state.factions.guYue.relations.bai = clamp((state.factions.guYue.relations.bai || 0) - (state.factions.guYue.tension > 40 ? 1 : 0), -100, 100);
    state.factions.guYue.relations.xiong = clamp((state.factions.guYue.relations.xiong || 0) - (state.factions.guYue.tension > 55 ? 1 : 0), -100, 100);
    state.factions.caravans.relations.guYue = clamp((state.factions.caravans.relations.guYue || 0) + (state.facts.marketActivity ? 1 : 0), -100, 100);
    state.director.pressure = clamp(state.director.pressure + (p.needs.hunger > 65 ? 2 : 0) + (rel.trust < 0 ? 1 : 0), 0, 10);
    if (state.frontier?.opened) {
      state.frontier.supply = clamp(state.frontier.supply - 0.8 + (state.facts.marketActivity ? 0.35 : 0), 0, 100);
      state.frontier.campaignPressure = clamp(state.frontier.campaignPressure + (state.frontier.supply < 25 ? 1 : 0), 0, 100);
      if (state.factions.black && state.frontier.supply < 25) state.factions.black.tension += 1;
      if (state.factions.northernTribes && state.frontier.campaignPressure > 40) state.factions.northernTribes.tension += 1;
    }
    if (state.worldWar?.fiveRegions) {
      state.worldWar.heat = clamp(state.worldWar.heat + 0.35, 0, 100);
      if (state.factions.heavenlyCourt) state.factions.heavenlyCourt.tension += 0.25;
      if (state.factions.longLifeHeaven) state.factions.longLifeHeaven.tension += 0.2;
      if (state.factions.southernSuperClans && state.worldWar.southern) state.factions.southernSuperClans.tension += 0.15;
      if (state.factions.westernDesertFang && state.worldWar.western) state.factions.westernDesertFang.tension += 0.15;
    }
    if (state.eternalWar?.twoHeavens) {
      state.eternalWar.cosmicHeat = clamp(state.eternalWar.cosmicHeat + 0.3, 0, 100);
      state.eternalWar.dreamPressure = clamp(state.eternalWar.dreamPressure + (state.eternalWar.dream ? 0.2 : 0), 0, 100);
      if (state.factions.twoHeavensForces) state.factions.twoHeavensForces.tension += 0.2;
      if (state.eternalWar.cosmicHeat > 60 && state.factions.heavenlyCourt) state.factions.heavenlyCourt.tension += 0.25;
    }
    Engine.emit(state, 'world.day_tick', { day: day(state), pressure: state.director.pressure });
    log(state, 'day_tick', `第${day(state)}日结束，山寨、势力与人物各自推进了一步。`, { pressure: state.director.pressure });
    History.snapshot(state);
  }

  function registerSystemHandlers() {
    Engine.registerSystem('hour', 'playerNeeds', ({ state }) => {
      const p = state.entities.player;
      p.needs.energy -= 0.7;
      p.needs.hunger += 0.55;
      p.cultivation.essence = Math.min(p.cultivation.essenceMax, p.cultivation.essence + 0.35 * p.cultivation.aptitude);
      if (p.needs.hunger > 85) p.cultivation.progress = Math.max(0, p.cultivation.progress - 0.2);
    }, 100);
    Engine.registerSystem('hour', 'conditionTick', ({ state }) => {
      for (const entity of Engine.queryWith(state, 'conditions')) {
        const expired = Condition.tick(entity, 1);
        for (const id of expired) Engine.emit(state, 'condition.expired', { entityId: entity.id, conditionId: id });
      }
    }, 110);
    Engine.registerSystem('hour', 'npcSimulation', ({ state }) => NpcAI.tick(state, { engine: Engine, locations: LOCATIONS, phase, hour, day, random, clamp, relation, remember, log, relValence, brain: Brain }), 50);
    Engine.registerSystem('hour', 'pursuitSimulation', ({ state }) => pursuitRuntime.tick(state), 60);
    Engine.registerSystem('hour', 'agencySimulation', ({ state }) => agencyRuntime.tick(state), 40);
    Engine.registerSystem('day', 'worldDailyTick', ({ state }) => dailyTick(state), 0);
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

  function damageEntity(state, targetId, amount, sourceId, kind = 'strike') {
    const target = state.entities[targetId];
    if (!target?.body || !target.alive) return 0;
    const result = Body.applyDamage(target, { amount, sourceId, kind, roll: () => random(state), clock: state.clock });
    const { damage, limb } = result;
    Condition.apply(target, 'wounded', { duration: 24, intensity: damage, source: sourceId, clock: state.clock });
    Engine.emit(state, 'combat.damage', { targetId, sourceId, kind, limb, damage, limbIntegrity: Body.integrity(target, limb), disabled: result.disabled });
    remember(state, targetId, sourceId, { kind: 'injury', valence: -damage, text: `你在${limb}处留下了伤势。` });
    log(state, 'damage', `${target.identity.name} 受到 ${damage} 点${kind === 'gu' ? '蛊术' : '伤害'}。`, { targetId, sourceId, limb, damage, disabled: result.disabled });
    if (result.died) {
      target.alive = false;
      log(state, 'death', `${target.identity.name} 倒下了。`, { targetId, sourceId });
      if (targetId === state.playerId) state.entities.player.cultivation.vitality = 0;
    }
    return damage;
  }

  function beginConflict(state, targetId, kind = 'challenge') {
    const p = state.entities.player;
    const target = requireSameLocation(state, targetId);
    if (targetId === state.playerId) throw new Error('不能与自己交锋');
    state.combat = { kind, attacker: 'player', defender: targetId, round: 1, guard: false, startedAt: state.clock };
    Engine.emit(state, 'combat.started', { attackerId: 'player', defenderId: targetId, kind, location: p.position.location });
    relation(state, 'player', targetId).fear += 2;
    remember(state, targetId, 'player', { kind: 'conflict', valence: -10, text: `${p.identity.name}主动把关系推向了冲突。` });
    log(state, 'combat_start', `你与${target.identity.name}在${LOCATIONS[p.position.location].name}交锋。`, { targetId, kind });
  }

  function combatAction(state, command) {
    const combat = state.combat;
    const p = state.entities.player;
    if (!combat) throw new Error('当前没有冲突');
    const target = state.entities[combat.defender];
    if (!target?.alive) { state.combat = null; return; }
    const id = command.id;
    let playerDamage = 0;
    let playerGuard = false;
    if (id === 'attack') playerDamage = 10 + p.cultivation.rank * 4 + p.cultivation.insight * 0.25;
    else if (id === 'gu') {
      const ability = Ability.activate(p, command.guId || 'moonlight', GU_SEEDS, Body);
      Engine.emit(state, 'ability.used', { actorId: p.id, abilityId: ability.id, location: p.position.location, cost: ability.cost, kind: ability.kind });
      log(state, 'ability_used', `你催动${ability.name}，消耗 ${ability.cost} 点真元。`, { abilityId: ability.id, cost: ability.cost, targetId: target.id });
      playerDamage = 6 + ability.power + p.cultivation.rank * 5;
    } else if (id === 'guard') playerGuard = true;
    else if (id === 'flee') {
      const chance = clamp(0.35 + (p.needs.energy / 250) - (target.cultivation?.rank || 1) * 0.04, 0.1, 0.85);
      if (random(state) < chance) { state.combat = null; log(state, 'combat_escape', '你脱离了冲突，但这段关系不会因此恢复原状。'); advance(state, 1, 'combat'); return; }
      log(state, 'combat_escape_failed', '你试图脱身，却被对方逼回原地。');
    } else throw new Error('未知冲突动作');
    if (playerDamage) damageEntity(state, target.id, playerDamage, 'player', id === 'gu' ? 'gu' : 'strike');
    if (!target.alive) {
      relation(state, 'player', target.id).fear += 25;
      if (target.faction && state.factions[target.faction]) state.factions[target.faction].tension += 8;
      state.combat = null;
      advance(state, 1, 'combat');
      return;
    }
    const targetPower = 6 + (target.cultivation?.rank || 1) * 4 + (target.personality?.ambition || 0) * 0.04;
    damageEntity(state, 'player', playerGuard ? targetPower * 0.35 : targetPower, target.id, 'npc_strike');
    p.needs.energy -= 5;
    combat.round += 1;
    if (!p.alive) { state.combat = null; }
    advance(state, 1, 'combat');
  }

  function action(state, command) {
    const p = requirePlayer(state);
    const id = command.id;
    if (state.combat) throw new Error('冲突中只能选择攻击、防守、催动蛊术或脱身');
    if (state.events.active) throw new Error('请先处理当前世界事件');
    const registered = Engine.runAction(id, { state, command, p });
    if (registered.handled) return;
    if (id === 'wait') { advance(state, Number(command.hours) || 2, 'wait'); log(state, 'action', '你等待了一段时间，观察世界如何自行变化。'); return; }
    if (id === 'travel') {
      const target = command.location;
      if (!LOCATIONS[target] || !LOCATIONS[p.position.location].neighbors.includes(target)) throw new Error('这里无法直接到达该地点');
      const from = p.position.location; p.position.location = target;
      ZoneRuntime.transition(state, from, target, { engine: Engine, clock: state.clock });
      Engine.emit(state, 'world.travel', { actorId: 'player', from, to: target });
      remember(state, 'player', 'world', { kind: 'travel', text: `从${LOCATIONS[from].name}前往${LOCATIONS[target].name}。`, facts: { [target]: true } });
      log(state, 'travel', `你从${LOCATIONS[from].name}前往${LOCATIONS[target].name}。`);
      advance(state, 1, 'travel'); return;
    }
    if (id === 'cultivate') {
      const cost = Math.max(6, Math.round(p.cultivation.essenceMax * 0.18));
      if (p.cultivation.essence < cost) throw new Error('真元不足');
      p.cultivation.essence -= cost;
      const gain = 4 + p.cultivation.aptitude * 8 + p.cultivation.insight * 0.06;
      p.cultivation.progress += gain;
      p.needs.energy -= 8;
      remember(state, 'player', 'world', { kind: 'cultivation', text: '你在雨声中温养空窍。' });
      log(state, 'action', `你温养空窍，修为进度增加 ${gain.toFixed(1)}。`);
      advance(state, 3, 'cultivate'); return;
    }
    if (id === 'study') {
      if (p.position.location !== 'academy') throw new Error('只有在学堂才能听课');
      p.cultivation.insight += 2; p.cultivation.progress += 1;
      relation(state, 'player', 'guYue').trust += 1;
      log(state, 'action', '你听完一堂关于真元与蛊虫的课，家老把你的表现记在心里。');
      advance(state, 2, 'study'); return;
    }
    if (id === 'gather') {
      const loc = p.position.location;
      const zone = state.zones[loc];
      if (!zone || !['bambooForest', 'riverbank', 'cliffCave'].includes(loc)) throw new Error('当前位置没有可采集的区域资源');
      if (loc === 'riverbank') {
        const amount = Math.min(3, zone.resources.water);
        if (amount < 1) throw new Error('河滩的水源暂时不足');
        zone.resources.water -= amount; p.inventory.water += amount;
      }
      if (loc === 'bambooForest') {
        const petals = Math.min(2, zone.resources.moonPetal);
        if (petals < 1) throw new Error('竹林里的月兰花瓣已经被采得差不多了');
        zone.resources.moonPetal -= petals; zone.resources.food = Math.max(0, zone.resources.food - 1);
        p.inventory.moonPetal += petals; p.inventory.food = (p.inventory.food || 0) + 1;
      }
      if (loc === 'cliffCave') {
        const fragment = Math.min(1, zone.resources.relicFragment);
        if (fragment < 1) throw new Error('石缝里暂时没有新的遗藏碎片');
        zone.resources.relicFragment -= fragment; p.inventory.relicFragment = (p.inventory.relicFragment || 0) + fragment; state.flags.relicDiscovered = true;
      }
      zone.activity += 12; zone.visits += 1;
      Engine.emit(state, 'world.resource_gathered', { actorId: 'player', location: loc, resources: copy(p.inventory) });
      if (random(state) < zone.danger / 260) { damageEntity(state, 'player', 4 + zone.danger * 0.08, 'world', 'environment'); p.needs.safety -= 8; }
      p.cultivation.insight += random(state) < 0.35 ? 1 : 0;
      log(state, 'action', `你在${LOCATIONS[loc].name}进行采集，资源与线索都发生了变化。`);
      advance(state, 2, 'gather'); return;
    }
    if (id === 'rest') { p.needs.energy += 42; p.needs.hunger += 4; log(state, 'action', '你休息了一晚，人物和势力仍在世界中行动。'); advance(state, 6, 'rest'); return; }
    if (id === 'challenge') { beginConflict(state, command.target, command.kind || 'challenge'); return; }
    if (id === 'refine') {
      if (p.position.location !== 'academy' && p.position.location !== 'village') throw new Error('这里没有适合炼化蛊虫的安静场所');
      const guId = command.guId || 'moonlight';
      p.inventory.gu ||= {};
      const current = p.inventory.gu[guId] || { progress: 0, refined: false, hunger: 0 };
      if (current.refined) throw new Error('这只蛊已经炼化');
      const cost = 8;
      if (p.cultivation.essence < cost) throw new Error('真元不足');
      p.cultivation.essence -= cost;
      current.progress += 22 + p.cultivation.aptitude * 12;
      if (current.progress >= 100) { current.progress = 100; current.refined = true; Ability.learn(p, guId); log(state, 'milestone', `你炼化了${GU_SEEDS[guId].name}。`, { guId }); }
      else log(state, 'action', `你尝试炼化${GU_SEEDS[guId].name}，蛊虫仍在抵抗。`);
      p.inventory.gu[guId] = current;
      advance(state, 2, 'refine'); return;
    }
    if (id === 'talk') {
      const npc = requireSameLocation(state, command.target);
      const r = relation(state, 'player', npc.id);
      const mode = command.mode || 'listen';
      const memoryBoost = (p.memory.facts[npc.id]?.helped ? 6 : 0) + (r.trust > 20 ? 3 : 0);
      if (!Engine.runInteraction(mode, { state, p, npc, relation: r, memoryBoost })) Engine.runInteraction('listen', { state, p, npc, relation: r, memoryBoost });
      Engine.emit(state, 'social.interaction', { actorId: 'player', targetId: npc.id, mode });
      r.lastSeen = state.clock; advance(state, 1, 'talk'); return;
    }
    if (id === 'influence') {
      const faction = state.factions[command.factionId];
      if (!faction) throw new Error('未知势力');
      if ((p.inventory.stones || 0) < 1) throw new Error('至少需要一枚元石作为行动成本');
      p.inventory.stones -= 1; faction.attitude += 4; faction.tension += command.kind === 'rumor' ? 4 : -2; state.director.pressure += command.kind === 'rumor' ? 1 : 0;
      relation(state, 'player', command.factionId).trust += 4;
      log(state, 'faction', `你对${faction.name}施加了一次${command.kind === 'rumor' ? '传闻' : '援助'}影响。`, { factionId: command.factionId });
      advance(state, 2, 'influence'); return;
    }
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
      else if (command.type === 'combat') combatAction(state, command);
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
      player: { ...p.cultivation, name: Identity.visible(p, 'player', Knowledge).name, trueName: p.identity.name, activeMask: p.knowledge.activeMask, inventory: copy(p.inventory), abilities: copy(p.abilities), needs: copy(p.needs), identity: copy(Identity.visible(p, 'player', Knowledge)) },
      combat: copy(state.combat || null),
      nearby: Engine.query(state, e => e.id !== 'player' && e.alive && e.position.location === p.position.location).map(e => { const identity = Identity.visible(e, 'player', Knowledge); return { id: e.id, name: identity.name, role: identity.role, tags: identity.tags, masked: identity.masked, goal: e.goals.active, brain: { mode: e.brain?.mode || 'idle', current: e.brain?.current?.goal || e.goals.active, plan: copy(e.brain?.plan || []).slice(0, 3), lastPerceptionClock: e.brain?.blackboard?.lastPerceptionClock ?? null }, relationship: copy(relation(state, 'player', e.id)), memory: e.memory.episodes[0] || null, suspicion: Knowledge.suspicion(e, 'player') }; }),
      factions: Object.values(state.factions).map(f => ({ id: f.id, name: f.name, influence: f.influence, tension: f.tension, attitude: f.attitude, market: copy(f.market || null) })),
      activeEvent: copy(state.events.active), zone: copy(state.zones[p.position.location]), zones: Object.fromEntries(Object.entries(state.zones).map(([id, zone]) => [id, ZoneRuntime.snapshot(zone)])), arena: copy(state.arena), inheritance: copy(state.inheritance), frontier: copy(state.frontier), tower: copy(state.tower), central: copy(state.central), intel: copy(state.intel), pursuit: copy(state.pursuit), agency: copy(state.agency), market: copy(state.market), worldWar: copy(state.worldWar), eternalWar: copy(state.eternalWar), contracts: copy(state.contracts), eventStream: copy(state.events.pending || []), domainEvents: copy(state.events.recent || []), engine: { components: Engine.COMPONENTS, registries: Engine.registries() }, history: History.summary(state), log: state.log.slice(0, 20).map(copy)
    };
  }

  contractRuntime = Contracts.createRuntime({ definitions: CONTRACT_DEFS, day, copy, relation, affectFaction, remember, log, advance });
  Engine.registerComponent('body', { ensure: entity => Body.ensure(entity), serialize: ({ value }) => ({ ...value, limbs: { ...(value.limbs || {}) }, wounds: [...(value.wounds || [])] }), deserialize: ({ value }) => ({ ...value, limbs: { ...(value.limbs || {}) }, wounds: [...(value.wounds || [])] }) });
  Engine.registerComponent('brain', { ensure: entity => Brain.ensure(entity), onAttach: ({ entity, value }) => value || Brain.ensure(entity) });
  repeatableRuntime = RepeatableSystems.createRuntime({ engine: Engine, random, clamp, relation, remember, log, damageEntity, advance });
  pursuitRuntime = Pursuit.createRuntime({ engine: Engine, createEntity: Entity.createEntity, locations: LOCATIONS, random, clamp, relation, remember, log, advance, knowledge: Knowledge });
  marketRuntime = Market.createRuntime({ engine: Engine, clamp, random });
  agencyRuntime = Agency.createRuntime({ engine: Engine, locations: LOCATIONS, random, clamp, relation, remember, log, advance, knowledge: Knowledge, market: marketRuntime });
  directorRulesRuntime = DirectorRules.createRuntime({ engine: Engine, day, sourceNotes: SOURCE_NOTES });
  eventRulesRuntime = EventRules.createRuntime({ engine: Engine, day, sourceNotes: SOURCE_NOTES, activateSeed, relation, remember, log, affectFaction, advance, clamp, applyOpening, pursuit: pursuitRuntime });
  directorRulesRuntime.registerRules();
  eventRulesRuntime.registerHandlers();
  registerGoalHandlers();
  DefaultGoals.register({ engine: Engine, remember, market: marketRuntime, log });
  registerInteractionHandlers();
  registerEventListeners();
  registerActionHandlers();
  registerSystemHandlers();
  return { SCHEMA_VERSION, CONTENT_VERSION, CONTENT_INDEX, CONTRACT_DEFS, CONVERSATION_DEFS, LOCATIONS, FACTION_SEEDS, GU_SEEDS, SOURCE_NOTES, ENGINE: Engine, ENTITY: Entity, CONDITION: Condition, BODY: Body, BRAIN: Brain, GOAL_HANDLER: Brain.goalHandler, KNOWLEDGE: Knowledge, IDENTITY: Identity, PURSUIT: pursuitRuntime, AGENCY: agencyRuntime, MARKET: marketRuntime, CONTRACTS: contractRuntime, REPEATABLE_SYSTEMS: repeatableRuntime, DIRECTOR_RULES: directorRulesRuntime, EVENT_RULES: eventRulesRuntime, ZONE_BUILDER: ZoneBuilder, ZONE_RUNTIME: ZoneRuntime, NPC_AI: NpcAI, DEFAULT_GOALS: DefaultGoals, CONVERSATION_RUNTIME: Conversation, RUMOR: Rumor, ACTION_CATALOG: ActionCatalog, DIRECTOR: Director, INTENT: Intent, ABILITY: Ability, newWorld, dispatch, interpret, validate, snapshot, day, hour, phase };
});
