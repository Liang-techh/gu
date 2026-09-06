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
    caravanCamp: { name: '商队营地', type: 'market', neighbors: ['village', 'whiteBoneMountain'], tags: ['market', 'rumor'], population: 'caravan' },
    whiteBoneMountain: { name: '白骨山道', type: 'wilderness', neighbors: ['caravanCamp', 'merchantCity'], tags: ['wild', 'route', 'resource'], population: 'road' },
    merchantCity: { name: '商家城', type: 'metropolis', neighbors: ['whiteBoneMountain', 'threeForkMountain'], tags: ['safe', 'market', 'politics'], population: 'city' },
    threeForkMountain: { name: '三叉山', type: 'wilderness', neighbors: ['merchantCity', 'heavenClimbMountain'], tags: ['wild', 'inheritance', 'danger'], population: 'inheritance' },
    heavenClimbMountain: { name: '天梯山', type: 'sacred', neighbors: ['threeForkMountain', 'northernPlains'], tags: ['sacred', 'inheritance', 'danger'], population: 'heavenClimb' },
    northernPlains: { name: '北原草原', type: 'wilderness', neighbors: ['heavenClimbMountain', 'blackTribeCamp', 'longLifeHeaven', 'reverseFlowRiver'], tags: ['wild', 'route', 'war'], population: 'northernRoad' },
    blackTribeCamp: { name: '黑家大军营地', type: 'military', neighbors: ['northernPlains', 'imperialCourt'], tags: ['war', 'market', 'politics'], population: 'blackCamp' },
    imperialCourt: { name: '王庭福地', type: 'sacred', neighbors: ['blackTribeCamp', 'trueYangTower'], tags: ['sacred', 'safe', 'politics'], population: 'imperialCourt' },
    trueYangTower: { name: '八十八角真阳楼', type: 'ruin', neighbors: ['imperialCourt', 'foxFairyLand'], tags: ['inheritance', 'danger', 'tower'], population: 'trueYangTower' },
    foxFairyLand: { name: '狐仙福地', type: 'blessedLand', neighbors: ['trueYangTower', 'centralContinent', 'shadowSectRuins', 'dreamRealms'], tags: ['blessed', 'resource', 'portal'], population: 'foxFairyLand' },
    centralContinent: { name: '中洲', type: 'continent', neighbors: ['foxFairyLand', 'immortalAuction', 'immortalCraneSect', 'southernBorder', 'westernDesert', 'easternSea', 'heavenlyCourt', 'longLifeHeaven', 'shadowSectRuins', 'divineEmperorCity', 'reverseFlowRiver', 'dreamRealms', 'madDemonCave', 'primordialDesolateWorld'], tags: ['politics', 'sect', 'route'], population: 'centralContinent' },
    immortalAuction: { name: '中洲拍卖会', type: 'market', neighbors: ['centralContinent'], tags: ['market', 'politics', 'immortal'], population: 'immortalAuction' },
    immortalCraneSect: { name: '仙鹤门', type: 'sect', neighbors: ['centralContinent'], tags: ['sect', 'politics', 'safe'], population: 'immortalCraneSect' },
    southernBorder: { name: '南疆', type: 'continent', neighbors: ['centralContinent', 'westernDesert'], tags: ['politics', 'war', 'route'], population: 'southernBorder' },
    westernDesert: { name: '西漠', type: 'continent', neighbors: ['centralContinent', 'southernBorder', 'easternSea', 'loessWorld'], tags: ['desert', 'trade', 'war'], population: 'westernDesert' },
    easternSea: { name: '东海', type: 'continent', neighbors: ['centralContinent', 'westernDesert', 'heavenlyCourt'], tags: ['sea', 'trade', 'immortal'], population: 'easternSea' },
    heavenlyCourt: { name: '天庭', type: 'institution', neighbors: ['centralContinent', 'easternSea', 'divineEmperorCity', 'bookMountain'], tags: ['sect', 'politics', 'war'], population: 'heavenlyCourt' },
    longLifeHeaven: { name: '长生天', type: 'institution', neighbors: ['centralContinent', 'northernPlains'], tags: ['northern', 'politics', 'war'], population: 'longLifeHeaven' },
    shadowSectRuins: { name: '影宗遗址', type: 'ruin', neighbors: ['foxFairyLand', 'centralContinent'], tags: ['shadow', 'ruin', 'secret'], population: 'shadowSectRuins' },
    divineEmperorCity: { name: '神帝城', type: 'city', neighbors: ['centralContinent', 'heavenlyCourt', 'bookMountain'], tags: ['human', 'city', 'war'], population: 'divineEmperorCity' },
    bookMountain: { name: '书山', type: 'sacred', neighbors: ['divineEmperorCity', 'heavenlyCourt', 'primordialDesolateWorld', 'loessWorld', 'madDemonCave'], tags: ['human', 'information', 'sacred'], population: 'bookMountain' },
    primordialDesolateWorld: { name: '蛮荒大世界', type: 'continent', neighbors: ['bookMountain', 'centralContinent', 'dreamRealms'], tags: ['wild', 'war', 'twoHeavens'], population: 'primordialDesolateWorld' },
    loessWorld: { name: '黄土大世界', type: 'continent', neighbors: ['bookMountain', 'westernDesert'], tags: ['desert', 'war', 'twoHeavens'], population: 'loessWorld' },
    reverseFlowRiver: { name: '逆流河', type: 'wilderness', neighbors: ['northernPlains', 'centralContinent'], tags: ['wild', 'relic', 'survival'], population: 'reverseFlowRiver' },
    dreamRealms: { name: '梦境战场', type: 'wilderness', neighbors: ['foxFairyLand', 'centralContinent', 'primordialDesolateWorld', 'madDemonCave'], tags: ['dream', 'danger', 'resource'], population: 'dreamRealms' },
    madDemonCave: { name: '疯魔窟', type: 'ruin', neighbors: ['centralContinent', 'bookMountain', 'dreamRealms'], tags: ['ruin', 'secret', 'danger'], population: 'madDemonCave' }
  };

  const POPULATION_TABLES = {
    academy: [{ role: '学堂学徒', faction: 'guYue', goals: ['study', 'proveWorth'], weight: 5 }, { role: '旁听者', faction: 'guYue', goals: ['observe', 'socialize'], weight: 2 }],
    village: [{ role: '古月族人', faction: 'guYue', goals: ['work', 'socialize'], weight: 7 }, { role: '猎户', faction: 'guYue', goals: ['hunt', 'trade'], weight: 3 }],
    hall: [{ role: '祠堂执事', faction: 'guYue', goals: ['maintainOrder', 'collectRumors'], weight: 3 }],
    forest: [{ role: '山兽', faction: null, goals: ['forage', 'avoidPlayer'], weight: 5 }, { role: '采药人', faction: 'guYue', goals: ['secureResources', 'returnHome'], weight: 2 }],
    river: [{ role: '山兽', faction: null, goals: ['drink', 'forage'], weight: 4 }, { role: '采集者', faction: 'guYue', goals: ['secureResources', 'returnHome'], weight: 2 }],
    ruin: [{ role: '遗藏窥探者', faction: 'demonic', goals: ['findRelic', 'avoidPlayer'], weight: 2 }],
    caravan: [{ role: '商旅', faction: 'caravans', goals: ['trade', 'collectRumors'], weight: 5 }, { role: '护卫', faction: 'caravans', goals: ['guard', 'patrol'], weight: 3 }],
    road: [{ role: '赶路蛊师', faction: 'caravans', goals: ['travel', 'secureResources'], weight: 4 }, { role: '山匪', faction: 'demonic', goals: ['ambush', 'avoidPlayer'], weight: 1 }],
    city: [{ role: '商家城居民', faction: 'shang', goals: ['trade', 'collectRumors'], weight: 6 }, { role: '演武场蛊师', faction: 'shang', goals: ['winRivalry', 'gainRecognition'], weight: 4 }],
    inheritance: [{ role: '传承探索者', faction: null, goals: ['findRelic', 'survive'], weight: 6 }, { role: '正道小组', faction: 'shang', goals: ['patrol', 'secureResources'], weight: 3 }],
    heavenClimb: [{ role: '传承争夺者', faction: 'iron', goals: ['findRelic', 'avoidPlayer'], weight: 4 }, { role: '门派弟子', faction: 'shang', goals: ['proveWorth', 'patrol'], weight: 3 }],
    northernRoad: [{ role: '北原侦察蛊师', faction: 'northernTribes', goals: ['patrol', 'collectRumors'], weight: 5 }, { role: '野外狼骑', faction: 'northernTribes', goals: ['hunt', 'avoidPlayer'], weight: 3 }],
    blackCamp: [{ role: '黑家军士', faction: 'black', goals: ['patrol', 'protectClan'], weight: 5 }, { role: '中小部族族长', faction: 'northernTribes', goals: ['trade', 'protectClan'], weight: 2 }],
    imperialCourt: [{ role: '王庭侍从', faction: 'black', goals: ['maintainOrder', 'collectRumors'], weight: 5 }, { role: '部族使者', faction: 'northernTribes', goals: ['trade', 'prepareAlliance'], weight: 3 }],
    trueYangTower: [{ role: '真阳楼闯关者', faction: 'northernTribes', goals: ['findRelic', 'proveWorth'], weight: 5 }, { role: '楼外谋士', faction: 'demonic', goals: ['collectRumors', 'avoidPlayer'], weight: 2 }],
    foxFairyLand: [{ role: '福地凡人', faction: 'centralSects', goals: ['maintainOrder', 'secureResources'], weight: 4 }, { role: '荒兽', faction: null, goals: ['forage', 'avoidPlayer'], weight: 4 }],
    centralContinent: [{ role: '中洲蛊师', faction: 'centralSects', goals: ['collectRumors', 'proveWorth'], weight: 5 }, { role: '宗门使者', faction: 'spiritAffinity', goals: ['prepareAlliance', 'trade'], weight: 3 }],
    immortalAuction: [{ role: '拍卖会来客', faction: 'auctionImmortals', goals: ['trade', 'collectRumors'], weight: 6 }, { role: '拍卖会护卫', faction: 'centralSects', goals: ['maintainOrder', 'patrol'], weight: 3 }],
    immortalCraneSect: [{ role: '仙鹤门弟子', faction: 'immortalCrane', goals: ['study', 'proveWorth'], weight: 6 }, { role: '飞鹤驭兽师', faction: 'immortalCrane', goals: ['patrol', 'protectClan'], weight: 3 }],
    southernBorder: [{ role: '南疆家族蛊师', faction: 'southernSuperClans', goals: ['prepareWar', 'maintainOrder'], weight: 5 }, { role: '武家使者', faction: 'southernSuperClans', goals: ['mediate', 'protectClan'], weight: 3 }],
    westernDesert: [{ role: '西漠商旅', faction: 'westernDesertFang', goals: ['trade', 'collectRumors'], weight: 5 }, { role: '房家蛊师', faction: 'westernDesertFang', goals: ['protectClan', 'prepareWar'], weight: 3 }],
    easternSea: [{ role: '东海散修', faction: 'easternSeaImmortals', goals: ['trade', 'collectRumors'], weight: 5 }, { role: '海上巡游蛊师', faction: 'easternSeaImmortals', goals: ['patrol', 'travel'], weight: 3 }],
    heavenlyCourt: [{ role: '天庭蛊仙', faction: 'heavenlyCourt', goals: ['maintainOrder', 'prepareWar'], weight: 5 }, { role: '天庭使者', faction: 'heavenlyCourt', goals: ['proveWorth', 'collectRumors'], weight: 2 }],
    longLifeHeaven: [{ role: '长生天使者', faction: 'longLifeHeaven', goals: ['prepareWar', 'collectRumors'], weight: 4 }, { role: '北原部族使者', faction: 'northernTribes', goals: ['protectClan', 'mediate'], weight: 3 }],
    shadowSectRuins: [{ role: '影宗余党', faction: 'shadowSect', goals: ['rebuildShadow', 'collectRumors'], weight: 4 }, { role: '遗址窥探者', faction: 'demonic', goals: ['findRelic', 'avoidPlayer'], weight: 2 }],
    divineEmperorCity: [{ role: '神帝城守卫', faction: 'heavenlyCourt', goals: ['maintainOrder', 'patrol'], weight: 5 }, { role: '人道蛊师', faction: 'humanPathAlliance', goals: ['protectClan', 'collectRumors'], weight: 3 }],
    bookMountain: [{ role: '书山记录者', faction: 'humanPathAlliance', goals: ['collectRumors', 'study'], weight: 5 }, { role: '天庭推算者', faction: 'heavenlyCourt', goals: ['observe', 'prepareWar'], weight: 3 }],
    primordialDesolateWorld: [{ role: '蛮荒世界荒兽', faction: 'twoHeavensForces', goals: ['survive', 'hunt'], weight: 5 }, { role: '前线蛊仙', faction: 'heavenlyCourt', goals: ['prepareWar', 'patrol'], weight: 2 }],
    loessWorld: [{ role: '黄土世界蛊仙', faction: 'twoHeavensForces', goals: ['survive', 'collectRumors'], weight: 4 }, { role: '西漠援军', faction: 'westernDesertFang', goals: ['protectClan', 'prepareWar'], weight: 3 }],
    reverseFlowRiver: [{ role: '逆流河求生者', faction: 'demonic', goals: ['survive', 'avoidPlayer'], weight: 4 }, { role: '追河蛊仙', faction: 'centralSects', goals: ['findRelic', 'observe'], weight: 2 }],
    dreamRealms: [{ role: '梦境探索者', faction: 'dreamPathForces', goals: ['study', 'survive'], weight: 4 }, { role: '梦境守卫', faction: 'centralSects', goals: ['patrol', 'observe'], weight: 3 }],
    madDemonCave: [{ role: '疯魔窟探索者', faction: 'wujiLegacy', goals: ['findRelic', 'survive'], weight: 4 }, { role: '乐土道场来客', faction: 'humanPathAlliance', goals: ['observe', 'mediate'], weight: 2 }]
  };

  const FACTION_SEEDS = {
    guYue: { name: '古月一族', color: '#d6b26b', influence: 68, tension: 18, attitude: 0 },
    bai: { name: '白家寨', color: '#9bb7d3', influence: 42, tension: 24, attitude: -8 },
    xiong: { name: '熊家寨', color: '#b98668', influence: 38, tension: 22, attitude: -6 },
    caravans: { name: '商队与散修', color: '#a6b77c', influence: 32, tension: 12, attitude: 4 },
    demonic: { name: '魔道游修', color: '#8d6b9f', influence: 20, tension: 35, attitude: -16 },
    iron: { name: '铁家与正道巡查', color: '#8f9aa6', influence: 24, tension: 8, attitude: 2 },
    shang: { name: '商家城', color: '#d4a85a', influence: 72, tension: 16, attitude: 8 },
    black: { name: '黑家盟军', color: '#4b5668', influence: 74, tension: 46, attitude: 0 },
    northernTribes: { name: '北原诸部族', color: '#a8794d', influence: 58, tension: 52, attitude: -4 },
    dongfang: { name: '东方盟军', color: '#8b6d9e', influence: 55, tension: 48, attitude: -8 },
    giantSun: { name: '巨阳遗产与真阳楼', color: '#d6a735', influence: 90, tension: 30, attitude: 0 },
    centralSects: { name: '中洲十大古派', color: '#718bb4', influence: 82, tension: 34, attitude: -2 },
    immortalCrane: { name: '仙鹤门', color: '#e8e2d2', influence: 62, tension: 26, attitude: 2 },
    spiritAffinity: { name: '灵缘斋', color: '#c989ad', influence: 66, tension: 28, attitude: 4 },
    auctionImmortals: { name: '中洲散修与拍卖会来客', color: '#9c8a6d', influence: 54, tension: 38, attitude: 0 },
    shadowSect: { name: '影宗余脉', color: '#534b70', influence: 18, tension: 68, attitude: -12 },
    southernSuperClans: { name: '南疆超级家族', color: '#9f614e', influence: 64, tension: 46, attitude: -2 },
    westernDesertFang: { name: '西漠房家', color: '#c18d4e', influence: 61, tension: 42, attitude: 1 },
    easternSeaImmortals: { name: '东海诸仙与超级势力', color: '#5e9fa4', influence: 59, tension: 39, attitude: 3 },
    heavenlyCourt: { name: '天庭', color: '#d7c88e', influence: 92, tension: 44, attitude: -4 },
    longLifeHeaven: { name: '长生天', color: '#b77b58', influence: 86, tension: 58, attitude: -6 },
    humanPathAlliance: { name: '人道联盟', color: '#d4b16b', influence: 70, tension: 48, attitude: 2 },
    twoHeavensForces: { name: '两天异族势力', color: '#6d789c', influence: 64, tension: 74, attitude: -12 },
    dreamPathForces: { name: '梦道势力', color: '#8b70b3', influence: 46, tension: 55, attitude: -2 },
    wujiLegacy: { name: '无极遗产', color: '#65736c', influence: 58, tension: 78, attitude: -10 }
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
    shangxinci: {
      name: '商心慈', role: '商家少主', faction: 'shang', location: 'merchantCity', fromDay: 30,
      personality: { ambition: 58, caution: 64, loyalty: 88, greed: 18, curiosity: 76 },
      cultivation: { rank: 2, stage: 0, aptitude: 0.42 },
      schedule: { morning: 'merchantCity', afternoon: 'merchantCity', evening: 'merchantCity', night: 'merchantCity' },
      goals: ['recruit', 'maintainOrder', 'trade']
    },
    weiyang: {
      name: '魏央', role: '商家外姓家老', faction: 'shang', location: 'merchantCity', fromDay: 30,
      personality: { ambition: 72, caution: 82, loyalty: 76, greed: 26, curiosity: 68 },
      cultivation: { rank: 4, stage: 1, aptitude: 0.78 },
      schedule: { morning: 'merchantCity', afternoon: 'merchantCity', evening: 'merchantCity', night: 'merchantCity' },
      goals: ['train', 'protectClan', 'maintainOrder']
    },
    shangyanfei: {
      name: '商燕飞', role: '商家族长', faction: 'shang', location: 'merchantCity', fromDay: 34,
      personality: { ambition: 86, caution: 88, loyalty: 82, greed: 38, curiosity: 62 },
      cultivation: { rank: 5, stage: 2, aptitude: 0.86 },
      schedule: { morning: 'merchantCity', afternoon: 'merchantCity', evening: 'merchantCity', night: 'merchantCity' },
      goals: ['maintainOrder', 'prepareAlliance', 'collectRumors']
    },
    tiexueleng: {
      name: '铁血冷', role: '神捕', faction: 'iron', location: 'village', fromDay: 22,
      personality: { ambition: 64, caution: 94, loyalty: 78, greed: 8, curiosity: 98 },
      cultivation: { rank: 5, stage: 1, aptitude: 0.84 },
      schedule: { morning: 'village', afternoon: 'ancestralHall', evening: 'village', night: 'village' },
      goals: ['investigate', 'maintainOrder', 'protectDaughter']
    },
    heiloulan: {
      name: '黑楼兰', role: '黑家盟主', faction: 'black', location: 'blackTribeCamp', fromDay: 58,
      personality: { ambition: 98, caution: 58, loyalty: 82, greed: 44, curiosity: 56 },
      cultivation: { rank: 5, stage: 2, aptitude: 0.9 },
      schedule: { morning: 'blackTribeCamp', afternoon: 'blackTribeCamp', evening: 'blackTribeCamp', night: 'blackTribeCamp' },
      goals: ['prepareWar', 'gainRecognition', 'maintainOrder']
    },
    taibaiyunsheng: {
      name: '太白云生', role: '治疗蛊师', faction: 'black', location: 'blackTribeCamp', fromDay: 58,
      personality: { ambition: 42, caution: 72, loyalty: 84, greed: 10, curiosity: 78 },
      cultivation: { rank: 5, stage: 1, aptitude: 0.78 },
      schedule: { morning: 'blackTribeCamp', afternoon: 'blackTribeCamp', evening: 'blackTribeCamp', night: 'blackTribeCamp' },
      goals: ['healWounded', 'mediate', 'protectClan']
    },
    dongfangyuliang: {
      name: '东方余亮', role: '东方盟主', faction: 'dongfang', location: 'northernPlains', fromDay: 62,
      personality: { ambition: 91, caution: 88, loyalty: 66, greed: 52, curiosity: 94 },
      cultivation: { rank: 5, stage: 2, aptitude: 0.86 },
      schedule: { morning: 'northernPlains', afternoon: 'northernPlains', evening: 'northernPlains', night: 'northernPlains' },
      goals: ['prepareWar', 'collectRumors', 'ambush']
    },
    mayingjie: {
      name: '马英杰', role: '马家少族长', faction: 'northernTribes', location: 'northernPlains', fromDay: 66,
      personality: { ambition: 86, caution: 68, loyalty: 72, greed: 48, curiosity: 74 },
      cultivation: { rank: 4, stage: 1, aptitude: 0.76 },
      schedule: { morning: 'northernPlains', afternoon: 'blackTribeCamp', evening: 'northernPlains', night: 'northernPlains' },
      goals: ['gainRecognition', 'prepareAlliance', 'trade']
    },
    tianhe: {
      name: '天鹤上人', role: '仙鹤门长老', faction: 'immortalCrane', location: 'immortalCraneSect', fromDay: 92,
      personality: { ambition: 68, caution: 74, loyalty: 86, greed: 12, curiosity: 82 },
      cultivation: { rank: 6, stage: 2, aptitude: 0.88 },
      schedule: { morning: 'immortalCraneSect', afternoon: 'immortalCraneSect', evening: 'centralContinent', night: 'immortalCraneSect' },
      goals: ['protectClan', 'train', 'collectRumors']
    },
    qinbaisheng: {
      name: '秦百胜', role: '拍卖会组织者', faction: 'auctionImmortals', location: 'immortalAuction', fromDay: 100,
      personality: { ambition: 84, caution: 76, loyalty: 42, greed: 72, curiosity: 92 },
      cultivation: { rank: 6, stage: 1, aptitude: 0.8 },
      schedule: { morning: 'immortalAuction', afternoon: 'immortalAuction', evening: 'centralContinent', night: 'immortalAuction' },
      goals: ['trade', 'collectRumors', 'maintainOrder']
    },
    yingwuxie: {
      name: '影无邪', role: '影宗余党', faction: 'shadowSect', location: 'shadowSectRuins', fromDay: 125,
      personality: { ambition: 86, caution: 92, loyalty: 82, greed: 44, curiosity: 88 },
      cultivation: { rank: 6, stage: 1, aptitude: 0.86 },
      schedule: { morning: 'shadowSectRuins', afternoon: 'shadowSectRuins', evening: 'centralContinent', night: 'shadowSectRuins' },
      goals: ['rebuildShadow', 'collectRumors', 'avoidPlayer']
    },
    wuyong: {
      name: '武庸', role: '武家家主', faction: 'southernSuperClans', location: 'southernBorder', fromDay: 150,
      personality: { ambition: 92, caution: 86, loyalty: 88, greed: 36, curiosity: 64 },
      cultivation: { rank: 7, stage: 1, aptitude: 0.9 },
      schedule: { morning: 'southernBorder', afternoon: 'southernBorder', evening: 'centralContinent', night: 'southernBorder' },
      goals: ['prepareWar', 'maintainOrder', 'mediate']
    },
    fangdichang: {
      name: '房睇长', role: '房家智道蛊师', faction: 'westernDesertFang', location: 'westernDesert', fromDay: 160,
      personality: { ambition: 84, caution: 91, loyalty: 86, greed: 38, curiosity: 95 },
      cultivation: { rank: 7, stage: 1, aptitude: 0.88 },
      schedule: { morning: 'westernDesert', afternoon: 'westernDesert', evening: 'centralContinent', night: 'westernDesert' },
      goals: ['protectClan', 'trade', 'prepareWar']
    },
    longgong: {
      name: '龙公', role: '天庭宿老', faction: 'heavenlyCourt', location: 'heavenlyCourt', fromDay: 180,
      personality: { ambition: 88, caution: 94, loyalty: 96, greed: 12, curiosity: 78 },
      cultivation: { rank: 8, stage: 2, aptitude: 0.98 },
      schedule: { morning: 'heavenlyCourt', afternoon: 'heavenlyCourt', evening: 'centralContinent', night: 'heavenlyCourt' },
      goals: ['prepareWar', 'maintainOrder', 'proveWorth']
    },
    ziweixianzi: {
      name: '紫薇仙子', role: '天庭智道蛊仙', faction: 'heavenlyCourt', location: 'heavenlyCourt', fromDay: 175,
      personality: { ambition: 86, caution: 96, loyalty: 92, greed: 16, curiosity: 98 },
      cultivation: { rank: 7, stage: 2, aptitude: 0.94 },
      schedule: { morning: 'heavenlyCourt', afternoon: 'centralContinent', evening: 'heavenlyCourt', night: 'heavenlyCourt' },
      goals: ['collectRumors', 'prepareWar', 'maintainOrder']
    },
    qindingling: {
      name: '秦鼎菱', role: '天庭战部蛊仙', faction: 'heavenlyCourt', location: 'divineEmperorCity', fromDay: 200,
      personality: { ambition: 84, caution: 82, loyalty: 94, greed: 18, curiosity: 76 },
      cultivation: { rank: 7, stage: 2, aptitude: 0.93 },
      schedule: { morning: 'divineEmperorCity', afternoon: 'heavenlyCourt', evening: 'divineEmperorCity', night: 'divineEmperorCity' },
      goals: ['maintainOrder', 'prepareWar', 'collectRumors']
    },
    luweiyin: {
      name: '陆畏因', role: '人道传承者', faction: 'humanPathAlliance', location: 'madDemonCave', fromDay: 215,
      personality: { ambition: 70, caution: 90, loyalty: 86, greed: 10, curiosity: 98 },
      cultivation: { rank: 7, stage: 1, aptitude: 0.9 },
      schedule: { morning: 'madDemonCave', afternoon: 'bookMountain', evening: 'madDemonCave', night: 'madDemonCave' },
      goals: ['mediate', 'observe', 'protectClan']
    },
    fengya: {
      name: '丰雅仙子', role: '才情蛊仙', faction: 'heavenlyCourt', location: 'bookMountain', fromDay: 225,
      personality: { ambition: 78, caution: 88, loyalty: 82, greed: 8, curiosity: 99 },
      cultivation: { rank: 7, stage: 2, aptitude: 0.95 },
      schedule: { morning: 'bookMountain', afternoon: 'bookMountain', evening: 'heavenlyCourt', night: 'bookMountain' },
      goals: ['study', 'prepareWar', 'observe']
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
    investigation: { source: 'reference/novel/第1卷：魔性不改/第182章.txt', note: '铁血冷与铁若男进入青茅山，将案件调查、正道秩序和家族猜疑带入同一场景。' },
    whiteBone: { source: 'reference/novel/第2卷：魔子出山/第10章.txt', note: '白骨山是青茅山之后的旅途节点，路途、资源和风险从山寨秩序中脱离出来。' },
    merchantCity: { source: 'reference/novel/第2卷：魔子出山/第102章.txt', note: '商家城以演武场、城规、贵宾身份和家族权力构成新的城市型社会模拟空间。' },
    threeKings: { source: 'reference/novel/第2卷：魔子出山/第124章.txt', note: '三叉山的三王传承把正魔两道、资源争夺和周期性开放机制连接起来。' },
    heavenClimb: { source: 'reference/novel/第2卷：魔子出山/第136章.txt', note: '天梯山与狐仙福地传承将门派竞争和更高层级的区域事件引入世界。' },
    northernWar: { source: 'reference/novel/第3卷：魔头乱世/第101章.txt', note: '北原黑盟大军、部族军帐和战争后勤把势力竞争扩展为持续战争区域。' },
    imperialCourt: { source: 'reference/novel/第3卷：魔头乱世/第149章.txt', note: '王庭福地与八十八角真阳楼将历史遗产、血脉资格和周期性探索变成区域规则。' },
    tribeCrisis: { source: 'reference/novel/第3卷：魔头乱世/第200章.txt', note: '中小部族在真阳楼攻略中的伤亡与求援，提供战争压力、休养和资源交换的模拟依据。' },
    towerFormation: { source: 'reference/novel/第3卷：魔头乱世/第149章.txt', note: '真阳楼由风雪与王庭福地条件共同成形，塔楼探索应受世界状态影响而非固定开门。' },
    foxReturn: { source: 'reference/novel/第4卷：魔君纵横/第1章.txt', note: '北原旅途结束后回归狐仙福地，福地成为经营、休整和继续谋划的持久基地。' },
    sectPressure: { source: 'reference/novel/第4卷：魔君纵横/第50章.txt', note: '仙鹤门与方正的师徒关系把宗门任务、个人情感和福地攻防连接起来。' },
    immortalAuction: { source: 'reference/novel/第4卷：魔君纵横/第100章.txt', note: '中洲拍卖大会汇聚散修、超级势力和仙蛊资源，适合构造成价格、关系和情报共同变化的市场系统。' },
    identityPursuit: { source: 'reference/novel/第4卷：魔君纵横/第119章.txt', note: '拍卖后交易线索、卖家身份与追杀互相串联，适合构造成面具、溯源和追查压力共同推进的导演事件。' }
    ,shadowRebuild: { source: 'reference/novel/第5卷：魔王雄霸/第1章.txt', note: '影无邪、影宗余脉、长生天与中洲局势，为重建势力和秘密网络提供原文锚点。' },
    southernFront: { source: 'reference/novel/第5卷：魔王雄霸/第300章.txt', note: '南疆、武家、武遗海与乔家关系把超级家族、外交和边境战争连接起来。' },
    westernDesert: { source: 'reference/novel/第5卷：魔王雄霸/第500章.txt', note: '西漠房家以蛊屋闻名，智道传承和豆神宫构成沙漠势力的结构性玩法。' },
    heavenlyCourt: { source: 'reference/novel/第5卷：魔王雄霸/第700章.txt', note: '天庭、龙公与元莲真传展示了中洲最高层级势力如何把传承与战争合并。' },
    fiveRegionsWar: { source: 'reference/novel/第5卷：魔王雄霸/第900章.txt', note: '中洲炼蛊大会、五域和方源的撤退，把区域事件升级为跨地图战争与情报博弈。' },
    divineEmperor: { source: 'reference/novel/第6卷：魔尊永生/第110章.txt', note: '神帝城作为天庭底牌和人道仙蛊屋，提供城市防御、情报与战争调度的原文依据。' },
    madDemonCave: { source: 'reference/novel/第6卷：魔尊永生/第120章.txt', note: '疯魔窟、元境和无极魔尊的布置把探索从区域资源提升到天地奥秘与终局风险。' },
    twoHeavens: { source: 'reference/novel/第6卷：魔尊永生/第200章.txt', note: '书山、蛮荒大世界、天庭与无极遗产构成两天战场和信息战的模拟锚点。' },
    starHost: { source: 'reference/novel/第6卷：魔尊永生/第300章.txt', note: '两天混淆、天庭天脉节点和星宿安排让世界进入跨层级灾变结算。' },
    reverseFlow: { source: 'reference/novel/第6卷：魔尊永生/第231章.txt', note: '逆流河与方源的求生线适合构造成持续危险、追逐和资源消耗系统。' }
  };

  const CONTENT_INDEX = {
    id: 'gu-eternal-war-v6',
    title: '蛊真人 · 五域与两天终局 simulation-first 内容包',
    volumes: [{ id: 'volume-1', title: '第1卷：魔性不改', arcs: [
      { id: 'opening', chapters: ['第6章.txt', '第7章.txt', '第14章.txt'], sourceKeys: ['opening', 'academy', 'relic'] },
      { id: 'market-and-wolf', chapters: ['第109章.txt', '第110章.txt', '第112章.txt', '第123章.txt'], sourceKeys: ['market', 'auction', 'wolf'] },
      { id: 'after-wolf', chapters: ['第178章.txt', '第180章.txt', '第182章.txt'], sourceKeys: ['tournament', 'investigation'] }
    ] },
    { id: 'volume-2', title: '第2卷：魔子出山', arcs: [
      { id: 'journey-to-city', chapters: ['第10章.txt', '第102章.txt'], sourceKeys: ['whiteBone', 'merchantCity'] },
      { id: 'inheritance-frontier', chapters: ['第124章.txt', '第136章.txt'], sourceKeys: ['threeKings', 'heavenClimb'] }
    ] },
    { id: 'volume-3', title: '第3卷：魔头乱世', arcs: [
      { id: 'northern-war', chapters: ['第101章.txt', '第109章.txt', '第124章.txt'], sourceKeys: ['northernWar', 'tribeCrisis'] },
      { id: 'imperial-court', chapters: ['第149章.txt', '第200章.txt', '第243章.txt'], sourceKeys: ['imperialCourt', 'towerFormation'] }
    ] },
    { id: 'volume-4', title: '第4卷：魔君纵横', arcs: [
      { id: 'return-to-blessed-land', chapters: ['第1章.txt', '第10章.txt'], sourceKeys: ['foxReturn', 'sectPressure'] },
      { id: 'immortal-auction', chapters: ['第100章.txt', '第200章.txt'], sourceKeys: ['immortalAuction'] }
    ] },
    { id: 'volume-5', title: '第5卷：魔王雄霸', arcs: [
      { id: 'shadow-rebuild', chapters: ['第1章.txt', '第50章.txt'], sourceKeys: ['shadowRebuild'] },
      { id: 'southern-front', chapters: ['第200章.txt', '第300章.txt'], sourceKeys: ['southernFront'] },
      { id: 'western-desert', chapters: ['第500章.txt'], sourceKeys: ['westernDesert'] },
      { id: 'heavenly-court', chapters: ['第700章.txt'], sourceKeys: ['heavenlyCourt'] },
      { id: 'five-regions-war', chapters: ['第900章.txt'], sourceKeys: ['fiveRegionsWar'] }
    ] },
    { id: 'volume-6', title: '第6卷：魔尊永生', arcs: [
      { id: 'divine-emperor', chapters: ['第100章.txt', '第110章.txt'], sourceKeys: ['divineEmperor'] },
      { id: 'mad-demon-cave', chapters: ['第120章.txt', '第125章.txt'], sourceKeys: ['madDemonCave'] },
      { id: 'two-heavens', chapters: ['第190章.txt', '第200章.txt'], sourceKeys: ['twoHeavens'] },
      { id: 'star-host', chapters: ['第276章.txt', '第300章.txt'], sourceKeys: ['starHost'] },
      { id: 'reverse-flow', chapters: ['第226章.txt', '第231章.txt'], sourceKeys: ['reverseFlow'] }
    ] }
  ]
  };

  const CONTRACT_DEFS = [
    { id: 'fangzheng-support', title: '帮助方正证明自己', giver: 'fangzheng', availableFromDay: 2, locations: ['academy'], objective: { type: 'helpTalk', target: 'fangzheng' }, reward: { insight: 3, trust: { target: 'fangzheng', amount: 5 } } },
    { id: 'iron-case-lead', title: '铁家案件的线索', giver: 'tieruonan', availableFromDay: 22, flags: ['investigationArrived'], locations: ['village', 'ancestralHall'], objective: { type: 'investigationLeverage' }, reward: { insight: 6, faction: { id: 'iron', attitude: 5 } } },
    { id: 'merchant-arena-streak', title: '演武场的三连胜', giver: 'shangxinci', availableFromDay: 32, flags: ['merchantCityOpened', 'arenaTrial'], locations: ['merchantCity'], objective: { type: 'arenaWins', count: 3 }, reward: { stones: 4, reputation: 5, trust: { target: 'shangxinci', amount: 6 } } },
    { id: 'inheritance-scout', title: '三王传承的侦查报告', giver: 'weiyang', availableFromDay: 40, flags: ['threeKingsAwakened'], locations: ['threeForkMountain'], objective: { type: 'inheritanceRound', count: 5 }, reward: { insight: 8, faction: { id: 'shang', attitude: 6 } } }
  ];

  const CONVERSATION_DEFS = [
    { id: 'fangzheng-proof', speaker: 'fangzheng', title: '方正的证明', availableFromDay: 2, locations: ['academy'], choices: [
      { id: 'encourage', label: '鼓励他按自己的方式证明', text: '我不需要你替我赢下所有人的判断，但我会记住你愿意让我自己走一步。', effects: { trust: 8, insight: 1, npcFacts: { encouraged: true }, valence: 3 } },
      { id: 'pressure', label: '提醒他别被家族期待绑住', text: '如果你只按照别人安排的样子成长，下一次考验来临时，你连自己输给了谁都不知道。', effects: { trust: -2, fear: 2, progress: 3, npcFacts: { warned: true }, valence: 0 } }
    ] },
    { id: 'shangxinci-mercy', speaker: 'shangxinci', title: '商心慈的取舍', availableFromDay: 32, flags: ['merchantCityOpened'], locations: ['merchantCity'], minTrust: 3, choices: [
      { id: 'protect', label: '支持她保护弱者', text: '商路不只运送元石，也会运送一个人还愿意相信别人的理由。', effects: { trust: 8, faction: { id: 'shang', attitude: 2, tension: -1 }, playerFacts: { shangMercy: true }, valence: 4 } },
      { id: 'profit', label: '劝她先把利益做大', text: '善意若没有力量护住，很快就会变成别人账本上的一行成本。', effects: { trust: 2, faction: { id: 'shang', attitude: 3 }, insight: 3, playerFacts: { shangProfit: true }, valence: 1 } }
    ] },
    { id: 'taibaiyunsheng-relief', speaker: 'taibaiyunsheng', title: '战争与休养', availableFromDay: 62, flags: ['northernFrontierOpened'], locations: ['blackTribeCamp'], choices: [
      { id: 'relief', label: '支持中小部族休养', text: '如果每一次胜利都把部族的后代耗尽，那便不是活下来的战争。', effects: { trust: 7, faction: { id: 'northernTribes', attitude: 4, tension: -2 }, playerFacts: { reliefAdvocate: true }, valence: 4 } },
      { id: 'campaign', label: '承认黑盟必须继续推进', text: '停下来也许能救下一批人，但敌人不会因为我们的仁慈而停止计算。', effects: { trust: 2, faction: { id: 'black', attitude: 3 }, progress: 4, playerFacts: { campaignRealist: true }, valence: 1 } }
    ] },
    { id: 'heiloulan-kingdom', speaker: 'heiloulan', title: '王庭资格', availableFromDay: 62, flags: ['blackCampaign'], locations: ['blackTribeCamp'], minTrust: 0, choices: [
      { id: 'pledge', label: '承诺为军帐争取资格', text: '王庭不是奖赏，它是让胜者继续支配资源的资格。你准备好承担它的代价了吗？', effects: { trust: 6, faction: { id: 'black', attitude: 4 }, playerFacts: { blackPledge: true }, valence: 3 } },
      { id: 'question', label: '追问战争的代价', text: '你问得很直接。也许只有记得代价的人，才不会把王庭当成一张空白的王座。', effects: { trust: 1, insight: 5, npcFacts: { questionedCost: true }, valence: 2 } }
    ] }
  ];

  return { CONTENT_VERSION: 6, CONTENT_INDEX, CONTRACT_DEFS, CONVERSATION_DEFS, APTITUDE, LOCATIONS, POPULATION_TABLES, FACTION_SEEDS, GU_SEEDS, NPC_SEEDS, SOURCE_NOTES };
});
