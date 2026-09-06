(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./content.js'), require('./history.js'), require('./zone-builder.js'), require('./npc-ai.js'), require('./entity.js'), require('./conversation.js'), require('./rumor.js'), require('./action-catalog.js'), require('./director.js'));
  else root.GuSimulation = factory(root.GuSimulationEngine, root.GuSimulationContent, root.GuSimulationHistory, root.GuSimulationZoneBuilder, root.GuSimulationNpcAI, root.GuSimulationEntity, root.GuSimulationConversation, root.GuSimulationRumor, root.GuSimulationActionCatalog, root.GuSimulationDirector);
})(globalThis, function (Engine, Content, History, ZoneBuilder, NpcAI, Entity, Conversation, Rumor, ActionCatalog, Director) {
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

  function contractDef(id) { return CONTRACT_DEFS.find(definition => definition.id === id); }

  function refreshContracts(state) {
    state.contracts ||= { available: [], active: {}, completed: [] };
    state.contracts.available ||= []; state.contracts.active ||= {}; state.contracts.completed ||= [];
    for (const definition of CONTRACT_DEFS) {
      if (state.contracts.completed.some(item => item.id === definition.id) || state.contracts.active[definition.id] || state.contracts.available.includes(definition.id)) continue;
      if (day(state) < definition.availableFromDay) continue;
      if ((definition.flags || []).some(flag => !state.flags[flag])) continue;
      if (!state.entities[definition.giver]?.alive) continue;
      state.contracts.available.push(definition.id);
    }
  }

  function contractObjectiveSatisfied(state, definition) {
    const objective = definition.objective;
    const p = state.entities.player;
    if (objective.type === 'helpTalk') return !!state.entities[objective.target]?.memory.facts.player?.helped;
    if (objective.type === 'investigationLeverage') return !!p.memory.facts.world.investigationLeverage;
    if (objective.type === 'arenaWins') return state.arena.wins >= objective.count;
    if (objective.type === 'inheritanceRound') return state.inheritance.round >= objective.count;
    return false;
  }

  function acceptContract(state, id) {
    refreshContracts(state);
    const definition = contractDef(id);
    if (!definition || !state.contracts.available.includes(id)) throw new Error('当前没有这份委托');
    const p = state.entities.player; const giver = state.entities[definition.giver];
    if (!giver || giver.position.location !== p.position.location || !definition.locations.includes(p.position.location)) throw new Error('委托人不在当前位置');
    state.contracts.available = state.contracts.available.filter(item => item !== id);
    state.contracts.active[id] = { id, giver: definition.giver, acceptedClock: state.clock, objective: copy(definition.objective) };
    remember(state, definition.giver, 'player', { kind: 'contract', valence: 2, text: `你接受了委托“${definition.title}”。`, facts: { contractAccepted: id } });
    log(state, 'contract', `你接受了委托：${definition.title}。`, { contractId: id, phase: 'accepted' });
    advance(state, 1, 'contract');
  }

  function completeContract(state, id) {
    refreshContracts(state);
    const definition = contractDef(id); const active = state.contracts.active[id];
    if (!definition || !active) throw new Error('你没有接受这份委托');
    if (!contractObjectiveSatisfied(state, definition)) throw new Error('委托目标尚未完成');
    const p = state.entities.player; const reward = definition.reward || {};
    if (reward.insight) p.cultivation.insight += reward.insight;
    if (reward.stones) p.inventory.stones = (p.inventory.stones || 0) + reward.stones;
    if (reward.reputation) state.arena.reputation += reward.reputation;
    if (reward.trust) relation(state, 'player', reward.trust.target).trust += reward.trust.amount;
    if (reward.faction) affectFaction(state, reward.faction.id, reward.faction.attitude || 0, reward.faction.tension || 0);
    delete state.contracts.active[id]; state.contracts.completed.push({ id, completedClock: state.clock });
    log(state, 'contract', `你完成了委托：${definition.title}。`, { contractId: id, phase: 'completed', reward });
    advance(state, 1, 'contract');
  }

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
      flags: { openingRiteResolved: false, moonlightRumor: false, relicDiscovered: false, marketArrived: false, auctionHeld: false, allianceCouncil: false, wolfTide: false, tournamentAnnounced: false, investigationArrived: false, merchantCityOpened: false, arenaTrial: false, threeKingsAwakened: false, heavenClimbRumor: false, northernFrontierOpened: false, blackCampaign: false, imperialCourtOpened: false, trueYangTowerFormed: false, foxFairyLandOpened: false, centralContinentOpened: false, immortalAuctionOpened: false, sectPressureActive: false },
      events: { active: null, pending: [], recent: [], history: [], sequence: 0 },
      combat: null,
      arena: { location: 'merchantCity', active: false, matches: 0, wins: 0, losses: 0, streak: 0, reputation: 0 },
      inheritance: { location: 'threeForkMountain', active: false, attempts: 0, round: 0, difficulty: 1, discoveries: [], completed: false },
      frontier: { location: 'northernPlains', opened: false, supply: 72, campaignPressure: 0, battles: 0, casualties: 0 },
      tower: { location: 'trueYangTower', formed: false, floors: 0, attempts: 0, discoveries: [], active: false },
      central: { foxOpened: false, centralOpened: false, auctionActive: false, lotsSold: 0, auctionHeat: 0, sectPressure: 0 },
      director: { pressure: 0, lastTick: 0, thread: [], beat: 'opening' },
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

  function registerDirectorRules() {
    Engine.registerDirectorRule({ id: 'moonlightRumor', priority: 10, when: state => !state.flags.moonlightRumor && day(state) >= 2 && state.entities.player.position.location === 'bambooForest', build: () => ({ id: 'moonlightRumor', type: 'rumor', title: '竹林里的酒香', text: '雨停之后，竹叶间传来一缕不属于山泉的酒香。有人先你一步来过。', choices: [
      { id: 'follow', label: '沿着痕迹跟下去', hint: '打开花酒遗藏的调查线。' },
      { id: 'report', label: '把消息交给家老', hint: '获得家族信用，但线索不再只属于你。' },
      { id: 'ignore', label: '记在心里，先做自己的事', hint: '保留秘密，等待更有利的时机。' }
    ], source: SOURCE_NOTES.relic }) });
    Engine.registerDirectorRule({ id: 'academyRivalry', priority: 20, when: state => day(state) >= 3 && state.factions.guYue.tension >= 32 && state.entities.player.position.location === 'academy', build: () => ({ id: 'academyRivalry', type: 'social', title: '学堂里的较量', text: '漠北和赤城在草人前争夺一次演示机会，方正被推到了两人之间。', choices: [
      { id: 'mediate', label: '替方正把争执压下去', hint: '方正会记住你的帮助。' },
      { id: 'join', label: '加入竞争，证明自己的月刃', hint: '提高个人名望，也增加敌意。' },
      { id: 'watch', label: '旁观并记下每个人的弱点', hint: '获得知识，关系保持不变。' }
    ], source: SOURCE_NOTES.academy }) });
    Engine.registerDirectorRule({ id: 'marketArrival', priority: 30, when: state => !state.flags.marketArrived && day(state) >= 5 && ['village', 'caravanCamp'].includes(state.entities.player.position.location), build: () => ({ id: 'marketArrival', type: 'market', title: '商队提前进入青茅山', text: '商队的旗帜穿过雨幕，贾富和江牙把外界的货物、消息与价格一起带进山寨。', source: SOURCE_NOTES.market, choices: [
      { id: 'trade', label: '用元石换取资源', hint: '得到水、花瓣和商路信用。' },
      { id: 'listen', label: '只听消息不表态', hint: '获得白家、熊家和北方商路的情报。' },
      { id: 'scheme', label: '让商队替你散布传闻', hint: '增加市场活动，也会提高势力紧张度。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'auction', priority: 35, when: state => state.flags.marketArrived && !state.flags.auctionHeld && day(state) >= 7 && ['village', 'caravanCamp'].includes(state.entities.player.position.location), build: () => ({ id: 'auction', type: 'market', title: '贾富的拍卖会', text: '贾富把一批外来蛊材摆上台面。价格只是表面，真正的较量是山寨成员是否愿意为稀缺资源彼此抬价。', source: SOURCE_NOTES.auction, choices: [
      { id: 'buy', label: '出价购买蛊材', hint: '消耗元石，换取稀缺资源和商队信用。' },
      { id: 'sell', label: '出售手中资源', hint: '把当前资源压力转化为元石。' },
      { id: 'observe', label: '观察竞价与人群', hint: '获得对贾富和山寨势力的情报。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'allianceCouncil', priority: 40, when: state => !state.flags.allianceCouncil && day(state) >= 8 && (state.factions.guYue.tension >= 35 || state.director.pressure >= 5) && ['village', 'ancestralHall'].includes(state.entities.player.position.location), build: () => ({ id: 'allianceCouncil', type: 'politics', title: '三寨联盟的利益分配', text: '狼群的阴影还在远方，古月、白家与熊家却已经开始争论：若要结盟，谁来出人，谁来让利，谁来承担最危险的防线？', source: SOURCE_NOTES.wolf, choices: [
      { id: 'aid', label: '推动共同防线', hint: '改善三族关系，消耗古月的资源影响。' },
      { id: 'hoard', label: '优先保住古月山寨', hint: '提高本族防御，却让联盟更难谈成。' },
      { id: 'spy', label: '记录各族的底牌', hint: '获得情报和个人洞察，留下政治记忆。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'wolfTide', priority: 50, when: state => !state.flags.wolfTide && day(state) >= 12 && ['village', 'bambooForest', 'riverbank'].includes(state.entities.player.position.location) && (state.director.pressure >= 4 || state.factions.guYue.tension >= 42), build: () => ({ id: 'wolfTide', type: 'crisis', title: '狼潮正在逼近', text: '山林里的猎物突然减少，远处传来群狼试探性的嚎叫。狼潮还没有攻入山寨，但资源、巡逻和每个家族的判断已经开始改变。', source: SOURCE_NOTES.wolf, choices: [
      { id: 'mobilize', label: '加入巡逻与布防', hint: '降低当前区域危险，提升古月影响。' },
      { id: 'hunt', label: '趁混乱深入山林', hint: '获得资源和线索，但承担更高伤害风险。' },
      { id: 'secure', label: '囤积资源等待变化', hint: '提高个人储备，让野外区域更危险。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'threeClanTournament', priority: 60, when: state => state.flags.wolfTide && !state.flags.tournamentAnnounced && day(state) >= 18 && ['village', 'academy'].includes(state.entities.player.position.location), build: () => ({ id: 'threeClanTournament', type: 'competition', title: '三族大比武的筹备', text: '狼潮后的赔偿和资源分配无法靠口舌解决。古月、白家与熊家决定以三族大比武定下新的秩序，年轻蛊师被推到所有人的目光下。', source: SOURCE_NOTES.tournament, choices: [
      { id: 'enter', label: '报名参加比武', hint: '获得个人名望，但会把身体和关系都推入公开竞争。' },
      { id: 'sponsor', label: '支持本族参赛者', hint: '提升古月影响，减少直接受伤风险。' },
      { id: 'observe', label: '观察各族底牌', hint: '获得情报，记住谁在狼潮后真正保存了实力。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'ironInvestigation', priority: 70, when: state => state.flags.tournamentAnnounced && !state.flags.investigationArrived && day(state) >= 22 && ['village', 'ancestralHall'].includes(state.entities.player.position.location), build: () => ({ id: 'ironInvestigation', type: 'investigation', title: '铁家父女进入青茅山', text: '铁血冷与铁若男带着一桩未完的案件进入山寨。正道的秩序、家族的猜疑和个人记忆开始争夺同一个真相。', source: SOURCE_NOTES.investigation, choices: [
      { id: 'cooperate', label: '主动提供线索', hint: '换取调查者信任，但你的行动会被纳入他们的案卷。' },
      { id: 'evade', label: '隐藏自己的痕迹', hint: '保留行动自由，却让正道巡查提高警惕。' },
      { id: 'bargain', label: '用情报交换条件', hint: '把真相变成一笔政治交易。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'merchantCityArrival', priority: 80, when: state => !state.flags.merchantCityOpened && day(state) >= 30 && ['whiteBoneMountain', 'merchantCity'].includes(state.entities.player.position.location), build: () => ({ id: 'merchantCityArrival', type: 'journey', title: '商家城的大门', text: '离开青茅山的熟人秩序后，城门、演武场、商铺和少主派系组成了另一种生存规则。你可以把商家城当作庇护，也可以把它当作更大的猎场。', source: SOURCE_NOTES.merchantCity, choices: [
      { id: 'enter', label: '进入商家城', hint: '开启城市交易、演武和外姓蛊师系统。' },
      { id: 'survey', label: '先在城外观察', hint: '获得城市势力情报，延缓与商家绑定。' },
      { id: 'avoid', label: '继续向三叉山赶路', hint: '错过城市资源，但更早接近三王传承。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'merchantArena', priority: 90, when: state => state.flags.merchantCityOpened && !state.flags.arenaTrial && day(state) >= 32 && state.entities.player.position.location === 'merchantCity', build: () => ({ id: 'merchantArena', type: 'social', title: '商家城演武场', text: '演武场把蛊师的修为、蛊虫和名声公开标价。每一场胜负都会改变你在商家城的关系网络。', source: SOURCE_NOTES.merchantCity, choices: [
      { id: 'fight', label: '接受演武挑战', hint: '提升名望和商家影响，但会积累伤势。' },
      { id: 'recruit', label: '观察并结交强者', hint: '打开商心慈、魏央和外姓蛊师的关系线。' },
      { id: 'trade', label: '用资源换取情报', hint: '牺牲一部分储备，获得三叉山传承的消息。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'threeKingsInheritance', priority: 100, when: state => state.flags.arenaTrial && !state.flags.threeKingsAwakened && day(state) >= 40 && state.entities.player.position.location === 'threeForkMountain', build: () => ({ id: 'threeKingsInheritance', type: 'inheritance', title: '三王传承开启', text: '三叉山的三道光柱重新贯入云霄。正道、魔道和商家城的队伍同时进入山中，传承不是静态宝箱，而是会周期性开放、提高难度并改变争夺者关系的区域规则。', source: SOURCE_NOTES.threeKings, choices: [
      { id: 'enter', label: '进入传承关卡', hint: '消耗精力和资源，获取传承进度。' },
      { id: 'scout', label: '先侦查其他队伍', hint: '获得敌对队伍记忆，降低第一次进入的风险。' },
      { id: 'ambush', label: '埋伏离开传承的蛊师', hint: '可能获得蛊虫，但会迅速恶化正魔关系。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'heavenClimbTransmission', priority: 110, when: state => state.flags.threeKingsAwakened && !state.flags.heavenClimbRumor && day(state) >= 46 && state.entities.player.position.location === 'heavenClimbMountain', build: () => ({ id: 'heavenClimbTransmission', type: 'sect', title: '天梯山的狐仙传承', text: '远方门派的消息传到山中：天梯山出现了狐仙福地传承，各大门派不愿让蛊仙亲自下场，于是把争夺交给门下弟子。', source: SOURCE_NOTES.heavenClimb, choices: [
      { id: 'follow', label: '追踪门派队伍', hint: '打开更高层级的门派竞争。' },
      { id: 'sell', label: '把消息卖给商家城', hint: '获得资源与商家关系，但会让传承竞争者增加。' },
      { id: 'ignore', label: '留在三叉山积累实力', hint: '暂时避开门派冲突，保留行动自由。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'northernWarArrival', priority: 120, when: state => state.flags.heavenClimbRumor && !state.flags.northernFrontierOpened && day(state) >= 55 && ['heavenClimbMountain', 'northernPlains'].includes(state.entities.player.position.location), build: () => ({ id: 'northernWarArrival', type: 'war', title: '北原战报与远方军帐', text: '天梯山传承的消息尚未冷却，北原草原的战报已经沿商路传来：黑家盟军、东方盟军和各部族正在争夺进入王庭福地的资格。战争的补给、侦察和伤亡会先于英雄叙事改变这片土地。', source: SOURCE_NOTES.northernWar, choices: [
      { id: 'enter', label: '沿商路北上', hint: '开启北原草原、军营和部族战争系统。' },
      { id: 'observe', label: '先收集战报', hint: '获得北原情报，但战争压力会继续累积。' },
      { id: 'avoid', label: '暂不卷入北原', hint: '保留南疆行动自由，错过早期军帐关系。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'blackCampaign', priority: 130, when: state => state.flags.northernFrontierOpened && !state.flags.blackCampaign && day(state) >= 62 && ['northernPlains', 'blackTribeCamp'].includes(state.entities.player.position.location), build: () => ({ id: 'blackCampaign', type: 'war', title: '黑盟军帐的选择', text: '黑楼兰的军帐把部族、后勤、侦察和个人野心压在同一张战图上。东方盟军并未撤退，中小部族却已经开始计算自己还能承受多少伤亡。', source: SOURCE_NOTES.northernWar, choices: [
      { id: 'mobilize', label: '加入黑盟后勤', hint: '提升黑家影响，消耗资源并增加战争暴露。' },
      { id: 'mediate', label: '为中小部族求情', hint: '降低部分战争压力，但会触怒强硬派。' },
      { id: 'scout', label: '侦察东方军势', hint: '获得情报，增加与东方盟军的敌意。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'imperialCourtOpening', priority: 140, when: state => state.flags.blackCampaign && !state.flags.imperialCourtOpened && day(state) >= 72 && ['blackTribeCamp', 'imperialCourt'].includes(state.entities.player.position.location), build: () => ({ id: 'imperialCourtOpening', type: 'politics', title: '王庭福地的门槛', text: '战争把各族推向王庭福地。有人要求休养，有人要求继续攻伐；王庭的资格不只是奖励，也是一种把部族伤亡继续转成资源的制度。', source: SOURCE_NOTES.tribeCrisis, choices: [
      { id: 'support', label: '支持继续攻伐', hint: '获得强势盟军信任，但中小部族的怨恨会增加。' },
      { id: 'relief', label: '推动部族休养', hint: '降低战争压力，牺牲一部分黑盟影响。' },
      { id: 'broker', label: '交换自己的情报', hint: '把战报和传承资格变成个人筹码。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'trueYangTowerFormation', priority: 150, when: state => state.flags.imperialCourtOpened && !state.flags.trueYangTowerFormed && day(state) >= 78 && state.entities.player.position.location === 'trueYangTower', build: () => ({ id: 'trueYangTowerFormation', type: 'inheritance', title: '八十八角真阳楼显化', text: '风雪与王庭福地的力量共同让八十八角真阳楼逐层显化。塔楼不是静态副本：外界天气、血脉资格、战争后勤和闯关者的选择都会改变它的开放状态。', source: SOURCE_NOTES.towerFormation, choices: [
      { id: 'enter', label: '寻找进入真阳楼的资格', hint: '开启塔楼闯关，但会暴露你的行动轨迹。' },
      { id: 'assist', label: '帮助部族稳定后勤', hint: '提升北原势力关系，延缓个人探索。' },
      { id: 'watch', label: '观察楼层显化规律', hint: '获得塔楼情报，等待更安全的窗口。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'foxFairyLandReturn', priority: 160, when: state => state.flags.trueYangTowerFormed && !state.flags.foxFairyLandOpened && day(state) >= 90 && state.entities.player.position.location === 'foxFairyLand', build: () => ({ id: 'foxFairyLandReturn', type: 'base', title: '回归狐仙福地', text: '北原的风雪暂时留在身后。狐仙福地重新成为你的基地：魂魄需要休整，资源需要经营，外部势力却已经开始沿着传承和智慧的线索追来。', source: SOURCE_NOTES.foxReturn, choices: [
      { id: 'recover', label: '先休整并经营福地', hint: '恢复行动资源，降低短期压力。' },
      { id: 'prepare', label: '立即准备防御', hint: '提高福地防御与宗门警戒，但消耗资源。' },
      { id: 'hide', label: '隐藏回归消息', hint: '减少外界注意，延缓中洲势力介入。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'centralContinentArrival', priority: 170, when: state => state.flags.foxFairyLandOpened && !state.flags.centralContinentOpened && day(state) >= 96 && state.entities.player.position.location === 'centralContinent', build: () => ({ id: 'centralContinentArrival', type: 'sect', title: '中洲宗门的视线', text: '中洲的道路不只连接地点，也连接宗门的情报网。仙鹤门、灵缘斋和其他古派开始根据你的北原经历重新估价。', source: SOURCE_NOTES.sectPressure, choices: [
      { id: 'sect', label: '接触宗门使者', hint: '获得宗门关系，但暴露更多个人信息。' },
      { id: 'trade', label: '只交换资源与情报', hint: '保持中立，打开市场网络。' },
      { id: 'avoid', label: '避开宗门视线', hint: '降低短期风险，但失去合法援助。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'immortalAuction', priority: 180, when: state => state.flags.centralContinentOpened && !state.flags.immortalAuctionOpened && day(state) >= 105 && state.entities.player.position.location === 'immortalAuction', build: () => ({ id: 'immortalAuction', type: 'market', title: '中洲仙蛊拍卖大会', text: '拍卖会把仙蛊、蛊方、情报和各大势力的关系网放在同一个大厅里。价格不是唯一成本，出价本身也会告诉别人你正在寻找什么。', source: SOURCE_NOTES.immortalAuction, choices: [
      { id: 'bid', label: '参加竞拍', hint: '消耗元石与关系，获得稀缺资源的机会。' },
      { id: 'observe', label: '观察各方需求', hint: '获得价格和势力情报，保留资源。' },
      { id: 'rumor', label: '出售北原情报', hint: '获得资金，但会让更多人追踪你的过去。' }
    ] }) });
    Engine.registerDirectorRule({ id: 'sectPressure', priority: 190, when: state => state.flags.immortalAuctionOpened && !state.flags.sectPressureActive && day(state) >= 115 && state.entities.player.position.location === 'foxFairyLand', build: () => ({ id: 'sectPressure', type: 'siege', title: '宗门对狐仙福地的压力', text: '拍卖会之后，宗门不再满足于旁观。方正的师徒关系、狐仙福地的资源和你的北原行踪被卷进同一场攻防，福地的安全不再是默认前提。', source: SOURCE_NOTES.sectPressure, choices: [
      { id: 'defend', label: '启动福地防御', hint: '消耗资源，降低入侵风险。' },
      { id: 'negotiate', label: '与仙鹤门谈判', hint: '把方正和宗门关系转化为缓冲。' },
      { id: 'ambush', label: '诱敌深入再反击', hint: '提高收益和风险，留下长期敌意。' }
    ] }) });
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
    state.arena.matches = Math.max(0, Number(state.arena.matches) || 0); state.arena.wins = Math.max(0, Number(state.arena.wins) || 0); state.arena.losses = Math.max(0, Number(state.arena.losses) || 0); state.arena.streak = Math.max(0, Number(state.arena.streak) || 0); state.arena.reputation = Math.max(0, Number(state.arena.reputation) || 0);
    state.inheritance.attempts = Math.max(0, Number(state.inheritance.attempts) || 0); state.inheritance.round = Math.max(0, Number(state.inheritance.round) || 0); state.inheritance.difficulty = Math.max(1, Number(state.inheritance.difficulty) || 1); state.inheritance.discoveries ||= [];
    state.frontier.supply = clamp(Number(state.frontier.supply) || 0, 0, 100); state.frontier.campaignPressure = clamp(Number(state.frontier.campaignPressure) || 0, 0, 100); state.frontier.battles = Math.max(0, Number(state.frontier.battles) || 0); state.frontier.casualties = Math.max(0, Number(state.frontier.casualties) || 0);
    state.tower.floors = Math.max(0, Number(state.tower.floors) || 0); state.tower.attempts = Math.max(0, Number(state.tower.attempts) || 0); state.tower.discoveries ||= [];
    state.central.lotsSold = Math.max(0, Number(state.central.lotsSold) || 0); state.central.auctionHeat = clamp(Number(state.central.auctionHeat) || 0, 0, 100); state.central.sectPressure = clamp(Number(state.central.sectPressure) || 0, 0, 100);
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
  }

  function performArenaMatch(state, p) {
    if (p.position.location !== 'merchantCity' || !state.arena?.active) throw new Error('当前没有开放的商家城演武资格');
    const opponentPower = 0.18 + Math.floor(state.arena.wins / 3) * 0.06 + random(state) * 0.16;
    const playerPower = 0.28 + p.cultivation.rank * 0.08 + p.cultivation.insight * 0.008 + p.cultivation.aptitude * 0.08 + state.arena.streak * 0.015;
    const win = random(state) < clamp(0.5 + playerPower - opponentPower, 0.12, 0.9);
    state.arena.matches += 1;
    if (win) {
      state.arena.wins += 1; state.arena.streak += 1; state.arena.reputation += 3;
      p.cultivation.progress += 4 + state.arena.streak * 0.4; state.factions.shang.influence += 0.4;
      relation(state, 'player', 'weiyang').trust += 0.3;
      remember(state, 'weiyang', 'player', { kind: 'arena', valence: 2, text: '你在演武场用连续胜利积累名声。' });
      log(state, 'arena_match', `你在商家城演武场获胜，当前连胜 ${state.arena.streak} 场。`, { result: 'win', matches: state.arena.matches, wins: state.arena.wins });
    } else {
      state.arena.losses += 1; state.arena.streak = 0; state.arena.reputation = Math.max(0, state.arena.reputation - 1);
      damageEntity(state, 'player', 3 + state.arena.losses * 0.4, 'arena', 'arena_strike'); p.needs.energy -= 8;
      log(state, 'arena_match', '你在演武场落败，伤势和旁观者的判断一起留下。', { result: 'loss', matches: state.arena.matches, losses: state.arena.losses });
    }
    Engine.emit(state, 'arena.match', { result: win ? 'win' : 'loss', matches: state.arena.matches, wins: state.arena.wins, losses: state.arena.losses });
    advance(state, 2, 'arena_match');
  }

  function performInheritanceRound(state, p) {
    if (p.position.location !== 'threeForkMountain' || !state.inheritance?.active || state.inheritance.completed) throw new Error('当前没有可进入的三王传承');
    const nextRound = state.inheritance.round + 1;
    const difficulty = 1 + Math.floor((nextRound - 1) / 10) * 0.22 + state.inheritance.attempts * 0.015;
    const power = 0.38 + p.cultivation.rank * 0.07 + p.cultivation.insight * 0.007 + p.cultivation.aptitude * 0.06;
    const success = random(state) < clamp(0.72 + power - difficulty * 0.34, 0.08, 0.92);
    state.inheritance.attempts += 1; state.inheritance.difficulty = difficulty;
    if (success) {
      state.inheritance.round = nextRound; state.inheritance.discoveries.push({ round: nextRound, clock: state.clock });
      p.cultivation.progress += 3 + difficulty * 2; p.inventory.relicFragment = (p.inventory.relicFragment || 0) + 1;
      state.facts.threeKingsAttempts = state.inheritance.attempts;
      if (nextRound >= 30) state.inheritance.completed = true;
      remember(state, 'player', 'world', { kind: 'inheritance', valence: 3, text: `你通过了三王传承第${nextRound}轮，下一轮的门槛更高。`, facts: { lastInheritanceRound: nextRound } });
      log(state, 'inheritance_round', `你通过三王传承第 ${nextRound} 轮。`, { result: 'success', round: nextRound, difficulty });
    } else {
      p.needs.energy -= 10; damageEntity(state, 'player', 4 + difficulty * 2, 'inheritance', 'inheritance_trial');
      log(state, 'inheritance_round', `你在三王传承第 ${nextRound} 轮受挫，传承拒绝了这次推进。`, { result: 'failure', round: nextRound, difficulty });
    }
    Engine.emit(state, 'inheritance.round', { result: success ? 'success' : 'failure', round: nextRound, difficulty, attempts: state.inheritance.attempts });
    advance(state, 4, 'inheritance_round');
  }

  function performFrontierPatrol(state, p) {
    if (!state.frontier?.opened || !['northernPlains', 'blackTribeCamp'].includes(p.position.location)) throw new Error('当前没有北原巡逻任务');
    if (state.frontier.supply < 4) throw new Error('北原军需不足，无法组织巡逻');
    const success = random(state) < clamp(0.62 + p.cultivation.rank * 0.05 + p.cultivation.insight * 0.006 - state.frontier.campaignPressure * 0.004, 0.16, 0.9);
    state.frontier.battles += 1;
    state.frontier.supply -= success ? 4 : 9;
    if (success) {
      p.cultivation.insight += 3; p.cultivation.progress += 5; state.factions.black.influence += 0.8;
      remember(state, 'heiloulan', 'player', { kind: 'patrol', valence: 2, text: '你在北原巡逻中守住了补给线。' });
      log(state, 'frontier_patrol', '你完成了一次北原巡逻，补给线暂时没有被截断。', { result: 'success', supply: state.frontier.supply, battles: state.frontier.battles });
    } else {
      state.frontier.casualties += 1; state.frontier.campaignPressure += 3; damageEntity(state, 'player', 4 + state.frontier.campaignPressure * 0.08, 'frontier', 'patrol_ambush');
      state.factions.northernTribes.tension += 2;
      log(state, 'frontier_patrol', '北原巡逻遭到伏击，补给和人员都付出了代价。', { result: 'failure', supply: state.frontier.supply, casualties: state.frontier.casualties });
    }
    Engine.emit(state, 'frontier.patrol', { result: success ? 'success' : 'failure', supply: state.frontier.supply, battles: state.frontier.battles, casualties: state.frontier.casualties });
    advance(state, 3, 'frontier_patrol');
  }

  function performTowerFloor(state, p) {
    if (p.position.location !== 'trueYangTower' || !state.tower?.active || !state.tower.formed) throw new Error('真阳楼当前没有开放的闯层资格');
    const nextFloor = state.tower.floors + 1;
    const difficulty = 1 + Math.floor((nextFloor - 1) / 8) * 0.18 + state.tower.attempts * 0.012 + state.frontier.campaignPressure * 0.003;
    const power = 0.4 + p.cultivation.rank * 0.08 + p.cultivation.insight * 0.006 + p.cultivation.aptitude * 0.06;
    const success = random(state) < clamp(0.7 + power - difficulty * 0.32, 0.1, 0.92);
    state.tower.attempts += 1;
    if (success) {
      state.tower.floors = nextFloor; state.tower.discoveries.push({ floor: nextFloor, clock: state.clock });
      p.cultivation.progress += 4 + difficulty * 1.5; p.inventory.relicFragment = (p.inventory.relicFragment || 0) + 1;
      remember(state, 'player', 'world', { kind: 'tower', valence: 3, text: `你通过了真阳楼第${nextFloor}层，楼层规则和外界战争压力仍在变化。`, facts: { lastTowerFloor: nextFloor } });
      log(state, 'tower_floor', `你通过了八十八角真阳楼第 ${nextFloor} 层。`, { result: 'success', floor: nextFloor, difficulty });
    } else {
      p.needs.energy -= 12; damageEntity(state, 'player', 5 + difficulty * 2, 'trueYangTower', 'tower_trial');
      log(state, 'tower_floor', `你在真阳楼第 ${nextFloor} 层受挫，楼层没有因此停止显化。`, { result: 'failure', floor: nextFloor, difficulty });
    }
    Engine.emit(state, 'tower.floor', { result: success ? 'success' : 'failure', floor: nextFloor, difficulty, attempts: state.tower.attempts });
    advance(state, 5, 'tower_floor');
  }

  function performAuctionLot(state, p, command) {
    if (p.position.location !== 'immortalAuction' || !state.central?.auctionActive) throw new Error('当前没有开放的中洲拍卖会');
    const mode = command.mode || 'observe';
    const price = 2 + Math.floor(state.central.auctionHeat / 12) + Math.floor(random(state) * 3);
    if (!['bid', 'observe', 'rumor'].includes(mode)) throw new Error('未知的拍卖行动');
    if (mode === 'bid') {
      if ((p.inventory.stones || 0) < price) throw new Error(`竞拍至少需要 ${price} 枚元石`);
      p.inventory.stones -= price;
      state.central.lotsSold += 1;
      state.central.auctionHeat += 4;
      p.cultivation.insight += 3 + Math.min(5, Math.floor(price / 2));
      state.factions.auctionImmortals.influence += 0.8;
    } else if (mode === 'observe') {
      state.central.auctionHeat += 1;
      p.cultivation.insight += 2;
      state.facts.auctionIntel = true;
    } else {
      p.inventory.stones += Math.max(1, Math.floor(price / 2));
      state.central.auctionHeat += 5;
      state.central.sectPressure += 1;
      state.facts.auctionIntel = true;
    }
    state.central.auctionHeat = clamp(state.central.auctionHeat, 0, 100);
    Engine.emit(state, 'auction.lot', { actorId: 'player', location: p.position.location, result: mode, price, lotsSold: state.central.lotsSold, heat: state.central.auctionHeat });
    log(state, 'auction_lot', `你在中洲拍卖会选择${mode === 'bid' ? '竞拍' : mode === 'observe' ? '观察' : '出售情报'}，当前成交 ${state.central.lotsSold} 笔。`, { result: mode, price, lotsSold: state.central.lotsSold, heat: state.central.auctionHeat });
    advance(state, 2, 'auction_lot');
  }

  function performConversation(state, command, p) {
    const npc = requireSameLocation(state, command.target);
    const result = Conversation.resolve(CONVERSATION_DEFS, state, command, { day, relation, remember, log, affectFaction });
    Engine.emit(state, 'social.conversation', { actorId: p.id, targetId: npc.id, conversationId: result.definition.id, choiceId: result.choice.id });
    relation(state, 'player', npc.id).lastSeen = state.clock;
    advance(state, 1, 'conversation');
  }

  function registerActionHandlers() {
    Engine.registerAction('accept_contract', ({ state, command }) => acceptContract(state, command.contractId));
    Engine.registerAction('complete_contract', ({ state, command }) => completeContract(state, command.contractId));
    Engine.registerAction('arena_match', ({ state, p }) => performArenaMatch(state, p));
    Engine.registerAction('inheritance_round', ({ state, p }) => performInheritanceRound(state, p));
    Engine.registerAction('frontier_patrol', ({ state, p }) => performFrontierPatrol(state, p));
    Engine.registerAction('tower_floor', ({ state, p }) => performTowerFloor(state, p));
    Engine.registerAction('auction_lot', ({ state, command, p }) => performAuctionLot(state, p, command));
    Engine.registerAction('conversation', ({ state, command, p }) => performConversation(state, command, p));
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
    refreshContracts(state);
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
      const gu = p.inventory.gu?.moonlight;
      if (!gu?.refined || p.cultivation.essence < 8) throw new Error('需要已炼化的月光蛊和至少 8 点真元');
      p.cultivation.essence -= 8;
      playerDamage = 18 + p.cultivation.rank * 5;
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
      if (current.progress >= 100) { current.progress = 100; current.refined = true; log(state, 'milestone', `你炼化了${GU_SEEDS[guId].name}。`, { guId }); }
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
    const q = String(text || '').replace(/[，。！？、,.!?\s]/g, '').toLowerCase();
    if (!q) return { ok: false, message: '输入一个行动，例如“去竹林”“观察”“修炼”“和方正说话”。' };
    const place = [['academy', ['学堂']], ['village', ['山寨']], ['bambooForest', ['竹林']], ['riverbank', ['河滩', '山溪']], ['cliffCave', ['石缝', '遗藏']], ['caravanCamp', ['商队', '营地']], ['whiteBoneMountain', ['白骨山']], ['merchantCity', ['商家城']], ['threeForkMountain', ['三叉山', '传承']], ['heavenClimbMountain', ['天梯山', '狐仙福地']]];
    for (const [id, names] of place) if (names.some(name => q.includes(name)) && /去|走|前往|进入|回/.test(q)) return { ok: true, command: { type: 'action', id: 'travel', location: id }, label: `前往${LOCATIONS[id].name}` };
    if (/修炼|温养|打坐/.test(q)) return { ok: true, command: { type: 'action', id: 'cultivate' }, label: '温养空窍' };
    if (/演武|比斗|擂台/.test(q)) return { ok: true, command: { type: 'action', id: 'arena_match' }, label: '参加演武' };
    if (/三王传承|传承闯关|进入传承/.test(q)) return { ok: true, command: { type: 'action', id: 'inheritance_round' }, label: '挑战传承轮次' };
    if (/北原巡逻|军帐巡逻|侦察北原/.test(q)) return { ok: true, command: { type: 'action', id: 'frontier_patrol' }, label: '执行北原巡逻' };
    if (/真阳楼闯关|闯楼|登塔/.test(q)) return { ok: true, command: { type: 'action', id: 'tower_floor' }, label: '挑战真阳楼楼层' };
    if (/拍卖|竞拍|仙蛊/.test(q)) return { ok: true, command: { type: 'action', id: 'auction_lot', mode: /观察|看看/.test(q) ? 'observe' : /情报|传闻/.test(q) ? 'rumor' : 'bid' }, label: '处理一笔拍卖会交易' };
    if (/听课|学习/.test(q)) return { ok: true, command: { type: 'action', id: 'study' }, label: '听课' };
    if (/采集|采摘|取水|调查|探索|观察/.test(q)) return { ok: true, command: { type: 'action', id: 'gather' }, label: '探索并采集' };
    if (/休息|睡觉/.test(q)) return { ok: true, command: { type: 'action', id: 'rest' }, label: '休息' };
    if (/炼化|炼蛊/.test(q)) return { ok: true, command: { type: 'action', id: 'refine', guId: q.includes('酒虫') ? 'wineWorm' : 'moonlight' }, label: '炼化蛊虫' };
    const names = Object.entries(state.entities).find(([id, e]) => id !== 'player' && q.includes(e.identity.name.replace('古月', '')));
    if (names && /帮助|帮忙/.test(q)) return { ok: true, command: { type: 'action', id: 'talk', target: names[0], mode: 'help' }, label: `帮助${names[1].identity.name}` };
    if (names && /威胁|逼问|施压/.test(q)) return { ok: true, command: { type: 'action', id: 'talk', target: names[0], mode: 'threaten' }, label: `向${names[1].identity.name}施压` };
    if (names && /说|聊|问|谈/.test(q)) return { ok: true, command: { type: 'action', id: 'talk', target: names[0], mode: 'listen' }, label: `与${names[1].identity.name}交谈` };
    if (/等待|等一会/.test(q)) return { ok: true, command: { type: 'action', id: 'wait', hours: 2 }, label: '等待两小时' };
    return { ok: false, message: '没有匹配到安全行动。可用：去地点、修炼、听课、探索、休息、炼化、与 NPC 交谈或施压。' };
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
      player: { ...p.cultivation, name: p.identity.name, inventory: copy(p.inventory), needs: copy(p.needs) },
      combat: copy(state.combat || null),
      nearby: Engine.query(state, e => e.id !== 'player' && e.alive && e.position.location === p.position.location).map(e => ({ id: e.id, name: e.identity.name, role: e.identity.role, goal: e.goals.active, relationship: copy(relation(state, 'player', e.id)), memory: e.memory.episodes[0] || null })),
      factions: Object.values(state.factions).map(f => ({ id: f.id, name: f.name, influence: f.influence, tension: f.tension, attitude: f.attitude })),
      activeEvent: copy(state.events.active), zone: copy(state.zones[p.position.location]), arena: copy(state.arena), inheritance: copy(state.inheritance), frontier: copy(state.frontier), tower: copy(state.tower), central: copy(state.central), contracts: copy(state.contracts), eventStream: copy(state.events.pending || []), domainEvents: copy(state.events.recent || []), engine: { components: Engine.COMPONENTS, registries: Engine.registries() }, history: History.summary(state), log: state.log.slice(0, 20).map(copy)
    };
  }

  registerDirectorRules();
  registerEventHandlers();
  registerGoalHandlers();
  registerInteractionHandlers();
  registerEventListeners();
  registerActionHandlers();
  registerSystemHandlers();
  return { SCHEMA_VERSION, CONTENT_VERSION, CONTENT_INDEX, CONTRACT_DEFS, CONVERSATION_DEFS, LOCATIONS, FACTION_SEEDS, GU_SEEDS, SOURCE_NOTES, ENGINE: Engine, ENTITY: Entity, ZONE_BUILDER: ZoneBuilder, NPC_AI: NpcAI, CONVERSATION_RUNTIME: Conversation, RUMOR: Rumor, ACTION_CATALOG: ActionCatalog, DIRECTOR: Director, newWorld, dispatch, interpret, validate, snapshot, day, hour, phase };
});
