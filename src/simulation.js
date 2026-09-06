(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulation = factory();
})(globalThis, function () {
  'use strict';

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
    academy: { name: '古月学堂', type: 'institution', neighbors: ['village', 'ancestralHall'], tags: ['safe', 'learning'] },
    village: { name: '古月山寨', type: 'settlement', neighbors: ['academy', 'bambooForest', 'caravanCamp'], tags: ['safe', 'market'] },
    ancestralHall: { name: '宗族祠堂', type: 'institution', neighbors: ['academy'], tags: ['politics', 'ritual'] },
    bambooForest: { name: '竹林', type: 'wilderness', neighbors: ['village', 'riverbank'], tags: ['wild', 'resource'] },
    riverbank: { name: '山溪河滩', type: 'wilderness', neighbors: ['bambooForest', 'cliffCave'], tags: ['wild', 'water'] },
    cliffCave: { name: '瀑布石缝', type: 'ruin', neighbors: ['riverbank'], tags: ['hidden', 'relic'] },
    caravanCamp: { name: '商队营地', type: 'market', neighbors: ['village'], tags: ['market', 'rumor'] }
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
    }
  };

  const SOURCE_NOTES = {
    opening: { source: 'reference/novel/第1卷：魔性不改/第1章.txt', note: '方源重生于青茅山、开窍大典前夜、方正作为孪生弟弟出现。' },
    academy: { source: 'reference/novel/第1卷：魔性不改/第2章.txt', note: '开窍、资质、元海与家族培养构成青茅山开局冲突。' },
    relic: { source: 'reference/novel/第1卷：魔性不改/第15章.txt', note: '竹林、酒虫与花酒遗藏作为可被行动触发的世界素材。' }
  };

  function relation(state, a, b) {
    const key = keyOf(a, b);
    if (!state.relationships[key]) state.relationships[key] = { trust: 0, fear: 0, debt: 0, affinity: 0, lastSeen: state.clock };
    return state.relationships[key];
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
      inventory: {},
      memory: { facts: {}, episodes: [] },
      alive: true
    };
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
      factions: {},
      relationships: {},
      flags: { openingRiteResolved: false, moonlightRumor: false, relicDiscovered: false },
      events: { active: null, pending: [], history: [] },
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
    state.entities.player.needs = { energy: 92, hunger: 8, safety: 70 };
    for (const [id, seedData] of Object.entries(NPC_SEEDS)) state.entities[id] = createEntity(id, seedData);
    for (const id of Object.keys(state.entities)) remember(state, id, 'world', { kind: 'origin', text: '青茅山的雨季刚刚开始。', facts: { region: '青茅山' } });
    relation(state, 'player', 'fangyuan').fear = 4;
    relation(state, 'player', 'fangzheng').trust = 6;
    relation(state, 'player', 'guYue').trust = 8;
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
    const guYue = state.factions.guYue;
    let candidate = null;
    if (!state.flags.moonlightRumor && day(state) >= 2 && p.position.location === 'bambooForest') {
      candidate = { id: 'moonlightRumor', type: 'rumor', title: '竹林里的酒香', text: '雨停之后，竹叶间传来一缕不属于山泉的酒香。有人先你一步来过。', choices: [
        { id: 'follow', label: '沿着痕迹跟下去', hint: '打开花酒遗藏的调查线。' },
        { id: 'report', label: '把消息交给家老', hint: '获得家族信用，但线索不再只属于你。' },
        { id: 'ignore', label: '记在心里，先做自己的事', hint: '保留秘密，等待更有利的时机。' }
      ], source: SOURCE_NOTES.relic };
    } else if (day(state) >= 3 && guYue.tension >= 32 && p.position.location === 'academy') {
      candidate = { id: 'academyRivalry', type: 'social', title: '学堂里的较量', text: '漠北和赤城在草人前争夺一次演示机会，方正被推到了两人之间。', choices: [
        { id: 'mediate', label: '替方正把争执压下去', hint: '方正会记住你的帮助。' },
        { id: 'join', label: '加入竞争，证明自己的月刃', hint: '提高个人名望，也增加敌意。' },
        { id: 'watch', label: '旁观并记下每个人的弱点', hint: '获得知识，关系保持不变。' }
      ], source: SOURCE_NOTES.academy };
    } else if (day(state) >= 6 && state.director.pressure >= 5) {
      candidate = { id: 'caravanRumor', type: 'market', title: '商队带来的北方消息', text: '江牙带着一批新货进入山寨。白家寨和熊家寨的边界冲突，已经影响了货价。', choices: [
        { id: 'trade', label: '用元石换取资源和消息', hint: '扩大行动半径。' },
        { id: 'listen', label: '只听消息，不暴露立场', hint: '获得势力情报。' },
        { id: 'scheme', label: '让商队替你散布一个传闻', hint: '改变 NPC 记忆和势力压力。' }
      ] };
    }
    if (candidate) {
      state.events.active = candidate;
      state.director.lastTick = state.clock;
      state.director.thread.push(candidate.id);
      log(state, 'director_event', candidate.title, { eventId: candidate.id });
    }
  }

  function applyOpening(state, choice) {
    const p = state.entities.player;
    state.flags.openingRiteResolved = true;
    state.events.active = null;
    if (choice === 'reveal') {
      relation(state, 'player', 'guYue').trust += 12;
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
    if (event.id === 'openingRite') return applyOpening(state, choice);
    state.events.active = null;
    const p = state.entities.player;
    if (event.id === 'moonlightRumor') {
      state.flags.moonlightRumor = true;
      if (choice === 'follow') { p.memory.facts.world.relicLead = true; state.director.pressure += 2; }
      if (choice === 'report') { relation(state, 'player', 'guYue').trust += 8; p.memory.facts.world.relicLead = 'shared'; }
      if (choice === 'ignore') { p.cultivation.insight += 2; p.memory.facts.world.relicLead = 'withheld'; }
      log(state, 'choice', `你处理了“竹林里的酒香”：${event.choices.find(c => c.id === choice).label}。`);
    } else if (event.id === 'academyRivalry') {
      if (choice === 'mediate') { relation(state, 'player', 'fangzheng').trust += 12; state.director.pressure -= 1; }
      if (choice === 'join') { relation(state, 'player', 'mobei').fear += 8; relation(state, 'player', 'chicheng').fear += 8; p.cultivation.progress += 8; }
      if (choice === 'watch') { p.cultivation.insight += 5; remember(state, 'player', 'mobei', { kind: 'secret', valence: 2, text: '漠北在公开竞争时会先看家老的脸色。' }); }
      log(state, 'choice', `你处理了学堂较量：${event.choices.find(c => c.id === choice).label}。`);
    } else if (event.id === 'caravanRumor') {
      if (choice === 'trade') { p.inventory.water += 2; p.inventory.moonPetal += 2; p.inventory.stones = Math.max(0, p.inventory.stones - 2); relation(state, 'player', 'caravans').trust += 6; }
      if (choice === 'listen') { p.cultivation.insight += 7; remember(state, 'player', 'world', { kind: 'rumor', valence: 1, text: '白家寨和熊家寨的边界冲突正在推高货价。' }); }
      if (choice === 'scheme') { state.factions.caravans.tension += 8; state.factions.bai.tension += 3; state.factions.xiong.tension += 3; state.director.pressure += 2; }
      log(state, 'choice', `你处理了商队消息：${event.choices.find(c => c.id === choice).label}。`);
    }
    advance(state, 1, event.id);
  }

  function normalize(state) {
    const p = state.entities.player;
    p.cultivation.rank = clamp(p.cultivation.rank, 1, 9);
    p.cultivation.stage = clamp(p.cultivation.stage, 0, 3);
    p.cultivation.essenceMax = Math.max(20, Math.round(34 + p.cultivation.aptitude * 38 + p.cultivation.stage * 8 + (p.cultivation.rank - 1) * 12));
    p.cultivation.essence = clamp(p.cultivation.essence, 0, p.cultivation.essenceMax);
    p.cultivation.progress = clamp(p.cultivation.progress, 0, 100);
    p.cultivation.vitality = clamp(p.cultivation.vitality, 0, 100);
    p.needs.energy = clamp(p.needs.energy, 0, 100);
    p.needs.hunger = clamp(p.needs.hunger, 0, 100);
    for (const faction of Object.values(state.factions)) {
      faction.influence = clamp(faction.influence, 0, 100);
      faction.tension = clamp(faction.tension, 0, 100);
      faction.attitude = clamp(faction.attitude, -100, 100);
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
    for (const npc of Object.values(state.entities)) {
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
        log(state, 'npc_move', `${npc.identity.name} 从${LOCATIONS[previous].name}前往${LOCATIONS[target].name}。`, { npcId: npc.id, goal });
      }
      if (npc.position.location === state.entities.player.position.location && random(state) < 0.12) {
        remember(state, npc.id, 'player', { kind: 'encounter', valence: relValence(state, npc.id), text: `在${LOCATIONS[npc.position.location].name}再次遇见了你。` });
      }
    }
  }

  function relValence(state, npcId) {
    const rel = relation(state, npcId, 'player');
    return clamp(rel.trust + rel.affinity - rel.fear, -100, 100);
  }

  function dailyTick(state) {
    for (const npc of Object.values(state.entities)) {
      if (npc.id === 'player') continue;
      npc.needs.energy = clamp(npc.needs.energy + 35, 0, 100);
      npc.needs.hunger = clamp(npc.needs.hunger - 25, 0, 100);
      for (const episode of npc.memory.episodes) episode.valence *= 0.985;
    }
    const p = state.entities.player;
    const rel = relation(state, 'player', 'guYue');
    state.factions.guYue.tension += p.cultivation.rank > 1 ? 1 : 0;
    state.factions.bai.tension += state.factions.guYue.tension > 45 ? 1 : 0;
    state.director.pressure = clamp(state.director.pressure + (p.needs.hunger > 65 ? 2 : 0) + (rel.trust < 0 ? 1 : 0), 0, 10);
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

  function action(state, command) {
    const p = requirePlayer(state);
    const id = command.id;
    if (state.events.active) throw new Error('请先处理当前世界事件');
    if (id === 'wait') { advance(state, Number(command.hours) || 2, 'wait'); log(state, 'action', '你等待了一段时间，观察世界如何自行变化。'); return; }
    if (id === 'travel') {
      const target = command.location;
      if (!LOCATIONS[target] || !LOCATIONS[p.position.location].neighbors.includes(target)) throw new Error('这里无法直接到达该地点');
      const from = p.position.location; p.position.location = target;
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
      if (!['bambooForest', 'riverbank', 'cliffCave'].includes(loc)) throw new Error('当前位置没有可安全采集的资源');
      if (loc === 'riverbank') p.inventory.water += 3;
      if (loc === 'bambooForest') { p.inventory.moonPetal += 2; p.inventory.food = (p.inventory.food || 0) + 1; }
      if (loc === 'cliffCave') { p.inventory.relicFragment = (p.inventory.relicFragment || 0) + 1; state.flags.relicDiscovered = true; }
      p.cultivation.insight += random(state) < 0.35 ? 1 : 0;
      log(state, 'action', `你在${LOCATIONS[loc].name}进行采集，资源与线索都发生了变化。`);
      advance(state, 2, 'gather'); return;
    }
    if (id === 'rest') { p.needs.energy += 42; p.needs.hunger += 4; log(state, 'action', '你休息了一晚，人物和势力仍在世界中行动。'); advance(state, 6, 'rest'); return; }
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
      if (mode === 'help') { r.trust += 7 + memoryBoost; r.debt += 1; remember(state, npc.id, 'player', { kind: 'help', valence: 10, text: `${p.identity.name}曾在关键时刻帮助过你。`, facts: { helped: true } }); log(state, 'social', `${npc.identity.name}接受了你的帮助，人情被记在账上。`); }
      else if (mode === 'threaten') { r.fear += 9; r.trust -= 5; state.director.pressure += 1; remember(state, npc.id, 'player', { kind: 'threat', valence: -8, text: `${p.identity.name}让你感到危险。` }); log(state, 'social', `你向${npc.identity.name}施压，短期得到让步，长期留下阴影。`); }
      else if (mode === 'trade') { if ((p.inventory.stones || 0) < 1) throw new Error('元石不足'); p.inventory.stones -= 1; p.inventory.water += 1; r.trust += 2; log(state, 'social', `你与${npc.identity.name}完成了一次小交易。`); }
      else { r.trust += 1 + memoryBoost * 0.2; p.cultivation.insight += 1; remember(state, npc.id, 'player', { kind: 'conversation', valence: 2, text: `你和${p.identity.name}谈过一次。` }); log(state, 'social', `你与${npc.identity.name}交谈，双方更新了对彼此的判断。`); }
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
    if (!state || state.schema !== SCHEMA_VERSION || !state.entities?.player || !state.factions || !state.events) throw new Error('无效的 simulation-first 存档');
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
      nearby: Object.values(state.entities).filter(e => e.id !== 'player' && e.alive && e.position.location === p.position.location).map(e => ({ id: e.id, name: e.identity.name, role: e.identity.role, goal: e.goals.active, relationship: copy(relation(state, 'player', e.id)), memory: e.memory.episodes[0] || null })),
      factions: Object.values(state.factions).map(f => ({ id: f.id, name: f.name, influence: f.influence, tension: f.tension, attitude: f.attitude })),
      activeEvent: copy(state.events.active), log: state.log.slice(0, 20).map(copy)
    };
  }

  return { SCHEMA_VERSION, LOCATIONS, FACTION_SEEDS, GU_SEEDS, SOURCE_NOTES, newWorld, dispatch, interpret, validate, snapshot, day, hour, phase };
});
