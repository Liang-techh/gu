(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuDirectorRules = factory();
})(globalThis, function () {
  'use strict';

  // 内容包只声明“何时出现什么世界局势”；导演内核负责评分、冷却、选择和推进。
  function createRuntime({ engine, day, sourceNotes }) {
    const choices = (items) => items.map(item => ({ ...item }));
    const register = rule => engine.registerDirectorRule({
      id: rule.id,
      priority: rule.priority,
      score: rule.score,
      cooldownHours: rule.cooldownHours,
      when: rule.when,
      build: () => ({
        id: rule.id,
        type: rule.type,
        title: rule.title,
        text: rule.text,
        source: rule.source,
        choices: choices(rule.choices)
      })
    });

    function registerRules() {
      const rules = [
        { id: 'moonlightRumor', priority: 10, type: 'rumor', title: '竹林里的酒香', text: '雨停之后，竹叶间传来一缕不属于山泉的酒香。有人先你一步来过。', source: sourceNotes.relic, when: state => !state.flags.moonlightRumor && day(state) >= 2 && state.entities.player.position.location === 'bambooForest', choices: [
          { id: 'follow', label: '沿着痕迹跟下去', hint: '打开花酒遗藏的调查线。' }, { id: 'report', label: '把消息交给家老', hint: '获得家族信用，但线索不再只属于你。' }, { id: 'ignore', label: '记在心里，先做自己的事', hint: '保留秘密，等待更有利的时机。' }
        ] },
        { id: 'academyRivalry', priority: 20, type: 'social', title: '学堂里的较量', text: '漠北和赤城在草人前争夺一次演示机会，方正被推到了两人之间。', source: sourceNotes.academy, when: state => day(state) >= 3 && state.factions.guYue.tension >= 32 && state.entities.player.position.location === 'academy', choices: [
          { id: 'mediate', label: '替方正把争执压下去', hint: '方正会记住你的帮助。' }, { id: 'join', label: '加入竞争，证明自己的月刃', hint: '提高个人名望，也增加敌意。' }, { id: 'watch', label: '旁观并记下每个人的弱点', hint: '获得知识，关系保持不变。' }
        ] },
        { id: 'marketArrival', priority: 30, type: 'market', title: '商队提前进入青茅山', text: '商队的旗帜穿过雨幕，贾富和江牙把外界的货物、消息与价格一起带进山寨。', source: sourceNotes.market, when: state => !state.flags.marketArrived && day(state) >= 5 && ['village', 'caravanCamp'].includes(state.entities.player.position.location), choices: [
          { id: 'trade', label: '用元石换取资源', hint: '得到水、花瓣和商路信用。' }, { id: 'listen', label: '只听消息不表态', hint: '获得白家、熊家和北方商路的情报。' }, { id: 'scheme', label: '让商队替你散布传闻', hint: '增加市场活动，也会提高势力紧张度。' }
        ] },
        { id: 'auction', priority: 35, type: 'market', title: '贾富的拍卖会', text: '贾富把一批外来蛊材摆上台面。价格只是表面，真正的较量是山寨成员是否愿意为稀缺资源彼此抬价。', source: sourceNotes.auction, when: state => state.flags.marketArrived && !state.flags.auctionHeld && day(state) >= 7 && ['village', 'caravanCamp'].includes(state.entities.player.position.location), choices: [
          { id: 'buy', label: '出价购买蛊材', hint: '消耗元石，换取稀缺资源和商队信用。' }, { id: 'sell', label: '出售手中资源', hint: '把当前资源压力转化为元石。' }, { id: 'observe', label: '观察竞价与人群', hint: '获得对贾富和山寨势力的情报。' }
        ] },
        { id: 'marketDisaster', priority: 45, type: 'crisis', title: '灾害重写商路', text: '一场突如其来的灾害切断了部分商路。卖家急于求生，买家急于囤积，价格、人口和势力关系同时开始偏离原来的轨道。', source: sourceNotes.marketDisaster, when: state => state.flags.marketArrived && !state.marketShock.active && !state.marketShock.resolved && day(state) >= 10 && (state.factions.bai.tension >= 35 || state.factions.xiong.tension >= 35 || state.market.supply.food < 14) && ['village', 'caravanCamp', 'whiteBoneMountain'].includes(state.entities.player.position.location), choices: [
          { id: 'prepare', label: '拿资源准备救济', hint: '降低灾害冲击，消耗元石或食物，提升势力合法性。' }, { id: 'exploit', label: '趁价格崩坏套利', hint: '获得短期收益，但留下交易痕迹和势力怀疑。' }, { id: 'warn', label: '把灾情交给势力处理', hint: '减少个人收益，换取商队与山寨的共同响应。' }
        ] },
        { id: 'allianceCouncil', priority: 40, type: 'politics', title: '三寨联盟的利益分配', text: '狼群的阴影还在远方，古月、白家与熊家却已经开始争论：若要结盟，谁来出人，谁来让利，谁来承担最危险的防线？', source: sourceNotes.wolf, when: state => !state.flags.allianceCouncil && day(state) >= 8 && (state.factions.guYue.tension >= 35 || state.director.pressure >= 5) && ['village', 'ancestralHall'].includes(state.entities.player.position.location), choices: [
          { id: 'aid', label: '推动共同防线', hint: '改善三族关系，消耗古月的资源影响。' }, { id: 'hoard', label: '优先保住古月山寨', hint: '提高本族防御，却让联盟更难谈成。' }, { id: 'spy', label: '记录各族的底牌', hint: '获得情报和个人洞察，留下政治记忆。' }
        ] },
        { id: 'wolfTide', priority: 50, type: 'crisis', title: '狼潮正在逼近', text: '山林里的猎物突然减少，远处传来群狼试探性的嚎叫。狼潮还没有攻入山寨，但资源、巡逻和每个家族的判断已经开始改变。', source: sourceNotes.wolf, when: state => !state.flags.wolfTide && day(state) >= 12 && ['village', 'bambooForest', 'riverbank'].includes(state.entities.player.position.location) && (state.director.pressure >= 4 || state.factions.guYue.tension >= 42), choices: [
          { id: 'mobilize', label: '加入巡逻与布防', hint: '降低当前区域危险，提升古月影响。' }, { id: 'hunt', label: '趁混乱深入山林', hint: '获得资源和线索，但承担更高伤害风险。' }, { id: 'secure', label: '囤积资源等待变化', hint: '提高个人储备，让野外区域更危险。' }
        ] },
        { id: 'threeClanTournament', priority: 60, type: 'competition', title: '三族大比武的筹备', text: '狼潮后的赔偿和资源分配无法靠口舌解决。古月、白家与熊家决定以三族大比武定下新的秩序，年轻蛊师被推到所有人的目光下。', source: sourceNotes.tournament, when: state => state.flags.wolfTide && !state.flags.tournamentAnnounced && day(state) >= 18 && ['village', 'academy'].includes(state.entities.player.position.location), choices: [
          { id: 'enter', label: '报名参加比武', hint: '获得个人名望，但会把身体和关系都推入公开竞争。' }, { id: 'sponsor', label: '支持本族参赛者', hint: '提升古月影响，减少直接受伤风险。' }, { id: 'observe', label: '观察各族底牌', hint: '获得情报，记住谁在狼潮后真正保存了实力。' }
        ] },
        { id: 'ironInvestigation', priority: 70, type: 'investigation', title: '铁家父女进入青茅山', text: '铁血冷与铁若男带着一桩未完的案件进入山寨。正道的秩序、家族的猜疑和个人记忆开始争夺同一个真相。', source: sourceNotes.investigation, when: state => state.flags.tournamentAnnounced && !state.flags.investigationArrived && day(state) >= 22 && ['village', 'ancestralHall'].includes(state.entities.player.position.location), choices: [
          { id: 'cooperate', label: '主动提供线索', hint: '换取调查者信任，但你的行动会被纳入他们的案卷。' }, { id: 'evade', label: '隐藏自己的痕迹', hint: '保留行动自由，却让正道巡查提高警惕。' }, { id: 'bargain', label: '用情报交换条件', hint: '把真相变成一笔政治交易。' }
        ] },
        { id: 'merchantCityArrival', priority: 80, type: 'journey', title: '商家城的大门', text: '离开青茅山的熟人秩序后，城门、演武场、商铺和少主派系组成了另一种生存规则。你可以把商家城当作庇护，也可以把它当作更大的猎场。', source: sourceNotes.merchantCity, when: state => !state.flags.merchantCityOpened && day(state) >= 30 && ['whiteBoneMountain', 'merchantCity'].includes(state.entities.player.position.location), choices: [
          { id: 'enter', label: '进入商家城', hint: '开启城市交易、演武和外姓蛊师系统。' }, { id: 'survey', label: '先在城外观察', hint: '获得城市势力情报，延缓与商家绑定。' }, { id: 'avoid', label: '继续向三叉山赶路', hint: '错过城市资源，但更早接近三王传承。' }
        ] },
        { id: 'merchantArena', priority: 90, type: 'social', title: '商家城演武场', text: '演武场把蛊师的修为、蛊虫和名声公开标价。每一场胜负都会改变你在商家城的关系网络。', source: sourceNotes.merchantCity, when: state => state.flags.merchantCityOpened && !state.flags.arenaTrial && day(state) >= 32 && state.entities.player.position.location === 'merchantCity', choices: [
          { id: 'fight', label: '接受演武挑战', hint: '提升名望和商家影响，但会积累伤势。' }, { id: 'recruit', label: '观察并结交强者', hint: '打开商心慈、魏央和外姓蛊师的关系线。' }, { id: 'trade', label: '用资源换取情报', hint: '牺牲一部分储备，获得三叉山传承的消息。' }
        ] },
        { id: 'threeKingsInheritance', priority: 100, type: 'inheritance', title: '三王传承开启', text: '三叉山的三道光柱重新贯入云霄。正道、魔道和商家城的队伍同时进入山中，传承不是静态宝箱，而是会周期性开放、提高难度并改变争夺者关系的区域规则。', source: sourceNotes.threeKings, when: state => state.flags.arenaTrial && !state.flags.threeKingsAwakened && day(state) >= 40 && state.entities.player.position.location === 'threeForkMountain', choices: [
          { id: 'enter', label: '进入传承关卡', hint: '消耗精力和资源，获取传承进度。' }, { id: 'scout', label: '先侦查其他队伍', hint: '获得敌对队伍记忆，降低第一次进入的风险。' }, { id: 'ambush', label: '埋伏离开传承的蛊师', hint: '可能获得蛊虫，但会迅速恶化正魔关系。' }
        ] },
        { id: 'heavenClimbTransmission', priority: 110, type: 'sect', title: '天梯山的狐仙传承', text: '远方门派的消息传到山中：天梯山出现了狐仙福地传承，各大门派不愿让蛊仙亲自下场，于是把争夺交给门下弟子。', source: sourceNotes.heavenClimb, when: state => state.flags.threeKingsAwakened && !state.flags.heavenClimbRumor && day(state) >= 46 && state.entities.player.position.location === 'heavenClimbMountain', choices: [
          { id: 'follow', label: '追踪门派队伍', hint: '打开更高层级的门派竞争。' }, { id: 'sell', label: '把消息卖给商家城', hint: '获得资源与商家关系，但会让传承竞争者增加。' }, { id: 'ignore', label: '留在三叉山积累实力', hint: '暂时避开门派冲突，保留行动自由。' }
        ] },
        { id: 'northernWarArrival', priority: 120, type: 'war', title: '北原战报与远方军帐', text: '天梯山传承的消息尚未冷却，北原草原的战报已经沿商路传来：黑家盟军、东方盟军和各部族正在争夺进入王庭福地的资格。战争的补给、侦察和伤亡会先于英雄叙事改变这片土地。', source: sourceNotes.northernWar, when: state => state.flags.heavenClimbRumor && !state.flags.northernFrontierOpened && day(state) >= 55 && ['heavenClimbMountain', 'northernPlains'].includes(state.entities.player.position.location), choices: [
          { id: 'enter', label: '沿商路北上', hint: '开启北原草原、军营和部族战争系统。' }, { id: 'observe', label: '先收集战报', hint: '获得北原情报，但战争压力会继续累积。' }, { id: 'avoid', label: '暂不卷入北原', hint: '保留南疆行动自由，错过早期军帐关系。' }
        ] },
        { id: 'blackCampaign', priority: 130, type: 'war', title: '黑盟军帐的选择', text: '黑楼兰的军帐把部族、后勤、侦察和个人野心压在同一张战图上。东方盟军并未撤退，中小部族却已经开始计算自己还能承受多少伤亡。', source: sourceNotes.northernWar, when: state => state.flags.northernFrontierOpened && !state.flags.blackCampaign && day(state) >= 62 && ['northernPlains', 'blackTribeCamp'].includes(state.entities.player.position.location), choices: [
          { id: 'mobilize', label: '加入黑盟后勤', hint: '提升黑家影响，消耗资源并增加战争暴露。' }, { id: 'mediate', label: '为中小部族求情', hint: '降低部分战争压力，但会触怒强硬派。' }, { id: 'scout', label: '侦察东方军势', hint: '获得情报，增加与东方盟军的敌意。' }
        ] },
        { id: 'imperialCourtOpening', priority: 140, type: 'politics', title: '王庭福地的门槛', text: '战争把各族推向王庭福地。有人要求休养，有人要求继续攻伐；王庭的资格不只是奖励，也是一种把部族伤亡继续转成资源的制度。', source: sourceNotes.tribeCrisis, when: state => state.flags.blackCampaign && !state.flags.imperialCourtOpened && day(state) >= 72 && ['blackTribeCamp', 'imperialCourt'].includes(state.entities.player.position.location), choices: [
          { id: 'support', label: '支持继续攻伐', hint: '获得强势盟军信任，但中小部族的怨恨会增加。' }, { id: 'relief', label: '推动部族休养', hint: '降低战争压力，牺牲一部分黑盟影响。' }, { id: 'broker', label: '交换自己的情报', hint: '把战报和传承资格变成个人筹码。' }
        ] },
        { id: 'trueYangTowerFormation', priority: 150, type: 'inheritance', title: '八十八角真阳楼显化', text: '风雪与王庭福地的力量共同让八十八角真阳楼逐层显化。塔楼不是静态副本：外界天气、血脉资格、战争后勤和闯关者的选择都会改变它的开放状态。', source: sourceNotes.towerFormation, when: state => state.flags.imperialCourtOpened && !state.flags.trueYangTowerFormed && day(state) >= 78 && state.entities.player.position.location === 'trueYangTower', choices: [
          { id: 'enter', label: '寻找进入真阳楼的资格', hint: '开启塔楼闯关，但会暴露你的行动轨迹。' }, { id: 'assist', label: '帮助部族稳定后勤', hint: '提升北原势力关系，延缓个人探索。' }, { id: 'watch', label: '观察楼层显化规律', hint: '获得塔楼情报，等待更安全的窗口。' }
        ] },
        { id: 'foxFairyLandReturn', priority: 160, type: 'base', title: '回归狐仙福地', text: '北原的风雪暂时留在身后。狐仙福地重新成为你的基地：魂魄需要休整，资源需要经营，外部势力却已经开始沿着传承和智慧的线索追来。', source: sourceNotes.foxReturn, when: state => state.flags.trueYangTowerFormed && !state.flags.foxFairyLandOpened && day(state) >= 90 && state.entities.player.position.location === 'foxFairyLand', choices: [
          { id: 'recover', label: '先休整并经营福地', hint: '恢复行动资源，降低短期压力。' }, { id: 'prepare', label: '立即准备防御', hint: '提高福地防御与宗门警戒，但消耗资源。' }, { id: 'hide', label: '隐藏回归消息', hint: '减少外界注意，延缓中洲势力介入。' }
        ] },
        { id: 'centralContinentArrival', priority: 170, type: 'sect', title: '中洲宗门的视线', text: '中洲的道路不只连接地点，也连接宗门的情报网。仙鹤门、灵缘斋和其他古派开始根据你的北原经历重新估价。', source: sourceNotes.sectPressure, when: state => state.flags.foxFairyLandOpened && !state.flags.centralContinentOpened && day(state) >= 96 && state.entities.player.position.location === 'centralContinent', choices: [
          { id: 'sect', label: '接触宗门使者', hint: '获得宗门关系，但暴露更多个人信息。' }, { id: 'trade', label: '只交换资源与情报', hint: '保持中立，打开市场网络。' }, { id: 'avoid', label: '避开宗门视线', hint: '降低短期风险，但失去合法援助。' }
        ] },
        { id: 'immortalAuction', priority: 180, type: 'market', title: '中洲仙蛊拍卖大会', text: '拍卖会把仙蛊、蛊方、情报和各大势力的关系网放在同一个大厅里。价格不是唯一成本，出价本身也会告诉别人你正在寻找什么。', source: sourceNotes.immortalAuction, when: state => state.flags.centralContinentOpened && !state.flags.immortalAuctionOpened && day(state) >= 105 && state.entities.player.position.location === 'immortalAuction', choices: [
          { id: 'bid', label: '参加竞拍', hint: '消耗元石与关系，获得稀缺资源的机会。' }, { id: 'observe', label: '观察各方需求', hint: '获得价格和势力情报，保留资源。' }, { id: 'rumor', label: '出售北原情报', hint: '获得资金，但会让更多人追踪你的过去。' }
        ] },
        { id: 'identityPursuit', priority: 185, type: 'investigation', title: '交易痕迹引来的追查', text: '你在拍卖会留下的价格、借贷和情报记录开始互相对上。有人还不知道你的真名，却已经知道该去哪里等你。面具可以遮住脸，不能自动抹掉因果。', source: sourceNotes.identityPursuit, cooldownHours: 48, when: state => state.central.tracePressure >= 25 && state.entities.player.knowledge.activeMask !== 'trueName' && state.clock - (state.facts.identityPursuitLastClock || -999) >= 48, choices: [
          { id: 'erase', label: '花费元石抹除交易痕迹', hint: '降低追踪压力，消耗资源并损失部分市场信誉。' }, { id: 'misdirect', label: '伪造另一条线索', hint: '把追查导向竞争对手，但会降低情报可信度。' }, { id: 'confront', label: '带着面具反向设伏', hint: '把追查者变成诱饵，显著提高导演压力与敌意。' }
        ] },
        { id: 'sectPressure', priority: 190, type: 'siege', title: '宗门对狐仙福地的压力', text: '拍卖会之后，宗门不再满足于旁观。方正的师徒关系、狐仙福地的资源和你的北原行踪被卷进同一场攻防，福地的安全不再是默认前提。', source: sourceNotes.sectPressure, when: state => state.flags.immortalAuctionOpened && !state.flags.sectPressureActive && day(state) >= 115 && state.entities.player.position.location === 'foxFairyLand', choices: [
          { id: 'defend', label: '启动福地防御', hint: '消耗资源，降低入侵风险。' }, { id: 'negotiate', label: '与仙鹤门谈判', hint: '把方正和宗门关系转化为缓冲。' }, { id: 'ambush', label: '诱敌深入再反击', hint: '提高收益和风险，留下长期敌意。' }
        ] },
        { id: 'shadowSectRebuild', priority: 200, type: 'shadow', title: '影宗残脉重新结网', text: '宗门压力让中洲的暗线浮出水面。影宗余脉没有真正消失，影无邪正在废墟、福地与各方情报之间重建一张不愿被任何势力看见的网络。', source: sourceNotes.shadowRebuild, when: state => state.flags.sectPressureActive && !state.flags.shadowSectRebuilt && day(state) >= 125 && ['foxFairyLand', 'centralContinent', 'shadowSectRuins'].includes(state.entities.player.position.location), choices: [
          { id: 'rebuild', label: '利用影宗暗线', hint: '获得秘密与情报，但会把你卷入更深的因果。' }, { id: 'ally', label: '尝试与影宗合作', hint: '提高影宗影响，牺牲部分中洲正道信任。' }, { id: 'hide', label: '隐藏自己并观察', hint: '保留行动自由，延后公开站队。' }
        ] },
        { id: 'shadowNetworkExposure', priority: 205, type: 'investigation', title: '影宗暗线出现暴露窗口', text: '一条暗线的补给、一次情报交换和中洲宗门的调查记录逐渐对上。影宗网络尚未崩溃，但它已经从“别人不知道存在”变成“有人知道应该去哪里找”。', source: sourceNotes.shadowRebuild, cooldownHours: 72, when: state => state.shadowNetwork?.active && state.shadowNetwork.exposure >= 60 && !state.events.active && state.clock - (state.facts.shadowExposureLastClock || -999) >= 72 && Object.values(state.shadowNetwork.nodes || {}).some(node => node.active && node.location === state.entities.player.position.location), choices: [
          { id: 'conceal', label: '替暗线抹去痕迹', hint: '消耗元石和网络资源，降低暴露度。' }, { id: 'exploit', label: '利用暴露窗口换利', hint: '获得资源与情报，但会把追查压力推向更高处。' }, { id: 'report', label: '把暗线卖给中洲', hint: '获得短期政治收益，牺牲影宗的凝聚力。' }, { id: 'ignore', label: '暂时不处理', hint: '保留行动时间，但暴露度会继续累积。' }
        ] },
        { id: 'fiveRegionsWar', priority: 210, type: 'war', title: '五域格局开始转动', text: '中洲炼蛊大会的表面秩序遮不住五域之间的重新布局。北原旧盟、南疆家族、西漠商路、东海散仙和天庭的情报同时进入同一张战争地图。', source: sourceNotes.fiveRegionsWar, when: state => state.flags.shadowSectRebuilt && !state.flags.fiveRegionsWarOpened && day(state) >= 140 && state.entities.player.position.location === 'centralContinent', choices: [
          { id: 'central', label: '站在中洲观察全局', hint: '获得跨区域情报，提升天庭与中洲的关注。' }, { id: 'regions', label: '把消息送往各域', hint: '扩大行动空间，但让战争热度更快上升。' }, { id: 'observe', label: '隐藏身份继续观察', hint: '保持中立，等待各方先暴露底牌。' }
        ] },
        { id: 'southernFront', priority: 220, type: 'war', title: '南疆超级家族的边线', text: '南疆的山路把家族利益、边境安全和个人名声绑在一起。武家正在重新估价盟友，也在判断哪些敌意必须立刻变成兵力。', source: sourceNotes.southernFront, when: state => state.flags.fiveRegionsWarOpened && !state.flags.southernFrontOpened && day(state) >= 150 && state.entities.player.position.location === 'southernBorder', choices: [
          { id: 'negotiate', label: '参与家族谈判', hint: '降低南疆紧张，换取超级家族的信任。' }, { id: 'mobilize', label: '推动边境动员', hint: '提高战争准备和南疆影响。' }, { id: 'observe', label: '只记录各家底牌', hint: '获得情报，避免过早暴露立场。' }
        ] },
        { id: 'westernFront', priority: 230, type: 'war', title: '西漠房家的蛊屋线', text: '西漠的风沙里，房家的蛊屋、智道传承和豆神宫传闻把贸易与战争变成同一个问题：谁掌握移动的堡垒，谁就能定义边线。', source: sourceNotes.westernDesert, when: state => state.flags.fiveRegionsWarOpened && !state.flags.westernFrontOpened && day(state) >= 160 && state.entities.player.position.location === 'westernDesert', choices: [
          { id: 'trade', label: '以商路交换情报', hint: '获得元石与洞察，保持房家对你的谨慎信任。' }, { id: 'defend', label: '帮助房家守住蛊屋', hint: '提高西漠势力影响，但增加战争暴露。' }, { id: 'raid', label: '夺取蛊屋线索', hint: '获得短期收益，显著推高房家敌意。' }
        ] },
        { id: 'heavenlyCourtCampaign', priority: 240, type: 'sect', title: '天庭的五域战争决策', text: '天庭不再只是中洲的高墙。龙公、紫薇仙子与元莲真传的线索让五域战争进入更高层级：你必须决定是窥探、抵抗，还是让自己的名字暂时消失。', source: sourceNotes.heavenlyCourt, when: state => state.flags.fiveRegionsWarOpened && !state.flags.heavenlyCourtOpened && day(state) >= 180 && state.entities.player.position.location === 'heavenlyCourt', choices: [
          { id: 'infiltrate', label: '窥探天庭决策', hint: '获得高层情报，但会显著提高天庭敌意。' }, { id: 'defend', label: '承认并利用天庭秩序', hint: '降低局部压力，换取天庭的暂时容纳。' }, { id: 'observe', label: '保持距离观察', hint: '获得洞察，不立刻改变阵营关系。' }
        ] },
        { id: 'divineEmperorArrival', priority: 250, type: 'human', title: '神帝城开始调度人道战线', text: '天庭的战争不只靠仙蛊和个人强者。神帝城像一座会移动的国家，把人道、情报、守城和前线调度压缩在同一件仙蛊屋里。', source: sourceNotes.divineEmperor, when: state => state.flags.heavenlyCourtOpened && !state.flags.divineEmperorOpened && day(state) >= 200 && ['centralContinent', 'divineEmperorCity', 'heavenlyCourt'].includes(state.entities.player.position.location), choices: [
          { id: 'enter', label: '进入神帝城观察', hint: '获得人道与城市防御情报，接受天庭关注。' }, { id: 'trade', label: '交换五域战报', hint: '获得元石和洞察，让各方重新评估你。' }, { id: 'avoid', label: '避开人道战线', hint: '保持行动自由，但错过天庭的保护网络。' }
        ] },
        { id: 'twoHeavensConvergence', priority: 260, type: 'cosmic', title: '两天战场开始重叠', text: '书山不断收集两大战场的情报，蛮荒大世界与黄土大世界不再是遥远的异域。天庭、异族和无极遗产把战线推进到世界结构本身。', source: sourceNotes.twoHeavens, when: state => state.flags.divineEmperorOpened && !state.flags.twoHeavensOpened && day(state) >= 220 && ['bookMountain', 'primordialDesolateWorld', 'loessWorld'].includes(state.entities.player.position.location), choices: [
          { id: 'support', label: '支援天庭前线', hint: '提高天庭影响，承受两天战场的直接风险。' }, { id: 'sabotage', label: '破坏两天补给', hint: '提升战争热度，换取异域资源与情报。' }, { id: 'observe', label: '记录两天结构', hint: '获得洞察，暂不站队。' }
        ] },
        { id: 'madDemonCaveOpening', priority: 270, type: 'relic', title: '疯魔窟的元境线索', text: '疯魔窟最底层的传闻把探索从资源争夺推向天地奥秘。元境、无极魔尊和九转衍化仙蛊的线索让每个进入者都必须重新计算风险。', source: sourceNotes.madDemonCave, when: state => state.flags.twoHeavensOpened && !state.flags.madDemonCaveOpened && day(state) >= 235 && state.entities.player.position.location === 'madDemonCave', choices: [
          { id: 'descend', label: '向疯魔窟深处探索', hint: '开启高风险遗产探索，获得终局洞察。' }, { id: 'consult', label: '与人道传承者交换信息', hint: '降低部分危险，建立陆畏因的人情关系。' }, { id: 'seal', label: '封存入口', hint: '降低世界灾变压力，但会错过无极遗产。' }
        ] },
        { id: 'dreamRealmSurge', priority: 280, type: 'dream', title: '梦境战场潮汐', text: '梦境开始与现实边界互相渗透。探索者、守卫和远方势力都在争夺梦道资源，而梦境里留下的选择会反过来改变现实中的关系。', source: sourceNotes.twoHeavens, when: state => state.flags.twoHeavensOpened && !state.flags.dreamSurgeOpened && day(state) >= 245 && state.entities.player.position.location === 'dreamRealms', choices: [
          { id: 'enter', label: '进入梦境深层', hint: '获得洞察与梦道进度，承受精神风险。' }, { id: 'harvest', label: '收集梦道资源', hint: '获得资源，让梦境危险度上升。' }, { id: 'avoid', label: '避开梦境潮汐', hint: '保留安全，错过一次改变世界认知的窗口。' }
        ] },
        { id: 'starHostPlan', priority: 290, type: 'cosmic', title: '星宿安排与天脉节点', text: '两天混淆让天庭的天脉节点承受前所未有的压力。星宿意志留下的安排不再只是历史背景，而会成为所有势力必须回应的世界级计划。', source: sourceNotes.starHost, when: state => state.flags.madDemonCaveOpened && state.flags.dreamSurgeOpened && !state.flags.starHostPlanOpened && day(state) >= 260 && state.entities.player.position.location === 'heavenlyCourt', choices: [
          { id: 'defend', label: '协助稳定天脉节点', hint: '降低宇宙热度，换取天庭的人道资源。' }, { id: 'break', label: '寻找安排中的破绽', hint: '获得终局情报，但让天庭与无极遗产同时关注你。' }, { id: 'wait', label: '等待两天混淆完成', hint: '保留实力，让其他势力先承担灾变。' }
        ] }
      ];
      rules.forEach(register);
      return rules.length;
    }

    return { registerRules };
  }

  return { createRuntime };
});
