(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./content.js'), require('./history.js'), require('./zone-builder.js'), require('./npc-ai.js'), require('./entity.js'), require('./conversation.js'), require('./rumor.js'), require('./action-catalog.js'), require('./director.js'), require('./default-goals.js'), require('./intent.js'), require('./ability.js'), require('./condition.js'), require('./contracts.js'), require('./repeatable-systems.js'), require('./gu-director-rules.js'));
  else root.GuSimulation = factory(root.GuSimulationEngine, root.GuSimulationContent, root.GuSimulationHistory, root.GuSimulationZoneBuilder, root.GuSimulationNpcAI, root.GuSimulationEntity, root.GuSimulationConversation, root.GuSimulationRumor, root.GuSimulationActionCatalog, root.GuSimulationDirector, root.GuSimulationDefaultGoals, root.GuSimulationIntent, root.GuSimulationAbility, root.GuSimulationCondition, root.GuSimulationContracts, root.GuSimulationRepeatableSystems, root.GuDirectorRules);
})(globalThis, function (Engine, Content, History, ZoneBuilder, NpcAI, Entity, Conversation, Rumor, ActionCatalog, Director, DefaultGoals, Intent, Ability, Condition, Contracts, RepeatableSystems, DirectorRules) {
  'use strict';

  if (!Engine) throw new Error('GuSimulationEngine must load before simulation.js');
  if (!Content) throw new Error('GuSimulationContent must load before simulation.js');
  if (!History) throw new Error('GuSimulationHistory must load before simulation.js');
  if (!ZoneBuilder) throw new Error('GuSimulationZoneBuilder must load before simulation.js');
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
      central: { foxOpened: false, centralOpened: false, auctionActive: false, lotsSold: 0, auctionHeat: 0, sectPressure: 0 },
      worldWar: { shadowRebuilt: false, fiveRegions: false, southern: false, western: false, heavenly: false, heat: 0 },
      eternalWar: { divineEmperor: false, twoHeavens: false, madDemonCave: false, dream: false, starHost: false, dreamPressure: 0, cosmicHeat: 0, dives: 0, successes: 0, failures: 0 },
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
    for (const [id, seedData] of Object.entries(NPC_SEEDS)) {
      if (seedData.fromDay && seedData.fromDay > day(state)) { state.facts.latentNpcs ||= {}; state.facts.latentNpcs[id] = seedData.fromDay; }
      else state.entities[id] = Entity.createEntity(id, seedData);
    }
    state.zones = ZoneBuilder.buildZones(LOCATIONS);
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

  function registerEventHandlers() {
    Engine.registerEvent('openingRite', ({ state, choice }) => applyOpening(state, choice));
    Engine.registerEvent('moonlightRumor', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.moonlightRumor = true;
      if (choice === 'follow') { p.memory.facts.world.relicLead = true; state.director.pressure += 2; }
      if (choice === 'report') { relation(state, 'player', 'guYue').trust += 8; p.memory.facts.world.relicLead = 'shared'; }
      if (choice === 'ignore') { p.cultivation.insight += 2; p.memory.facts.world.relicLead = 'withheld'; }
      log(state, 'choice', `你处理了“竹林里的酒香”：${event.choices.find(c => c.id === choice).label}。`);
      return true;
    });
    Engine.registerEvent('academyRivalry', ({ state, choice, event }) => {
      const p = state.entities.player;
      if (choice === 'mediate') { relation(state, 'player', 'fangzheng').trust += 12; state.director.pressure -= 1; }
      if (choice === 'join') { relation(state, 'player', 'mobei').fear += 8; relation(state, 'player', 'chicheng').fear += 8; p.cultivation.progress += 8; }
      if (choice === 'watch') { p.cultivation.insight += 5; remember(state, 'player', 'mobei', { kind: 'secret', valence: 2, text: '漠北在公开竞争时会先看家老的脸色。' }); }
      log(state, 'choice', `你处理了学堂较量：${event.choices.find(c => c.id === choice).label}。`);
      return true;
    });
    Engine.registerEvent('marketArrival', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.marketArrived = true; state.facts.marketActivity = (state.facts.marketActivity || 0) + 3;
      state.zones.village.resources.food += 2; state.zones.caravanCamp.resources.food += 2;
      if (choice === 'trade') { p.inventory.water += 2; p.inventory.moonPetal += 2; p.inventory.stones = Math.max(0, p.inventory.stones - 2); relation(state, 'player', 'caravans').trust += 6; state.factions.caravans.influence += 3; }
      if (choice === 'listen') { p.cultivation.insight += 7; remember(state, 'player', 'world', { kind: 'rumor', valence: 1, text: '白家寨和熊家寨的边界冲突正在推高货价。', facts: { marketRumor: true } }); }
      if (choice === 'scheme') { state.factions.caravans.tension += 8; state.factions.bai.tension += 3; state.factions.xiong.tension += 3; state.director.pressure += 2; remember(state, 'jiafu', 'player', { kind: 'rumor', valence: -2, text: '这个人会利用商路影响山寨里的判断。' }); }
      log(state, 'choice', `你处理了商队进入：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.market });
      return true;
    });
    Engine.registerEvent('auction', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.auctionHeld = true; state.facts.marketActivity = (state.facts.marketActivity || 0) + 2;
      if (choice === 'buy') { if ((p.inventory.stones || 0) < 2) p.cultivation.insight += 2; else { p.inventory.stones -= 2; p.inventory.moonPetal += 3; relation(state, 'player', 'jiafu').trust += 5; } }
      if (choice === 'sell') { p.inventory.stones += Math.min(4, p.inventory.moonPetal || 0); p.inventory.moonPetal = Math.max(0, (p.inventory.moonPetal || 0) - 4); relation(state, 'player', 'jiafu').debt += 1; }
      if (choice === 'observe') { p.cultivation.insight += 6; remember(state, 'player', 'jiafu', { kind: 'market', valence: 2, text: '贾富会先用低价聚拢人气，再让稀缺资源成为势力之间的筹码。', facts: { auctionObserved: true } }); }
      log(state, 'choice', `你处理了贾富的拍卖会：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.auction });
      return true;
    });
    Engine.registerEvent('allianceCouncil', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.allianceCouncil = true;
      if (choice === 'aid') { state.factions.guYue.influence -= 4; state.factions.guYue.tension -= 4; state.factions.bai.tension -= 5; state.factions.xiong.tension -= 5; state.factions.guYue.relations.bai += 8; state.factions.guYue.relations.xiong += 8; remember(state, 'guyuebo', 'player', { kind: 'politics', valence: 6, text: '你在三寨利益分配前支持共同防线。' }); }
      if (choice === 'hoard') { state.factions.guYue.influence += 4; state.factions.guYue.tension += 5; state.factions.bai.tension += 4; state.factions.xiong.tension += 4; state.director.pressure += 1; remember(state, 'guyuebo', 'player', { kind: 'politics', valence: 1, text: '你首先考虑古月山寨的存续。' }); }
      if (choice === 'spy') { p.cultivation.insight += 8; remember(state, 'player', 'world', { kind: 'secret', valence: 3, text: '三寨联盟真正困难的不是是否结盟，而是谁承担最危险的防线。', facts: { allianceIntel: true } }); }
      log(state, 'choice', `你处理了三寨议事：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.wolf });
      return true;
    });
    Engine.registerEvent('wolfTide', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.wolfTide = true; state.director.pressure = clamp(state.director.pressure + 2, 0, 10);
      for (const locationId of ['bambooForest', 'riverbank', 'cliffCave']) state.zones[locationId].danger += 12;
      state.zones.village.resources.food = Math.max(0, state.zones.village.resources.food - 2); state.factions.guYue.tension += 6;
      if (choice === 'mobilize') { state.zones.village.danger = Math.max(0, state.zones.village.danger - 8); state.factions.guYue.influence += 5; state.factions.guYue.tension -= 3; remember(state, 'guyuebo', 'player', { kind: 'crisis', valence: 8, text: '你在狼潮逼近前参与了巡逻与布防。' }); }
      if (choice === 'hunt') { p.inventory.food = (p.inventory.food || 0) + 2; p.needs.safety -= 12; p.cultivation.insight += 3; remember(state, 'bainingbing', 'player', { kind: 'crisis', valence: 2, text: '你在狼潮逼近时选择深入山林。' }); }
      if (choice === 'secure') { p.inventory.water += 3; p.inventory.food = (p.inventory.food || 0) + 3; state.zones.bambooForest.danger += 8; state.director.pressure += 1; }
      log(state, 'choice', `你面对狼潮逼近作出决定：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.wolf });
      return true;
    });
    Engine.registerEvent('threeClanTournament', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.tournamentAnnounced = true;
      state.facts.tournament = { announcedDay: day(state), format: 'three-clan' };
      state.factions.guYue.tension += 3; state.factions.bai.tension += 2; state.factions.xiong.tension += 2;
      if (choice === 'enter') { p.needs.energy -= 12; p.cultivation.progress += 10; relation(state, 'player', 'xiong').fear += 4; remember(state, 'player', 'world', { kind: 'competition', valence: 3, text: '你把三族赔偿问题变成了自己的公开竞争。', facts: { enteredTournament: true } }); }
      if (choice === 'sponsor') { state.factions.guYue.influence += 6; relation(state, 'player', 'guYue').trust += 6; remember(state, 'guyuebo', 'player', { kind: 'politics', valence: 5, text: '你在三族大比武前支持本族参赛者。' }); }
      if (choice === 'observe') { p.cultivation.insight += 9; remember(state, 'player', 'world', { kind: 'secret', valence: 3, text: '狼潮后的真正秩序取决于谁能把实力转成赔偿方案。', facts: { tournamentIntel: true } }); }
      log(state, 'choice', `你处理了三族大比武筹备：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.tournament });
      return true;
    });
    Engine.registerEvent('ironInvestigation', ({ state, choice, event }) => {
      const p = state.entities.player;
      activateSeed(state, 'tieruonan'); activateSeed(state, 'tiexueleng');
      state.flags.investigationArrived = true;
      state.facts.investigation = { arrivedDay: day(state), caseStatus: 'open' };
      if (choice === 'cooperate') { relation(state, 'player', 'tieruonan').trust += 8; relation(state, 'player', 'tiexueleng').trust += 4; state.factions.iron.attitude += 6; remember(state, 'tiexueleng', 'player', { kind: 'case', valence: 5, text: '你愿意主动提供线索，暂时不把自己藏在家族背后。' }); }
      if (choice === 'evade') { relation(state, 'player', 'tiexueleng').fear += 5; state.factions.iron.tension += 4; state.director.pressure += 2; remember(state, 'tieruonan', 'player', { kind: 'suspicion', valence: -4, text: '这个人避开了关键问题，行动轨迹值得重新调查。' }); }
      if (choice === 'bargain') { p.cultivation.insight += 6; relation(state, 'player', 'tiexueleng').debt += 1; state.factions.iron.attitude += 2; p.memory.facts.world.investigationLeverage = true; }
      log(state, 'choice', `你处理了铁家父女的调查：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.investigation });
      return true;
    });
    Engine.registerEvent('merchantCityArrival', ({ state, choice, event }) => {
      const p = state.entities.player;
      if (choice !== 'avoid') {
        state.flags.merchantCityOpened = true;
        activateSeed(state, 'shangxinci'); activateSeed(state, 'weiyang');
        state.facts.merchantCity = { enteredDay: day(state), status: choice === 'enter' ? 'inside' : 'surveyed' };
        state.factions.shang.influence += choice === 'enter' ? 4 : 1;
        if (choice === 'survey') { p.cultivation.insight += 6; remember(state, 'player', 'shangxinci', { kind: 'city', valence: 2, text: '你先观察商家城的关系网络，没有急着接受保护。' }); }
        if (choice === 'enter') { relation(state, 'player', 'shangxinci').trust += 3; p.inventory.stones += 2; }
      } else { state.director.pressure += 1; p.cultivation.insight += 2; state.facts.threeForkLead = true; }
      log(state, 'choice', `你处理了进入商家城的选择：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.merchantCity });
      return true;
    });
    Engine.registerEvent('merchantArena', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.arenaTrial = true; state.arena.active = true; state.facts.arena = { firstTrialDay: day(state) };
      if (choice === 'fight') { p.needs.energy -= 15; p.cultivation.progress += 12; state.factions.shang.influence += 3; remember(state, 'weiyang', 'player', { kind: 'arena', valence: 4, text: '你愿意用公开胜负证明自己的价值。' }); }
      if (choice === 'recruit') { p.cultivation.insight += 7; relation(state, 'player', 'weiyang').trust += 8; relation(state, 'player', 'shangxinci').trust += 5; }
      if (choice === 'trade') { p.inventory.stones = Math.max(0, p.inventory.stones - 2); p.inventory.water += 3; state.facts.threeKingsRumor = true; }
      log(state, 'choice', `你处理了商家城演武场：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.merchantCity });
      return true;
    });
    Engine.registerEvent('threeKingsInheritance', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.threeKingsAwakened = true; state.inheritance.active = true;
      state.facts.threeKings = { firstEntryDay: day(state), attempts: 1 };
      state.zones.threeForkMountain.activity += 18; state.zones.threeForkMountain.danger += 14;
      if (choice === 'enter') { p.needs.energy -= 18; p.cultivation.progress += 18; p.inventory.relicFragment = (p.inventory.relicFragment || 0) + 1; remember(state, 'player', 'world', { kind: 'inheritance', valence: 4, text: '你进入三王传承，发现传承本身也在筛选和消耗进入者。', facts: { enteredThreeKings: true } }); }
      if (choice === 'scout') { p.cultivation.insight += 10; state.facts.threeKingsIntel = true; }
      if (choice === 'ambush') { state.factions.shang.tension += 5; state.factions.iron.tension += 4; state.director.pressure += 2; remember(state, 'player', 'world', { kind: 'ambush', valence: -4, text: '你把传承出口当成了新的资源节点。' }); }
      log(state, 'choice', `你处理了三王传承开启：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.threeKings });
      return true;
    });
    Engine.registerEvent('heavenClimbTransmission', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.heavenClimbRumor = true; state.facts.heavenClimb = { heardDay: day(state), choice };
      if (choice === 'follow') { p.cultivation.insight += 12; state.director.pressure += 2; remember(state, 'player', 'world', { kind: 'sect', valence: 3, text: '天梯山的传承争夺已经超出家族和商队的尺度。', facts: { sectLead: true } }); }
      if (choice === 'sell') { p.inventory.stones += 5; state.factions.shang.influence += 5; state.factions.shang.tension += 3; }
      if (choice === 'ignore') { p.cultivation.progress += 8; state.facts.sectLead = 'withheld'; }
      log(state, 'choice', `你处理了天梯山传承消息：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.heavenClimb });
      return true;
    });
    Engine.registerEvent('northernWarArrival', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.northernFrontierOpened = choice !== 'avoid';
      state.frontier.opened = state.flags.northernFrontierOpened;
      if (state.frontier.opened) { activateSeed(state, 'heiloulan'); activateSeed(state, 'taibaiyunsheng'); state.factions.black.influence += 4; state.factions.northernTribes.tension += 3; }
      if (choice === 'enter') { p.cultivation.insight += 8; state.frontier.supply -= 8; remember(state, 'player', 'world', { kind: 'war', valence: 2, text: '你沿商路进入北原，开始把军队、后勤和部族关系当成同一个系统观察。', facts: { northernLead: true } }); }
      if (choice === 'observe') { p.cultivation.insight += 12; state.frontier.campaignPressure += 2; }
      if (choice === 'avoid') { state.director.pressure += 1; p.cultivation.progress += 6; }
      log(state, 'choice', `你处理了北原战报：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.northernWar });
      return true;
    });
    Engine.registerEvent('blackCampaign', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.blackCampaign = true; state.frontier.battles += 1; state.frontier.campaignPressure += 4;
      activateSeed(state, 'dongfangyuliang'); activateSeed(state, 'mayingjie');
      if (choice === 'mobilize') { p.needs.energy -= 14; state.frontier.supply -= 12; state.factions.black.influence += 8; state.factions.dongfang.tension += 5; remember(state, 'heiloulan', 'player', { kind: 'war', valence: 4, text: '你愿意把行动力投入黑盟的军帐和后勤。' }); }
      if (choice === 'mediate') { state.frontier.campaignPressure = Math.max(0, state.frontier.campaignPressure - 3); state.factions.black.influence -= 3; state.factions.northernTribes.attitude += 8; remember(state, 'taibaiyunsheng', 'player', { kind: 'mediation', valence: 4, text: '你试图让中小部族在战争中保留喘息的余地。' }); }
      if (choice === 'scout') { p.cultivation.insight += 10; state.factions.dongfang.attitude -= 8; state.facts.dongfangIntel = true; }
      log(state, 'choice', `你处理了黑盟军帐：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.northernWar });
      return true;
    });
    Engine.registerEvent('imperialCourtOpening', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.imperialCourtOpened = true; state.frontier.campaignPressure += 3; state.facts.imperialCourt = { openedDay: day(state), choice };
      if (choice === 'support') { state.factions.black.influence += 8; state.factions.northernTribes.tension += 6; state.frontier.supply -= 8; }
      if (choice === 'relief') { state.factions.black.influence -= 5; state.factions.northernTribes.tension = Math.max(0, state.factions.northernTribes.tension - 8); state.frontier.campaignPressure = Math.max(0, state.frontier.campaignPressure - 4); }
      if (choice === 'broker') { p.cultivation.insight += 12; p.inventory.stones += 4; state.facts.trueYangLead = true; }
      log(state, 'choice', `你处理了王庭福地的军政争议：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.tribeCrisis });
      return true;
    });
    Engine.registerEvent('trueYangTowerFormation', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.trueYangTowerFormed = true; state.tower.formed = true; state.tower.active = choice !== 'assist'; state.facts.trueYangTower = { formedDay: day(state), choice };
      state.factions.giantSun.influence = Math.min(100, state.factions.giantSun.influence + 5); state.frontier.campaignPressure += 4;
      if (choice === 'enter') { p.cultivation.insight += 14; state.tower.attempts += 1; remember(state, 'player', 'world', { kind: 'tower', valence: 4, text: '你把真阳楼视为会受战争、天气和资格影响的活系统，而不是一座静态宝库。', facts: { towerLead: true } }); }
      if (choice === 'assist') { state.frontier.supply += 12; state.factions.northernTribes.attitude += 6; }
      if (choice === 'watch') { p.cultivation.insight += 10; state.tower.discoveries.push({ kind: 'formation-pattern', day: day(state) }); }
      log(state, 'choice', `你处理了八十八角真阳楼显化：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.towerFormation });
      return true;
    });
    Engine.registerEvent('foxFairyLandReturn', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.foxFairyLandOpened = true; state.central.foxOpened = true;
      if (choice === 'recover') { p.needs.energy = Math.min(100, p.needs.energy + 24); p.cultivation.insight += 5; state.frontier.campaignPressure = Math.max(0, state.frontier.campaignPressure - 5); }
      if (choice === 'prepare') { state.central.sectPressure += 3; state.zones.foxFairyLand.activity += 8; p.inventory.stones = Math.max(0, p.inventory.stones - 2); }
      if (choice === 'hide') { state.director.pressure = Math.max(0, state.director.pressure - 1); state.facts.hiddenReturn = true; }
      log(state, 'choice', `你处理了回归狐仙福地：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.foxReturn });
      return true;
    });
    Engine.registerEvent('centralContinentArrival', ({ state, choice, event }) => {
      state.flags.centralContinentOpened = true; state.central.centralOpened = true;
      activateSeed(state, 'tianhe');
      if (choice === 'sect') { state.factions.centralSects.attitude += 5; state.factions.immortalCrane.influence += 3; state.central.sectPressure += 2; }
      if (choice === 'trade') { state.factions.auctionImmortals.influence += 4; state.entities.player.inventory.stones += 3; }
      if (choice === 'avoid') { state.director.pressure += 1; state.central.sectPressure = Math.max(0, state.central.sectPressure - 1); }
      log(state, 'choice', `你处理了中洲宗门的视线：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.sectPressure });
      return true;
    });
    Engine.registerEvent('immortalAuction', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.immortalAuctionOpened = true; state.central.auctionActive = true; activateSeed(state, 'qinbaisheng');
      if (choice === 'bid') { p.inventory.stones = Math.max(0, p.inventory.stones - 3); state.central.lotsSold += 1; p.cultivation.insight += 8; state.factions.auctionImmortals.influence += 4; }
      if (choice === 'observe') { p.cultivation.insight += 12; state.central.sectPressure += 1; }
      if (choice === 'rumor') { p.inventory.stones += 6; state.central.sectPressure += 4; state.facts.auctionIntel = true; }
      log(state, 'choice', `你处理了中洲拍卖大会：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.immortalAuction });
      return true;
    });
    Engine.registerEvent('sectPressure', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.sectPressureActive = true; state.central.sectPressure += 5;
      if (choice === 'defend') { p.inventory.stones = Math.max(0, p.inventory.stones - 4); state.central.sectPressure = Math.max(0, state.central.sectPressure - 3); state.zones.foxFairyLand.danger += 4; }
      if (choice === 'negotiate') { activateSeed(state, 'tianhe'); relation(state, 'player', 'tianhe').trust += 8; state.factions.immortalCrane.attitude += 5; }
      if (choice === 'ambush') { state.central.sectPressure += 4; state.factions.centralSects.tension += 6; p.cultivation.progress += 12; }
      log(state, 'choice', `你处理了宗门对狐仙福地的压力：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.sectPressure });
      return true;
    });
    Engine.registerEvent('shadowSectRebuild', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.shadowSectRebuilt = true; state.worldWar.shadowRebuilt = true;
      activateSeed(state, 'yingwuxie');
      state.factions.shadowSect.influence += choice === 'ally' ? 8 : 3;
      state.factions.centralSects.tension += choice === 'rebuild' ? 4 : 1;
      if (choice === 'rebuild') { p.cultivation.insight += 10; state.facts.shadowIntel = true; }
      if (choice === 'ally') { relation(state, 'player', 'yingwuxie').trust += 5; state.director.pressure += 3; }
      if (choice === 'hide') { p.cultivation.insight += 5; state.director.pressure = Math.max(0, state.director.pressure - 1); }
      log(state, 'choice', `你处理了影宗残脉重新结网：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.shadowRebuild });
      return true;
    });
    Engine.registerEvent('fiveRegionsWar', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.fiveRegionsWarOpened = true; state.worldWar.fiveRegions = true; state.worldWar.heat += choice === 'regions' ? 12 : 6;
      state.factions.longLifeHeaven.tension += 4; state.factions.heavenlyCourt.tension += 4; state.factions.centralSects.tension += 3;
      if (choice === 'central') { p.cultivation.insight += 12; state.facts.fiveRegionsIntel = true; }
      if (choice === 'regions') { p.inventory.stones += 4; state.director.pressure += 3; }
      if (choice === 'observe') { p.cultivation.insight += 8; state.director.pressure += 1; }
      log(state, 'choice', `你处理了五域格局开始转动：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.fiveRegionsWar });
      return true;
    });
    Engine.registerEvent('southernFront', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.southernFrontOpened = true; state.worldWar.southern = true; activateSeed(state, 'wuyong');
      if (choice === 'negotiate') { state.factions.southernSuperClans.tension = Math.max(0, state.factions.southernSuperClans.tension - 8); state.factions.southernSuperClans.attitude += 6; p.cultivation.insight += 7; }
      if (choice === 'mobilize') { state.factions.southernSuperClans.influence += 8; state.worldWar.heat += 7; state.director.pressure += 2; }
      if (choice === 'observe') { p.cultivation.insight += 9; state.facts.southernIntel = true; }
      log(state, 'choice', `你处理了南疆超级家族的边线：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.southernFront });
      return true;
    });
    Engine.registerEvent('westernFront', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.westernFrontOpened = true; state.worldWar.western = true; activateSeed(state, 'fangdichang');
      if (choice === 'trade') { p.inventory.stones += 5; p.cultivation.insight += 8; state.factions.westernDesertFang.attitude += 4; }
      if (choice === 'defend') { state.factions.westernDesertFang.influence += 8; state.worldWar.heat += 6; }
      if (choice === 'raid') { state.factions.westernDesertFang.tension += 12; state.factions.westernDesertFang.attitude -= 8; p.inventory.stones += 8; state.director.pressure += 3; }
      log(state, 'choice', `你处理了西漠房家的蛊屋线：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.westernDesert });
      return true;
    });
    Engine.registerEvent('heavenlyCourtCampaign', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.heavenlyCourtOpened = true; state.worldWar.heavenly = true; activateSeed(state, 'longgong'); activateSeed(state, 'ziweixianzi');
      if (choice === 'infiltrate') { state.factions.heavenlyCourt.tension += 12; state.factions.heavenlyCourt.attitude -= 10; p.cultivation.insight += 14; state.worldWar.heat += 8; }
      if (choice === 'defend') { state.factions.heavenlyCourt.attitude += 6; state.factions.heavenlyCourt.tension = Math.max(0, state.factions.heavenlyCourt.tension - 5); state.director.pressure -= 1; }
      if (choice === 'observe') { p.cultivation.insight += 12; state.facts.heavenlyIntel = true; }
      log(state, 'choice', `你处理了天庭的五域战争决策：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.heavenlyCourt });
      return true;
    });
    Engine.registerEvent('divineEmperorArrival', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.divineEmperorOpened = true; state.eternalWar.divineEmperor = true; activateSeed(state, 'qindingling');
      if (choice === 'enter') { p.cultivation.insight += 12; state.factions.humanPathAlliance.influence += 5; state.factions.heavenlyCourt.influence += 4; }
      if (choice === 'trade') { p.inventory.stones += 7; p.cultivation.insight += 6; state.facts.divineEmperorIntel = true; state.factions.heavenlyCourt.tension += 3; }
      if (choice === 'avoid') { state.director.pressure += 2; state.factions.heavenlyCourt.attitude -= 3; }
      log(state, 'choice', `你处理了神帝城的人道战线：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.divineEmperor });
      return true;
    });
    Engine.registerEvent('twoHeavensConvergence', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.twoHeavensOpened = true; state.eternalWar.twoHeavens = true; state.eternalWar.cosmicHeat += choice === 'sabotage' ? 12 : 6;
      state.factions.twoHeavensForces.tension += choice === 'sabotage' ? 8 : 3; state.factions.heavenlyCourt.tension += 4;
      if (choice === 'support') { state.factions.heavenlyCourt.influence += 8; p.inventory.stones = Math.max(0, p.inventory.stones - 2); }
      if (choice === 'sabotage') { p.inventory.stones += 6; p.cultivation.insight += 8; state.facts.twoHeavensSabotage = true; }
      if (choice === 'observe') { p.cultivation.insight += 14; state.facts.twoHeavensIntel = true; }
      log(state, 'choice', `你处理了两天战场重叠：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.twoHeavens });
      return true;
    });
    Engine.registerEvent('madDemonCaveOpening', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.madDemonCaveOpened = true; state.eternalWar.madDemonCave = true; activateSeed(state, 'luweiyin');
      if (choice === 'descend') { p.cultivation.insight += 18; state.eternalWar.cosmicHeat += 10; state.facts.originSecret = true; }
      if (choice === 'consult') { relation(state, 'player', 'luweiyin').trust += 8; p.cultivation.insight += 10; state.eternalWar.cosmicHeat = Math.max(0, state.eternalWar.cosmicHeat - 3); }
      if (choice === 'seal') { state.eternalWar.cosmicHeat = Math.max(0, state.eternalWar.cosmicHeat - 8); state.director.pressure += 1; }
      log(state, 'choice', `你处理了疯魔窟的元境线索：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.madDemonCave });
      return true;
    });
    Engine.registerEvent('dreamRealmSurge', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.dreamSurgeOpened = true; state.eternalWar.dream = true;
      if (choice === 'enter') { p.cultivation.insight += 16; state.eternalWar.dreamPressure += 10; state.facts.dreamDepth = (state.facts.dreamDepth || 0) + 1; }
      if (choice === 'harvest') { p.inventory.stones += 5; state.eternalWar.dreamPressure += 14; state.factions.dreamPathForces.influence += 6; }
      if (choice === 'avoid') { state.eternalWar.dreamPressure = Math.max(0, state.eternalWar.dreamPressure - 5); state.director.pressure += 1; }
      log(state, 'choice', `你处理了梦境战场潮汐：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.twoHeavens });
      return true;
    });
    Engine.registerEvent('starHostPlan', ({ state, choice, event }) => {
      const p = state.entities.player;
      state.flags.starHostPlanOpened = true; state.eternalWar.starHost = true;
      if (choice === 'defend') { state.eternalWar.cosmicHeat = Math.max(0, state.eternalWar.cosmicHeat - 12); state.factions.heavenlyCourt.influence += 8; }
      if (choice === 'break') { p.cultivation.insight += 22; state.eternalWar.cosmicHeat += 15; state.facts.starHostWeakness = true; state.factions.heavenlyCourt.tension += 10; }
      if (choice === 'wait') { p.needs.energy = Math.min(100, p.needs.energy + 20); state.eternalWar.cosmicHeat += 4; }
      log(state, 'choice', `你处理了星宿安排与天脉节点：${event.choices.find(c => c.id === choice).label}。`, { source: SOURCE_NOTES.starHost });
      return true;
    });
  }

  function normalize(state) {
    const p = state.entities.player;
    state.contracts ||= { available: [], active: {}, completed: [] };
    state.contracts.available ||= []; state.contracts.active ||= {}; state.contracts.completed ||= [];
    state.arena ||= { location: 'merchantCity', active: false, matches: 0, wins: 0, losses: 0, streak: 0, reputation: 0 };
    state.inheritance ||= { location: 'threeForkMountain', active: false, attempts: 0, round: 0, difficulty: 1, discoveries: [], completed: false };
    state.frontier ||= { location: 'northernPlains', opened: false, supply: 72, campaignPressure: 0, battles: 0, casualties: 0 };
    state.tower ||= { location: 'trueYangTower', formed: false, floors: 0, attempts: 0, discoveries: [], active: false };
    state.central ||= { foxOpened: false, centralOpened: false, auctionActive: false, lotsSold: 0, auctionHeat: 0, sectPressure: 0 };
    state.worldWar ||= { shadowRebuilt: false, fiveRegions: false, southern: false, western: false, heavenly: false, heat: 0 };
    state.eternalWar ||= { divineEmperor: false, twoHeavens: false, madDemonCave: false, dream: false, starHost: false, dreamPressure: 0, cosmicHeat: 0, dives: 0, successes: 0, failures: 0 };
    state.director ||= { pressure: 0, lastTick: 0, thread: [], history: [], cooldowns: {}, beat: 'opening' };
    state.director.thread ||= []; state.director.history ||= []; state.director.cooldowns ||= {};
    state.arena.matches = Math.max(0, Number(state.arena.matches) || 0); state.arena.wins = Math.max(0, Number(state.arena.wins) || 0); state.arena.losses = Math.max(0, Number(state.arena.losses) || 0); state.arena.streak = Math.max(0, Number(state.arena.streak) || 0); state.arena.reputation = Math.max(0, Number(state.arena.reputation) || 0);
    state.inheritance.attempts = Math.max(0, Number(state.inheritance.attempts) || 0); state.inheritance.round = Math.max(0, Number(state.inheritance.round) || 0); state.inheritance.difficulty = Math.max(1, Number(state.inheritance.difficulty) || 1); state.inheritance.discoveries ||= [];
    state.frontier.supply = clamp(Number(state.frontier.supply) || 0, 0, 100); state.frontier.campaignPressure = clamp(Number(state.frontier.campaignPressure) || 0, 0, 100); state.frontier.battles = Math.max(0, Number(state.frontier.battles) || 0); state.frontier.casualties = Math.max(0, Number(state.frontier.casualties) || 0);
    state.tower.floors = Math.max(0, Number(state.tower.floors) || 0); state.tower.attempts = Math.max(0, Number(state.tower.attempts) || 0); state.tower.discoveries ||= [];
    state.central.lotsSold = Math.max(0, Number(state.central.lotsSold) || 0); state.central.auctionHeat = clamp(Number(state.central.auctionHeat) || 0, 0, 100); state.central.sectPressure = clamp(Number(state.central.sectPressure) || 0, 0, 100);
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
      if (state.factions.auctionImmortals) state.factions.auctionImmortals.tension += event.payload.result === 'bid' ? 0.8 : 0.2;
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

  function registerActionHandlers() {
    Engine.registerAction('accept_contract', ({ state, command }) => contractRuntime.accept(state, command.contractId));
    Engine.registerAction('complete_contract', ({ state, command }) => contractRuntime.complete(state, command.contractId));
    Engine.registerAction('arena_match', ({ state, p }) => repeatableRuntime.arenaMatch(state, p));
    Engine.registerAction('inheritance_round', ({ state, p }) => repeatableRuntime.inheritanceRound(state, p));
    Engine.registerAction('frontier_patrol', ({ state, p }) => repeatableRuntime.frontierPatrol(state, p));
    Engine.registerAction('tower_floor', ({ state, p }) => repeatableRuntime.towerFloor(state, p));
    Engine.registerAction('auction_lot', ({ state, command, p }) => repeatableRuntime.auctionLot(state, p, command));
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
    for (const npc of Engine.queryWith(state, 'needs', 'memory')) {
      if (npc.id === 'player') continue;
      npc.needs.energy = clamp(npc.needs.energy + 35, 0, 100);
      npc.needs.hunger = clamp(npc.needs.hunger - 25, 0, 100);
      for (const episode of npc.memory.episodes) episode.valence *= 0.985;
    }
    const p = state.entities.player;
    for (const zone of Object.values(state.zones)) {
      zone.activity = Math.max(0, zone.activity - 12);
      zone.danger = clamp(zone.danger + (zone.activity > 45 ? 2 : -1), 0, 100);
      if (zone.resources.water !== undefined) zone.resources.water = Math.min(12, zone.resources.water + 2);
      if (zone.resources.moonPetal !== undefined) zone.resources.moonPetal = Math.min(16, zone.resources.moonPetal + 3);
      if (zone.resources.food !== undefined) zone.resources.food = Math.min(8, zone.resources.food + 1);
      if (zone.resources.relicFragment !== undefined && state.flags.relicDiscovered) zone.resources.relicFragment = Math.min(3, zone.resources.relicFragment + 0.2);
      zone.weather = random(state) < 0.65 ? '雨' : random(state) < 0.5 ? '晴' : '雾';
    }
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
    Engine.registerSystem('hour', 'npcSimulation', ({ state }) => NpcAI.tick(state, { engine: Engine, locations: LOCATIONS, phase, hour, day, random, clamp, relation, remember, log, relValence }), 50);
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
    const damage = Math.max(1, Math.round(amount));
    const limbNames = Object.keys(target.body.limbs);
    const limb = limbNames[Math.floor(random(state) * limbNames.length)];
    target.body.health -= damage;
    target.body.limbs[limb] = clamp(target.body.limbs[limb] - Math.round(damage * 0.65), 0, 100);
    target.body.wounds.unshift({ clock: state.clock, sourceId, kind, limb, damage });
    target.body.wounds = target.body.wounds.slice(0, 12);
    Condition.apply(target, 'wounded', { duration: 24, intensity: damage, source: sourceId, clock: state.clock });
    Engine.emit(state, 'combat.damage', { targetId, sourceId, kind, limb, damage });
    remember(state, targetId, sourceId, { kind: 'injury', valence: -damage, text: `你在${limb}处留下了伤势。` });
    log(state, 'damage', `${target.identity.name} 受到 ${damage} 点${kind === 'gu' ? '蛊术' : '伤害'}。`, { targetId, sourceId, limb, damage });
    if (target.body.health <= 0) {
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
      const ability = Ability.activate(p, command.guId || 'moonlight', GU_SEEDS);
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
    normalize(state);
    return state;
  }

  function snapshot(state) {
    const p = state.entities.player;
    return {
      day: day(state), hour: hour(state), phase: phase(state), location: p.position.location,
      player: { ...p.cultivation, name: p.identity.name, inventory: copy(p.inventory), abilities: copy(p.abilities), needs: copy(p.needs) },
      combat: copy(state.combat || null),
      nearby: Engine.query(state, e => e.id !== 'player' && e.alive && e.position.location === p.position.location).map(e => ({ id: e.id, name: e.identity.name, role: e.identity.role, goal: e.goals.active, relationship: copy(relation(state, 'player', e.id)), memory: e.memory.episodes[0] || null })),
      factions: Object.values(state.factions).map(f => ({ id: f.id, name: f.name, influence: f.influence, tension: f.tension, attitude: f.attitude })),
      activeEvent: copy(state.events.active), zone: copy(state.zones[p.position.location]), arena: copy(state.arena), inheritance: copy(state.inheritance), frontier: copy(state.frontier), tower: copy(state.tower), central: copy(state.central), worldWar: copy(state.worldWar), eternalWar: copy(state.eternalWar), contracts: copy(state.contracts), eventStream: copy(state.events.pending || []), domainEvents: copy(state.events.recent || []), engine: { components: Engine.COMPONENTS, registries: Engine.registries() }, history: History.summary(state), log: state.log.slice(0, 20).map(copy)
    };
  }

  contractRuntime = Contracts.createRuntime({ definitions: CONTRACT_DEFS, day, copy, relation, affectFaction, remember, log, advance });
  repeatableRuntime = RepeatableSystems.createRuntime({ engine: Engine, random, clamp, relation, remember, log, damageEntity, advance });
  directorRulesRuntime = DirectorRules.createRuntime({ engine: Engine, day, sourceNotes: SOURCE_NOTES });
  directorRulesRuntime.registerRules();
  registerEventHandlers();
  registerGoalHandlers();
  DefaultGoals.register({ engine: Engine, remember });
  registerInteractionHandlers();
  registerEventListeners();
  registerActionHandlers();
  registerSystemHandlers();
  return { SCHEMA_VERSION, CONTENT_VERSION, CONTENT_INDEX, CONTRACT_DEFS, CONVERSATION_DEFS, LOCATIONS, FACTION_SEEDS, GU_SEEDS, SOURCE_NOTES, ENGINE: Engine, ENTITY: Entity, CONDITION: Condition, CONTRACTS: contractRuntime, REPEATABLE_SYSTEMS: repeatableRuntime, DIRECTOR_RULES: directorRulesRuntime, ZONE_BUILDER: ZoneBuilder, NPC_AI: NpcAI, DEFAULT_GOALS: DefaultGoals, CONVERSATION_RUNTIME: Conversation, RUMOR: Rumor, ACTION_CATALOG: ActionCatalog, DIRECTOR: Director, INTENT: Intent, ABILITY: Ability, newWorld, dispatch, interpret, validate, snapshot, day, hour, phase };
});
