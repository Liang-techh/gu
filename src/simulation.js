(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.GuSimulation = factory(root.GuSimulationEngine);
})(globalThis, function (Engine) {
  'use strict';

  if (!Engine) throw new Error('GuSimulationEngine must load before simulation.js');

  const SCHEMA_VERSION = 2;
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

  const APTITUDE = { '甲等': 0.92, '乙等': 0.68, '丙等': 0.45, '丁等': 0.22 };

  const LOCATIONS = {
    academy: { name: '古月学堂', type: 'institution', neighbors: ['village', 'ancestralHall'], tags: ['safe', 'learning'], population: 'academy' },
    village: { name: '古月山寨', type: 'settlement', neighbors: ['academy', 'bambooForest', 'caravanCamp'], tags: ['safe', 'market'], population: 'village' },
    ancestralHall: { name: '宗族祠堂', type: 'institution', neighbors: ['academy'], tags: ['politics', 'ritual'], population: 'hall' },
    bambooForest: { name: '竹林', type: 'wilderness', neighbors: ['village', 'riverbank'], tags: ['wild', 'resource'], population: 'forest' },
    riverbank: { name: '山溪河滩', type: 'wilderness', neighbors: ['bambooForest', 'cliffCave'], tags: ['wild', 'water'], population: 'river' },
    cliffCave: { name: '瀑布石缝', type: 'ruin', neighbors: ['riverbank'], tags: ['hidden', 'relic'], population: 'ruin' },
    caravanCamp: { name: '商队营地', type: 'market', neighbors: ['village'], tags: ['market', 'rumor'], population: 'caravan' }
  };

  const POPULATION_TABLES = {
    academy: [{ role: '学堂学徒', faction: 'guYue', goals: ['study', 'proveWorth'], weight: 5 }, { role: '旁听者', faction: 'guYue', goals: ['observe', 'socialize'], weight: 2 }],
    village: [{ role: '古月族人', faction: 'guYue', goals: ['work', 'socialize'], weight: 7 }, { role: '猎户', faction: 'guYue', goals: ['hunt', 'trade'], weight: 3 }],
    hall: [{ role: '祠堂执事', faction: 'guYue', goals: ['maintainOrder', 'collectRumors'], weight: 3 }],
    forest: [{ role: '山兽', faction: null, goals: ['forage', 'avoidPlayer'], weight: 5 }, { role: '采药人', faction: 'guYue', goals: ['secureResources', 'returnHome'], weight: 2 }],
    river: [{ role: '山兽', faction: null, goals: ['drink', 'forage'], weight: 4 }, { role: '采集者', faction: 'guYue', goals: ['secureResources', 'returnHome'], weight: 2 }],
    ruin: [{ role: '遗藏窥探者', faction: 'demonic', goals: ['findRelic', 'avoidPlayer'], weight: 2 }],
    caravan: [{ role: '商旅', faction: 'caravans', goals: ['trade', 'collectRumors'], weight: 5 }, { role: '护卫', faction: 'caravans', goals: ['guard', 'patrol'], weight: 3 }]
  };

  const FACTION_SEEDS = {
    guYue: { name: '古月一族', color: '#d6b26b', influence: 68, tension: 18, attitude: 0 },
    bai: { name: '白家寨', color: '#9bb7d3', influence: 42, tension: 24, attitude: -8 },
    xiong: { name: '熊家寨', color: '#b98668', influence: 38, tension: 22, attitude: -6 },
    caravans: { name: '商队与散修', color: '#a6b77c', influence: 32, tension: 12, attitude: 4 },
    demonic: { name: '魔道游修', color: '#8d6b9f', influence: 20, tension: 35, attitude: -16 }
  };

  const GU_SEEDS = {
    moonlight: { name: '月光蛊', rank: 1, kind: 'mortal', food: 'moonPetal', power: 12 },
    wineWorm: { name: '酒虫', rank: 1, kind: 'mortal', food: 'wine', power: 8 },
    springAutumn: { name: '春秋蝉', rank: 6, kind: 'immortal', food: 'unknown', power: 99 }
  };

  const NPC_SEEDS = {
    fangyuan: {
      name: '古月方源', role: '重生者', faction: 'guYue', location: 'bambooForest',
      personality: { ambition: 98, caution: 88, loyalty: 12, greed: 78, curiosity: 72 },
      cultivation: { rank: 1, stage: 0, aptitude: 0.45 },
      schedule: { morning: 'academy', afternoon: 'bambooForest', evening: 'village', night: 'village' },
      goals: ['secureResources', 'hideKnowledge', 'findRelic']
    },
    fangzheng: {
      name: '古月方正', role: '学堂少年', faction: 'guYue', location: 'academy',
      personality: { ambition: 72, caution: 45, loyalty: 76, greed: 20, curiosity: 52 },
      cultivation: { rank: 1, stage: 0, aptitude: 0.92 },
      schedule: { morning: 'academy', afternoon: 'academy', evening: 'village', night: 'village' },
      goals: ['proveWorth', 'protectBrother']
    },
    mobei: {
      name: '古月漠北', role: '竞争者', faction: 'guYue', location: 'academy',
      personality: { ambition: 76, caution: 40, loyalty: 58, greed: 35, curiosity: 35 },
      cultivation: { rank: 1, stage: 0, aptitude: 0.68 },
      schedule: { morning: 'academy', afternoon: 'bambooForest', evening: 'village', night: 'village' },
      goals: ['winRivalry', 'gainRecognition']
    },
    chicheng: {
      name: '古月赤城', role: '竞争者', faction: 'guYue', location: 'academy',
      personality: { ambition: 68, caution: 38, loyalty: 61, greed: 28, curiosity: 42 },
      cultivation: { rank: 1, stage: 0, aptitude: 0.68 },
      schedule: { morning: 'academy', afternoon: 'village', evening: 'village', night: 'village' },
      goals: ['winRivalry', 'protectClan']
    },
    elder: {
      name: '古月族老', role: '学堂家老', faction: 'guYue', location: 'academy',
      personality: { ambition: 82, caution: 72, loyalty: 88, greed: 44, curiosity: 56 },
      cultivation: { rank: 3, stage: 1, aptitude: 0.75 },
      schedule: { morning: 'academy', afternoon: 'ancestralHall', evening: 'ancestralHall', night: 'village' },
      goals: ['maintainOrder', 'findTalents']
    },
    jiangya: {
      name: '江牙', role: '商队蛊师', faction: 'caravans', location: 'caravanCamp',
      personality: { ambition: 66, caution: 64, loyalty: 34, greed: 74, curiosity: 62 },
      cultivation: { rank: 1, stage: 2, aptitude: 0.55 },
      schedule: { morning: 'caravanCamp', afternoon: 'village', evening: 'caravanCamp', night: 'caravanCamp' },
      goals: ['trade', 'collectRumors']
    },
    guyuebo: {
      name: '古月博', role: '古月族长', faction: 'guYue', location: 'ancestralHall',
      personality: { ambition: 84, caution: 86, loyalty: 94, greed: 28, curiosity: 61 },
      cultivation: { rank: 4, stage: 2, aptitude: 0.82 },
      schedule: { morning: 'ancestralHall', afternoon: 'ancestralHall', evening: 'village', night: 'ancestralHall' },
      goals: ['maintainOrder', 'protectClan', 'prepareAlliance']
    },
    chilian: {
      name: '古月赤练', role: '古月家老', faction: 'guYue', location: 'ancestralHall',
      personality: { ambition: 78, caution: 74, loyalty: 82, greed: 48, curiosity: 44 },
      cultivation: { rank: 4, stage: 1, aptitude: 0.76 },
      schedule: { morning: 'academy', afternoon: 'ancestralHall', evening: 'ancestralHall', night: 'village' },
      goals: ['maintainOrder', 'winRivalry', 'protectClan']
    },
    jiafu: {
      name: '贾富', role: '商队掌柜', faction: 'caravans', location: 'caravanCamp',
      personality: { ambition: 88, caution: 68, loyalty: 22, greed: 92, curiosity: 76 },
      cultivation: { rank: 2, stage: 1, aptitude: 0.58 },
      schedule: { morning: 'caravanCamp', afternoon: 'village', evening: 'caravanCamp', night: 'caravanCamp' },
      goals: ['trade', 'collectRumors', 'auction']
    },
    bainingbing: {
      name: '白凝冰', role: '白家天才', faction: 'bai', location: 'riverbank',
      personality: { ambition: 94, caution: 52, loyalty: 18, greed: 34, curiosity: 66 },
      cultivation: { rank: 3, stage: 2, aptitude: 0.97 },
      schedule: { morning: 'riverbank', afternoon: 'bambooForest', evening: 'riverbank', night: 'riverbank' },
      goals: ['proveWorth', 'winRivalry', 'prepareAlliance']
    }
  };

  const SOURCE_NOTES = {
    opening: { source: 'reference/novel/第1卷：魔性不改/第7章.txt', note: '方源、青茅山、古月山寨与学堂构成青茅山开局的社会空间。' },
    academy: { source: 'reference/novel/第1卷：魔性不改/第6章.txt', note: '空窍、元海、真元与方正构成修行起点和兄弟关系的原文依据。' },
    relic: { source: 'reference/novel/第1卷：魔性不改/第14章.txt', note: '酒虫、竹林、河滩和石缝构成可被行动触发的遗藏线索。' },
    market: { source: 'reference/novel/第1卷：魔性不改/第109章.txt', note: '商队提前进入青茅山，市场活动成为会改变资源和势力关系的区域事件。' },
    auction: { source: 'reference/novel/第1卷：魔性不改/第110章.txt', note: '贾富与拍卖会提供商队掌柜、外来资本和价格博弈的原文依据。' },
    wolf: { source: 'reference/novel/第1卷：魔性不改/第123章.txt', note: '狼潮下的三寨联盟与利益分配，把族群关系升级为区域生存危机。' }
  };

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

  function createEntity(id, seed) {
    const maxHealth = 60 + ((seed.cultivation?.rank || 1) * 18);
    return {
      id,
      identity: { name: seed.name, role: seed.role || '居民', tags: seed.tags || [] },
      position: { location: seed.location },
      faction: seed.faction || null,
      personality: seed.personality || {},
      cultivation: seed.cultivation || null,
      schedule: seed.schedule || {},
      goals: { active: seed.goals?.[0] || 'idle', queue: seed.goals || [] },
      needs: { energy: 100, hunger: 0, safety: 80 },
      body: { maxHealth, health: maxHealth, wounds: [], limbs: { head: 100, torso: 100, leftArm: 100, rightArm: 100, leftLeg: 100, rightLeg: 100 } },
      abilities: { gu: [], skills: [] },
      inventory: {},
      memory: { facts: {}, episodes: [] },
      alive: true
    };
  }

  function createZone(locationId, location) {
    const resources = { water: 0, moonPetal: 0, food: 0, relicFragment: 0 };
    if (location.tags.includes('water')) resources.water = 8;
    if (location.tags.includes('resource')) { resources.moonPetal = 10; resources.food = 4; }
    if (location.tags.includes('relic')) resources.relicFragment = 3;
    if (location.tags.includes('market')) { resources.water = 5; resources.food = 5; }
    return { id: locationId, danger: location.tags.includes('wild') ? 22 : 4, resources, population: 0, activity: 0, discoveries: [], visits: 0, weather: '雨' };
  }

  function weightedPopulation(state, table) {
    const total = table.reduce((sum, row) => sum + row.weight, 0);
    let needle = random(state) * total;
    for (const row of table) { needle -= row.weight; if (needle <= 0) return row; }
    return table[table.length - 1];
  }

  function seedPopulation(state) {
    for (const [locationId, location] of Object.entries(LOCATIONS)) {
      const zone = state.zones[locationId];
      const table = POPULATION_TABLES[location.population] || [];
      const count = location.type === 'wilderness' || location.type === 'ruin' ? 1 : 2;
      for (let i = 0; i < count && table.length; i++) {
        const row = weightedPopulation(state, table);
        const id = `ambient-${locationId}-${i + 1}`;
        const name = `${row.role}·${String.fromCharCode('甲'.charCodeAt(0) + i)}`;
        state.entities[id] = createEntity(id, {
          name, role: row.role, faction: row.faction, location: locationId,
          personality: { ambition: 20 + Math.floor(random(state) * 60), caution: 20 + Math.floor(random(state) * 70), loyalty: 20 + Math.floor(random(state) * 70), greed: 10 + Math.floor(random(state) * 70), curiosity: 10 + Math.floor(random(state) * 70) },
          cultivation: { rank: 1, stage: 0, aptitude: 0.35 + random(state) * 0.35 },
          goals: row.goals,
          schedule: { morning: locationId, afternoon: locationId, evening: locationId, night: locationId }
        });
        zone.population += 1;
      }
    }
  }

  function newWorld(options = {}) {
    const seed = String(options.seed ?? '青茅山');
    const aptitudeName = APTITUDE[options.aptitude] ? options.aptitude : '丙等';
    const state = {
      schema: SCHEMA_VERSION,
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
      flags: { openingRiteResolved: false, moonlightRumor: false, relicDiscovered: false, marketArrived: false, auctionHeld: false, allianceCouncil: false, wolfTide: false },
      events: { active: null, pending: [], history: [], sequence: 0 },
      combat: null,
      director: { pressure: 0, lastTick: 0, thread: [], beat: 'opening' },
      log: [],
      version: 1
    };
    for (const [id, faction] of Object.entries(FACTION_SEEDS)) state.factions[id] = { id, ...copy(faction), relations: {} };
    state.entities.player = createEntity('player', {
      name: String(options.name || '古月族人').slice(0, 20), role: '玩家', faction: 'guYue', location: 'academy',
      cultivation: { rank: 1, stage: 0, aptitude: APTITUDE[aptitudeName], aptitudeName, progress: 0, essence: 32, essenceMax: 50, vitality: 100, insight: 8 },
      schedule: {}, goals: ['survive', 'grow']
    });
    state.entities.player.inventory = { water: 5, moonPetal: 6, wine: 1, stones: 8 };
    state.entities.player.body.health = state.entities.player.body.maxHealth;
    state.entities.player.needs = { energy: 92, hunger: 8, safety: 70 };
    for (const [id, seedData] of Object.entries(NPC_SEEDS)) state.entities[id] = createEntity(id, seedData);
    for (const [id, location] of Object.entries(LOCATIONS)) state.zones[id] = createZone(id, location);
    seedPopulation(state);
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
    const d = state.director;
    if (state.events.active || state.clock - d.lastTick < 6) return;
    const p = state.entities.player;
    const candidate = Engine.findDirectorEvent(state);
    if (candidate) {
      state.events.active = candidate;
      state.director.lastTick = state.clock;
      state.director.thread.push(candidate.id);
      Engine.emit(state, 'director.event_available', { eventId: candidate.id, location: p.position.location, pressure: d.pressure });
      log(state, 'director_event', candidate.title, { eventId: candidate.id });
    }
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
    const event = state.events.active;
    if (!event) throw new Error('当前没有待处理事件');
    const valid = event.choices.some(item => item.id === choice);
    if (!valid) throw new Error('无效的事件选择');
    state.events.active = null;
    const handled = Engine.runEvent(event.id, { state, event, choice });
    if (handled === false) throw new Error(`没有注册的事件处理器：${event.id}`);
    if (event.id === 'openingRite') return handled;
    advance(state, 1, event.id);
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
  }

  function normalize(state) {
    const p = state.entities.player;
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

  function npcGoal(state, npc) {
    const rel = relation(state, npc.id, 'player');
    if (rel.fear > 30) return 'avoidPlayer';
    if (npc.needs.hunger > 70) return 'findFood';
    if (npc.personality.ambition > 75 && state.director.pressure > 3) return 'gainRecognition';
    return npc.goals.queue[(day(state) + npc.id.length) % npc.goals.queue.length] || 'idle';
  }

  function simulateNpcHour(state) {
    const currentPhase = phase(state);
    for (const npc of Engine.queryWith(state, 'identity', 'position', 'needs', 'goals', 'schedule')) {
      if (npc.id === 'player' || !npc.alive) continue;
      npc.needs.energy = clamp(npc.needs.energy - 0.8, 0, 100);
      npc.needs.hunger = clamp(npc.needs.hunger + 0.6, 0, 100);
      if (hour(state) % 4 !== 0) continue;
      const target = npc.schedule[currentPhase] || npc.position.location;
      const goal = npcGoal(state, npc);
      npc.goals.active = goal;
      if (target !== npc.position.location && LOCATIONS[npc.position.location].neighbors.includes(target)) {
        const previous = npc.position.location;
        npc.position.location = target;
        Engine.emit(state, 'npc.moved', { npcId: npc.id, from: previous, to: target, goal });
        log(state, 'npc_move', `${npc.identity.name} 从${LOCATIONS[previous].name}前往${LOCATIONS[target].name}。`, { npcId: npc.id, goal });
      }
      if (hour(state) % 4 === 0) npcDoGoal(state, npc, goal);
      if (npc.position.location === state.entities.player.position.location && random(state) < 0.12) {
        remember(state, npc.id, 'player', { kind: 'encounter', valence: relValence(state, npc.id), text: `在${LOCATIONS[npc.position.location].name}再次遇见了你。` });
      }
    }
  }

  function npcDoGoal(state, npc, goal) {
    Engine.runGoal(goal, { state, npc, faction: npc.faction && state.factions[npc.faction] });
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
    Engine.emit(state, 'world.day_tick', { day: day(state), pressure: state.director.pressure });
    log(state, 'day_tick', `第${day(state)}日结束，山寨、势力与人物各自推进了一步。`, { pressure: state.director.pressure });
  }

  function advance(state, hours, cause = 'action') {
    const oldDay = day(state);
    for (let i = 0; i < hours; i++) {
      state.clock += 1;
      const p = state.entities.player;
      p.needs.energy -= 0.7;
      p.needs.hunger += 0.55;
      p.cultivation.essence = Math.min(p.cultivation.essenceMax, p.cultivation.essence + 0.35 * p.cultivation.aptitude);
      simulateNpcHour(state);
      if (p.needs.hunger > 85) p.cultivation.progress = Math.max(0, p.cultivation.progress - 0.2);
    }
    if (day(state) !== oldDay) dailyTick(state);
    directorTick(state);
    normalize(state);
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
    if (id === 'wait') { advance(state, Number(command.hours) || 2, 'wait'); log(state, 'action', '你等待了一段时间，观察世界如何自行变化。'); return; }
    if (id === 'travel') {
      const target = command.location;
      if (!LOCATIONS[target] || !LOCATIONS[p.position.location].neighbors.includes(target)) throw new Error('这里无法直接到达该地点');
      const from = p.position.location; p.position.location = target;
      state.zones[target].visits += 1;
      state.zones[target].activity += 2;
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
    const place = [['academy', ['学堂']], ['village', ['山寨']], ['bambooForest', ['竹林']], ['riverbank', ['河滩', '山溪']], ['cliffCave', ['石缝', '遗藏']], ['caravanCamp', ['商队', '营地']]];
    for (const [id, names] of place) if (names.some(name => q.includes(name)) && /去|走|前往|进入|回/.test(q)) return { ok: true, command: { type: 'action', id: 'travel', location: id }, label: `前往${LOCATIONS[id].name}` };
    if (/修炼|温养|打坐/.test(q)) return { ok: true, command: { type: 'action', id: 'cultivate' }, label: '温养空窍' };
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
      activeEvent: copy(state.events.active), zone: copy(state.zones[p.position.location]), eventStream: copy(state.events.pending || []), engine: { components: Engine.COMPONENTS, registries: Engine.registries() }, log: state.log.slice(0, 20).map(copy)
    };
  }

  registerDirectorRules();
  registerEventHandlers();
  registerGoalHandlers();
  registerInteractionHandlers();
  return { SCHEMA_VERSION, LOCATIONS, FACTION_SEEDS, GU_SEEDS, SOURCE_NOTES, ENGINE: Engine, newWorld, dispatch, interpret, validate, snapshot, day, hour, phase };
});
