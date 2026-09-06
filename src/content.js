(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationContent = factory();
})(globalThis, function () {
  'use strict';

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
    demonic: { name: '魔道游修', color: '#8d6b9f', influence: 20, tension: 35, attitude: -16 },
    iron: { name: '铁家与正道巡查', color: '#8f9aa6', influence: 24, tension: 8, attitude: 2 }
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
    },
    tieruonan: {
      name: '铁若男', role: '正道调查者', faction: 'iron', location: 'village', fromDay: 22,
      personality: { ambition: 76, caution: 78, loyalty: 86, greed: 12, curiosity: 92 },
      cultivation: { rank: 2, stage: 2, aptitude: 0.72 },
      schedule: { morning: 'village', afternoon: 'ancestralHall', evening: 'village', night: 'village' },
      goals: ['investigate', 'proveWorth', 'protectFather']
    },
    tiexueleng: {
      name: '铁血冷', role: '神捕', faction: 'iron', location: 'village', fromDay: 22,
      personality: { ambition: 64, caution: 94, loyalty: 78, greed: 8, curiosity: 98 },
      cultivation: { rank: 5, stage: 1, aptitude: 0.84 },
      schedule: { morning: 'village', afternoon: 'ancestralHall', evening: 'village', night: 'village' },
      goals: ['investigate', 'maintainOrder', 'protectDaughter']
    }
  };

  const SOURCE_NOTES = {
    opening: { source: 'reference/novel/第1卷：魔性不改/第7章.txt', note: '方源、青茅山、古月山寨与学堂构成青茅山开局的社会空间。' },
    academy: { source: 'reference/novel/第1卷：魔性不改/第6章.txt', note: '空窍、元海、真元与方正构成修行起点和兄弟关系的原文依据。' },
    relic: { source: 'reference/novel/第1卷：魔性不改/第14章.txt', note: '酒虫、竹林、河滩和石缝构成可被行动触发的遗藏线索。' },
    market: { source: 'reference/novel/第1卷：魔性不改/第109章.txt', note: '商队提前进入青茅山，市场活动成为会改变资源和势力关系的区域事件。' },
    auction: { source: 'reference/novel/第1卷：魔性不改/第110章.txt', note: '贾富与拍卖会提供商队掌柜、外来资本和价格博弈的原文依据。' },
    wolf: { source: 'reference/novel/第1卷：魔性不改/第123章.txt', note: '狼潮下的三寨联盟与利益分配，把族群关系升级为区域生存危机。' },
    tournament: { source: 'reference/novel/第1卷：魔性不改/第180章.txt', note: '狼潮后各族通过三族大比武处理赔偿和资源分配。' },
    investigation: { source: 'reference/novel/第1卷：魔性不改/第182章.txt', note: '铁血冷与铁若男进入青茅山，将案件调查、正道秩序和家族猜疑带入同一场景。' }
  };

  const CONTENT_INDEX = {
    id: 'gu-qingmao-v1',
    title: '蛊真人 · 青茅山模拟内容包',
    volumes: [{ id: 'volume-1', title: '第1卷：魔性不改', arcs: [
      { id: 'opening', chapters: ['第6章.txt', '第7章.txt', '第14章.txt'], sourceKeys: ['opening', 'academy', 'relic'] },
      { id: 'market-and-wolf', chapters: ['第109章.txt', '第110章.txt', '第112章.txt', '第123章.txt'], sourceKeys: ['market', 'auction', 'wolf'] },
      { id: 'after-wolf', chapters: ['第178章.txt', '第180章.txt', '第182章.txt'], sourceKeys: ['tournament', 'investigation'] }
    ] }]
  };

  return { CONTENT_VERSION: 1, CONTENT_INDEX, APTITUDE, LOCATIONS, POPULATION_TABLES, FACTION_SEEDS, GU_SEEDS, NPC_SEEDS, SOURCE_NOTES };
});
