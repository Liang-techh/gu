(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuEventRules = factory();
})(globalThis, function () {
  'use strict';

  function createRuntime({ engine, day, sourceNotes, activateSeed, relation, remember, log, affectFaction, advance, clamp, applyOpening, pursuit }) {
    function registerHandlers() {
      engine.registerEvent('openingRite', ({ state, choice }) => applyOpening(state, choice));
      engine.registerEvent('moonlightRumor', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.moonlightRumor = true;
        if (choice === 'follow') { p.memory.facts.world.relicLead = true; state.director.pressure += 2; }
        if (choice === 'report') { relation(state, 'player', 'guYue').trust += 8; p.memory.facts.world.relicLead = 'shared'; }
        if (choice === 'ignore') { p.cultivation.insight += 2; p.memory.facts.world.relicLead = 'withheld'; }
        log(state, 'choice', `你处理了“竹林里的酒香”：${event.choices.find(c => c.id === choice).label}。`);
        return true;
      });
      engine.registerEvent('academyRivalry', ({ state, choice, event }) => {
        const p = state.entities.player;
        if (choice === 'mediate') { relation(state, 'player', 'fangzheng').trust += 12; state.director.pressure -= 1; }
        if (choice === 'join') { relation(state, 'player', 'mobei').fear += 8; relation(state, 'player', 'chicheng').fear += 8; p.cultivation.progress += 8; }
        if (choice === 'watch') { p.cultivation.insight += 5; remember(state, 'player', 'mobei', { kind: 'secret', valence: 2, text: '漠北在公开竞争时会先看家老的脸色。' }); }
        log(state, 'choice', `你处理了学堂较量：${event.choices.find(c => c.id === choice).label}。`);
        return true;
      });
      engine.registerEvent('marketArrival', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.marketArrived = true; state.facts.marketActivity = (state.facts.marketActivity || 0) + 3;
        state.zones.village.resources.food += 2; state.zones.caravanCamp.resources.food += 2;
        if (choice === 'trade') { p.inventory.water += 2; p.inventory.moonPetal += 2; p.inventory.stones = Math.max(0, p.inventory.stones - 2); relation(state, 'player', 'caravans').trust += 6; state.factions.caravans.influence += 3; }
        if (choice === 'listen') { p.cultivation.insight += 7; remember(state, 'player', 'world', { kind: 'rumor', valence: 1, text: '白家寨和熊家寨的边界冲突正在推高货价。', facts: { marketRumor: true } }); }
        if (choice === 'scheme') { state.factions.caravans.tension += 8; state.factions.bai.tension += 3; state.factions.xiong.tension += 3; state.director.pressure += 2; remember(state, 'jiafu', 'player', { kind: 'rumor', valence: -2, text: '这个人会利用商路影响山寨里的判断。' }); }
        log(state, 'choice', `你处理了商队进入：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.market });
        return true;
      });
      engine.registerEvent('auction', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.auctionHeld = true; state.facts.marketActivity = (state.facts.marketActivity || 0) + 2;
        if (choice === 'buy') { if ((p.inventory.stones || 0) < 2) p.cultivation.insight += 2; else { p.inventory.stones -= 2; p.inventory.moonPetal += 3; relation(state, 'player', 'jiafu').trust += 5; } }
        if (choice === 'sell') { p.inventory.stones += Math.min(4, p.inventory.moonPetal || 0); p.inventory.moonPetal = Math.max(0, (p.inventory.moonPetal || 0) - 4); relation(state, 'player', 'jiafu').debt += 1; }
        if (choice === 'observe') { p.cultivation.insight += 6; remember(state, 'player', 'jiafu', { kind: 'market', valence: 2, text: '贾富会先用低价聚拢人气，再让稀缺资源成为势力之间的筹码。', facts: { auctionObserved: true } }); }
        log(state, 'choice', `你处理了贾富的拍卖会：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.auction });
        return true;
      });
      engine.registerEvent('allianceCouncil', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.allianceCouncil = true;
        state.wolfCrisis.active = true; state.wolfCrisis.phase = 'mobilizing'; state.wolfCrisis.alliance.active = true; state.wolfCrisis.alliance.obligations.guYue = (state.wolfCrisis.alliance.obligations.guYue || 0) + 2;
        if (choice === 'aid') { state.factions.guYue.influence -= 4; state.factions.guYue.tension -= 4; state.factions.bai.tension -= 5; state.factions.xiong.tension -= 5; state.factions.guYue.relations.bai += 8; state.factions.guYue.relations.xiong += 8; remember(state, 'guyuebo', 'player', { kind: 'politics', valence: 6, text: '你在三寨利益分配前支持共同防线。' }); }
        if (choice === 'aid') { state.wolfCrisis.supply += 8; state.wolfCrisis.relief += 4; state.wolfCrisis.alliance.legitimacy += 8; state.wolfCrisis.alliance.contributions.guYue = (state.wolfCrisis.alliance.contributions.guYue || 0) + 4; }
        if (choice === 'hoard') { state.factions.guYue.influence += 4; state.factions.guYue.tension += 5; state.factions.bai.tension += 4; state.factions.xiong.tension += 4; state.director.pressure += 1; state.wolfCrisis.supply -= 3; state.wolfCrisis.alliance.legitimacy -= 5; remember(state, 'guyuebo', 'player', { kind: 'politics', valence: 1, text: '你首先考虑古月山寨的存续。' }); }
        if (choice === 'spy') { p.cultivation.insight += 8; state.wolfCrisis.alliance.legitimacy -= 1; state.wolfCrisis.alliance.contributions.player = (state.wolfCrisis.alliance.contributions.player || 0) + 1; remember(state, 'player', 'world', { kind: 'secret', valence: 3, text: '三寨联盟真正困难的不是是否结盟，而是谁承担最危险的防线。', facts: { allianceIntel: true } }); }
        log(state, 'choice', `你处理了三寨议事：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.wolf });
        return true;
      });
      engine.registerEvent('wolfTide', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.wolfTide = true; state.wolfCrisis.active = true; state.wolfCrisis.phase = 'assault'; state.wolfCrisis.pressure = Math.max(28, state.wolfCrisis.pressure); state.wolfCrisis.battles += 1; state.director.pressure = clamp(state.director.pressure + 2, 0, 10);
        for (const locationId of ['bambooForest', 'riverbank', 'cliffCave']) state.zones[locationId].danger += 12;
        state.zones.village.resources.food = Math.max(0, state.zones.village.resources.food - 2); state.factions.guYue.tension += 6;
        if (choice === 'mobilize') { state.zones.village.danger = Math.max(0, state.zones.village.danger - 8); state.factions.guYue.influence += 5; state.factions.guYue.tension -= 3; state.wolfCrisis.relief += 12; state.wolfCrisis.supply += 10; state.wolfCrisis.alliance.legitimacy += 4; state.wolfCrisis.alliance.contributions.guYue = (state.wolfCrisis.alliance.contributions.guYue || 0) + 6; remember(state, 'guyuebo', 'player', { kind: 'crisis', valence: 8, text: '你在狼潮逼近前参与了巡逻与布防。' }); }
        if (choice === 'hunt') { p.inventory.food = (p.inventory.food || 0) + 2; p.needs.safety -= 12; p.cultivation.insight += 3; state.wolfCrisis.supply -= 4; state.wolfCrisis.pressure += 5; remember(state, 'bainingbing', 'player', { kind: 'crisis', valence: 2, text: '你在狼潮逼近时选择深入山林。' }); }
        if (choice === 'secure') { p.inventory.water += 3; p.inventory.food = (p.inventory.food || 0) + 3; state.zones.bambooForest.danger += 8; state.wolfCrisis.supply += 6; state.wolfCrisis.relief += 4; state.director.pressure += 1; }
        log(state, 'choice', `你面对狼潮逼近作出决定：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.wolf });
        return true;
      });
      engine.registerEvent('threeClanTournament', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.tournamentAnnounced = true;
        state.wolfCrisis.phase = 'aftermath'; state.wolfCrisis.active = true; state.wolfCrisis.alliance.legitimacy += choice === 'sponsor' ? 4 : 1;
        state.facts.tournament = { announcedDay: day(state), format: 'three-clan' };
        state.factions.guYue.tension += 3; state.factions.bai.tension += 2; state.factions.xiong.tension += 2;
        if (choice === 'enter') { p.needs.energy -= 12; p.cultivation.progress += 10; relation(state, 'player', 'xiong').fear += 4; remember(state, 'player', 'world', { kind: 'competition', valence: 3, text: '你把三族赔偿问题变成了自己的公开竞争。', facts: { enteredTournament: true } }); }
        if (choice === 'sponsor') { state.factions.guYue.influence += 6; relation(state, 'player', 'guYue').trust += 6; remember(state, 'guyuebo', 'player', { kind: 'politics', valence: 5, text: '你在三族大比武前支持本族参赛者。' }); }
        if (choice === 'observe') { p.cultivation.insight += 9; remember(state, 'player', 'world', { kind: 'secret', valence: 3, text: '狼潮后的真正秩序取决于谁能把实力转成赔偿方案。', facts: { tournamentIntel: true } }); }
        log(state, 'choice', `你处理了三族大比武筹备：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.tournament });
        return true;
      });
      engine.registerEvent('ironInvestigation', ({ state, choice, event }) => {
        const p = state.entities.player;
        activateSeed(state, 'tieruonan'); activateSeed(state, 'tiexueleng');
        state.flags.investigationArrived = true;
        state.facts.investigation = { arrivedDay: day(state), caseStatus: 'open' };
        if (choice === 'cooperate') { relation(state, 'player', 'tieruonan').trust += 8; relation(state, 'player', 'tiexueleng').trust += 4; state.factions.iron.attitude += 6; remember(state, 'tiexueleng', 'player', { kind: 'case', valence: 5, text: '你愿意主动提供线索，暂时不把自己藏在家族背后。' }); }
        if (choice === 'evade') { relation(state, 'player', 'tiexueleng').fear += 5; state.factions.iron.tension += 4; state.director.pressure += 2; remember(state, 'tieruonan', 'player', { kind: 'suspicion', valence: -4, text: '这个人避开了关键问题，行动轨迹值得重新调查。' }); }
        if (choice === 'bargain') { p.cultivation.insight += 6; relation(state, 'player', 'tiexueleng').debt += 1; state.factions.iron.attitude += 2; p.memory.facts.world.investigationLeverage = true; }
        log(state, 'choice', `你处理了铁家父女的调查：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.investigation });
        return true;
      });
      engine.registerEvent('merchantCityArrival', ({ state, choice, event }) => {
        const p = state.entities.player;
        if (choice !== 'avoid') {
          state.flags.merchantCityOpened = true;
          activateSeed(state, 'shangxinci'); activateSeed(state, 'weiyang');
          state.facts.merchantCity = { enteredDay: day(state), status: choice === 'enter' ? 'inside' : 'surveyed' };
          state.factions.shang.influence += choice === 'enter' ? 4 : 1;
          if (choice === 'survey') { p.cultivation.insight += 6; remember(state, 'player', 'shangxinci', { kind: 'city', valence: 2, text: '你先观察商家城的关系网络，没有急着接受保护。' }); }
          if (choice === 'enter') { relation(state, 'player', 'shangxinci').trust += 3; p.inventory.stones += 2; }
        } else { state.director.pressure += 1; p.cultivation.insight += 2; state.facts.threeForkLead = true; }
        log(state, 'choice', `你处理了进入商家城的选择：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.merchantCity });
        return true;
      });
      engine.registerEvent('merchantArena', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.arenaTrial = true; state.arena.active = true; state.facts.arena = { firstTrialDay: day(state) };
        if (choice === 'fight') { p.needs.energy -= 15; p.cultivation.progress += 12; state.factions.shang.influence += 3; remember(state, 'weiyang', 'player', { kind: 'arena', valence: 4, text: '你愿意用公开胜负证明自己的价值。' }); }
        if (choice === 'recruit') { p.cultivation.insight += 7; relation(state, 'player', 'weiyang').trust += 8; relation(state, 'player', 'shangxinci').trust += 5; }
        if (choice === 'trade') { p.inventory.stones = Math.max(0, p.inventory.stones - 2); p.inventory.water += 3; state.facts.threeKingsRumor = true; }
        log(state, 'choice', `你处理了商家城演武场：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.merchantCity });
        return true;
      });
      engine.registerEvent('threeKingsInheritance', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.threeKingsAwakened = true; state.inheritance.active = true;
        state.facts.threeKings = { firstEntryDay: day(state), attempts: 1 };
        state.zones.threeForkMountain.activity += 18; state.zones.threeForkMountain.danger += 14;
        if (choice === 'enter') { p.needs.energy -= 18; p.cultivation.progress += 18; p.inventory.relicFragment = (p.inventory.relicFragment || 0) + 1; remember(state, 'player', 'world', { kind: 'inheritance', valence: 4, text: '你进入三王传承，发现传承本身也在筛选和消耗进入者。', facts: { enteredThreeKings: true } }); }
        if (choice === 'scout') { p.cultivation.insight += 10; state.facts.threeKingsIntel = true; }
        if (choice === 'ambush') { state.factions.shang.tension += 5; state.factions.iron.tension += 4; state.director.pressure += 2; remember(state, 'player', 'world', { kind: 'ambush', valence: -4, text: '你把传承出口当成了新的资源节点。' }); }
        log(state, 'choice', `你处理了三王传承开启：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.threeKings });
        return true;
      });
      engine.registerEvent('heavenClimbTransmission', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.heavenClimbRumor = true; state.facts.heavenClimb = { heardDay: day(state), choice };
        if (choice === 'follow') { p.cultivation.insight += 12; state.director.pressure += 2; remember(state, 'player', 'world', { kind: 'sect', valence: 3, text: '天梯山的传承争夺已经超出家族和商队的尺度。', facts: { sectLead: true } }); }
        if (choice === 'sell') { p.inventory.stones += 5; state.factions.shang.influence += 5; state.factions.shang.tension += 3; }
        if (choice === 'ignore') { p.cultivation.progress += 8; state.facts.sectLead = 'withheld'; }
        log(state, 'choice', `你处理了天梯山传承消息：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.heavenClimb });
        return true;
      });
      engine.registerEvent('northernWarArrival', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.northernFrontierOpened = choice !== 'avoid';
        state.frontier.opened = state.flags.northernFrontierOpened;
        if (state.frontier.opened) { activateSeed(state, 'heiloulan'); activateSeed(state, 'taibaiyunsheng'); state.factions.black.influence += 4; state.factions.northernTribes.tension += 3; }
        if (choice === 'enter') { p.cultivation.insight += 8; state.frontier.supply -= 8; remember(state, 'player', 'world', { kind: 'war', valence: 2, text: '你沿商路进入北原，开始把军队、后勤和部族关系当成同一个系统观察。', facts: { northernLead: true } }); }
        if (choice === 'observe') { p.cultivation.insight += 12; state.frontier.campaignPressure += 2; }
        if (choice === 'avoid') { state.director.pressure += 1; p.cultivation.progress += 6; }
        log(state, 'choice', `你处理了北原战报：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.northernWar });
        return true;
      });
      engine.registerEvent('blackCampaign', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.blackCampaign = true; state.frontier.battles += 1; state.frontier.campaignPressure += 4;
        activateSeed(state, 'dongfangyuliang'); activateSeed(state, 'mayingjie');
        if (choice === 'mobilize') { p.needs.energy -= 14; state.frontier.supply -= 12; state.factions.black.influence += 8; state.factions.dongfang.tension += 5; remember(state, 'heiloulan', 'player', { kind: 'war', valence: 4, text: '你愿意把行动力投入黑盟的军帐和后勤。' }); }
        if (choice === 'mediate') { state.frontier.campaignPressure = Math.max(0, state.frontier.campaignPressure - 3); state.factions.black.influence -= 3; state.factions.northernTribes.attitude += 8; remember(state, 'taibaiyunsheng', 'player', { kind: 'mediation', valence: 4, text: '你试图让中小部族在战争中保留喘息的余地。' }); }
        if (choice === 'scout') { p.cultivation.insight += 10; state.factions.dongfang.attitude -= 8; state.facts.dongfangIntel = true; }
        log(state, 'choice', `你处理了黑盟军帐：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.northernWar });
        return true;
      });
      engine.registerEvent('imperialCourtOpening', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.imperialCourtOpened = true; state.frontier.campaignPressure += 3; state.facts.imperialCourt = { openedDay: day(state), choice };
        if (choice === 'support') { state.factions.black.influence += 8; state.factions.northernTribes.tension += 6; state.frontier.supply -= 8; }
        if (choice === 'relief') { state.factions.black.influence -= 5; state.factions.northernTribes.tension = Math.max(0, state.factions.northernTribes.tension - 8); state.frontier.campaignPressure = Math.max(0, state.frontier.campaignPressure - 4); }
        if (choice === 'broker') { p.cultivation.insight += 12; p.inventory.stones += 4; state.facts.trueYangLead = true; }
        log(state, 'choice', `你处理了王庭福地的军政争议：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.tribeCrisis });
        return true;
      });
      engine.registerEvent('trueYangTowerFormation', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.trueYangTowerFormed = true; state.tower.formed = true; state.tower.active = choice !== 'assist'; state.facts.trueYangTower = { formedDay: day(state), choice };
        state.factions.giantSun.influence = Math.min(100, state.factions.giantSun.influence + 5); state.frontier.campaignPressure += 4;
        if (choice === 'enter') { p.cultivation.insight += 14; state.tower.attempts += 1; remember(state, 'player', 'world', { kind: 'tower', valence: 4, text: '你把真阳楼视为会受战争、天气和资格影响的活系统，而不是一座静态宝库。', facts: { towerLead: true } }); }
        if (choice === 'assist') { state.frontier.supply += 12; state.factions.northernTribes.attitude += 6; }
        if (choice === 'watch') { p.cultivation.insight += 10; state.tower.discoveries.push({ kind: 'formation-pattern', day: day(state) }); }
        log(state, 'choice', `你处理了八十八角真阳楼显化：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.towerFormation });
        return true;
      });
      engine.registerEvent('foxFairyLandReturn', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.foxFairyLandOpened = true; state.central.foxOpened = true;
        if (choice === 'recover') { p.needs.energy = Math.min(100, p.needs.energy + 24); p.cultivation.insight += 5; state.frontier.campaignPressure = Math.max(0, state.frontier.campaignPressure - 5); }
        if (choice === 'prepare') { state.central.sectPressure += 3; state.zones.foxFairyLand.activity += 8; p.inventory.stones = Math.max(0, p.inventory.stones - 2); }
        if (choice === 'hide') { state.director.pressure = Math.max(0, state.director.pressure - 1); state.facts.hiddenReturn = true; }
        log(state, 'choice', `你处理了回归狐仙福地：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.foxReturn });
        return true;
      });
      engine.registerEvent('centralContinentArrival', ({ state, choice, event }) => {
        state.flags.centralContinentOpened = true; state.central.centralOpened = true;
        activateSeed(state, 'tianhe');
        if (choice === 'sect') { state.factions.centralSects.attitude += 5; state.factions.immortalCrane.influence += 3; state.central.sectPressure += 2; }
        if (choice === 'trade') { state.factions.auctionImmortals.influence += 4; state.entities.player.inventory.stones += 3; }
        if (choice === 'avoid') { state.director.pressure += 1; state.central.sectPressure = Math.max(0, state.central.sectPressure - 1); }
        log(state, 'choice', `你处理了中洲宗门的视线：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.sectPressure });
        return true;
      });
      engine.registerEvent('immortalAuction', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.immortalAuctionOpened = true; state.central.auctionActive = true; activateSeed(state, 'qinbaisheng');
        if (choice === 'bid') { p.inventory.stones = Math.max(0, p.inventory.stones - 3); state.central.lotsSold += 1; p.cultivation.insight += 8; state.factions.auctionImmortals.influence += 4; }
        if (choice === 'observe') { p.cultivation.insight += 12; state.central.sectPressure += 1; }
        if (choice === 'rumor') { p.inventory.stones += 6; state.central.sectPressure += 4; state.facts.auctionIntel = true; }
        log(state, 'choice', `你处理了中洲拍卖大会：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.immortalAuction });
        return true;
      });
      engine.registerEvent('identityPursuit', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.facts.identityPursuitLastClock = state.clock;
        if (pursuit) pursuit.createTeam(state, { factionId: 'auctionImmortals', targetId: 'player', location: state.locations[p.position.location]?.neighbors?.[0] || p.position.location, reason: `identityPursuit:${choice}`, strength: choice === 'confront' ? 2 : 1 });
        if (choice === 'erase') { p.inventory.stones = Math.max(0, p.inventory.stones - 5); state.central.tracePressure = Math.max(0, state.central.tracePressure - 22); state.central.marketReputation -= 3; }
        if (choice === 'misdirect') { state.central.tracePressure = Math.max(0, state.central.tracePressure - 10); state.central.rumorCredibility = Math.max(0, state.central.rumorCredibility - 8); state.central.sectPressure += 2; }
        if (choice === 'confront') { state.central.tracePressure = Math.min(100, state.central.tracePressure + 8); state.director.pressure = clamp(state.director.pressure + 3, 0, 10); state.factions.centralSects.tension += 5; state.factions.auctionImmortals.tension += 4; }
        log(state, 'choice', `你处理了交易痕迹引发的追查：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.identityPursuit, trace: state.central.tracePressure });
        return true;
      });
      engine.registerEvent('sectPressure', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.sectPressureActive = true; state.central.sectPressure += 5;
        if (choice === 'defend') { p.inventory.stones = Math.max(0, p.inventory.stones - 4); state.central.sectPressure = Math.max(0, state.central.sectPressure - 3); state.zones.foxFairyLand.danger += 4; }
        if (choice === 'negotiate') { activateSeed(state, 'tianhe'); relation(state, 'player', 'tianhe').trust += 8; state.factions.immortalCrane.attitude += 5; }
        if (choice === 'ambush') { state.central.sectPressure += 4; state.factions.centralSects.tension += 6; p.cultivation.progress += 12; }
        log(state, 'choice', `你处理了宗门对狐仙福地的压力：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.sectPressure });
        return true;
      });
      engine.registerEvent('shadowSectRebuild', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.shadowSectRebuilt = true; state.worldWar.shadowRebuilt = true;
        activateSeed(state, 'yingwuxie');
        state.factions.shadowSect.influence += choice === 'ally' ? 8 : 3;
        state.factions.centralSects.tension += choice === 'rebuild' ? 4 : 1;
        if (choice === 'rebuild') { p.cultivation.insight += 10; state.facts.shadowIntel = true; }
        if (choice === 'ally') { relation(state, 'player', 'yingwuxie').trust += 5; state.director.pressure += 3; }
        if (choice === 'hide') { p.cultivation.insight += 5; state.director.pressure = Math.max(0, state.director.pressure - 1); }
        log(state, 'choice', `你处理了影宗残脉重新结网：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.shadowRebuild });
        return true;
      });
      engine.registerEvent('fiveRegionsWar', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.fiveRegionsWarOpened = true; state.worldWar.fiveRegions = true; state.worldWar.heat += choice === 'regions' ? 12 : 6;
        state.factions.longLifeHeaven.tension += 4; state.factions.heavenlyCourt.tension += 4; state.factions.centralSects.tension += 3;
        if (choice === 'central') { p.cultivation.insight += 12; state.facts.fiveRegionsIntel = true; }
        if (choice === 'regions') { p.inventory.stones += 4; state.director.pressure += 3; }
        if (choice === 'observe') { p.cultivation.insight += 8; state.director.pressure += 1; }
        log(state, 'choice', `你处理了五域格局开始转动：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.fiveRegionsWar });
        return true;
      });
      engine.registerEvent('southernFront', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.southernFrontOpened = true; state.worldWar.southern = true; activateSeed(state, 'wuyong');
        if (choice === 'negotiate') { state.factions.southernSuperClans.tension = Math.max(0, state.factions.southernSuperClans.tension - 8); state.factions.southernSuperClans.attitude += 6; p.cultivation.insight += 7; }
        if (choice === 'mobilize') { state.factions.southernSuperClans.influence += 8; state.worldWar.heat += 7; state.director.pressure += 2; }
        if (choice === 'observe') { p.cultivation.insight += 9; state.facts.southernIntel = true; }
        log(state, 'choice', `你处理了南疆超级家族的边线：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.southernFront });
        return true;
      });
      engine.registerEvent('westernFront', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.westernFrontOpened = true; state.worldWar.western = true; activateSeed(state, 'fangdichang');
        if (choice === 'trade') { p.inventory.stones += 5; p.cultivation.insight += 8; state.factions.westernDesertFang.attitude += 4; }
        if (choice === 'defend') { state.factions.westernDesertFang.influence += 8; state.worldWar.heat += 6; }
        if (choice === 'raid') { state.factions.westernDesertFang.tension += 12; state.factions.westernDesertFang.attitude -= 8; p.inventory.stones += 8; state.director.pressure += 3; }
        log(state, 'choice', `你处理了西漠房家的蛊屋线：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.westernDesert });
        return true;
      });
      engine.registerEvent('heavenlyCourtCampaign', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.heavenlyCourtOpened = true; state.worldWar.heavenly = true; activateSeed(state, 'longgong'); activateSeed(state, 'ziweixianzi');
        if (choice === 'infiltrate') { state.factions.heavenlyCourt.tension += 12; state.factions.heavenlyCourt.attitude -= 10; p.cultivation.insight += 14; state.worldWar.heat += 8; }
        if (choice === 'defend') { state.factions.heavenlyCourt.attitude += 6; state.factions.heavenlyCourt.tension = Math.max(0, state.factions.heavenlyCourt.tension - 5); state.director.pressure -= 1; }
        if (choice === 'observe') { p.cultivation.insight += 12; state.facts.heavenlyIntel = true; }
        log(state, 'choice', `你处理了天庭的五域战争决策：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.heavenlyCourt });
        return true;
      });
      engine.registerEvent('divineEmperorArrival', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.divineEmperorOpened = true; state.eternalWar.divineEmperor = true; activateSeed(state, 'qindingling');
        if (choice === 'enter') { p.cultivation.insight += 12; state.factions.humanPathAlliance.influence += 5; state.factions.heavenlyCourt.influence += 4; }
        if (choice === 'trade') { p.inventory.stones += 7; p.cultivation.insight += 6; state.facts.divineEmperorIntel = true; state.factions.heavenlyCourt.tension += 3; }
        if (choice === 'avoid') { state.director.pressure += 2; state.factions.heavenlyCourt.attitude -= 3; }
        log(state, 'choice', `你处理了神帝城的人道战线：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.divineEmperor });
        return true;
      });
      engine.registerEvent('twoHeavensConvergence', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.twoHeavensOpened = true; state.eternalWar.twoHeavens = true; state.eternalWar.cosmicHeat += choice === 'sabotage' ? 12 : 6;
        state.factions.twoHeavensForces.tension += choice === 'sabotage' ? 8 : 3; state.factions.heavenlyCourt.tension += 4;
        if (choice === 'support') { state.factions.heavenlyCourt.influence += 8; p.inventory.stones = Math.max(0, p.inventory.stones - 2); }
        if (choice === 'sabotage') { p.inventory.stones += 6; p.cultivation.insight += 8; state.facts.twoHeavensSabotage = true; }
        if (choice === 'observe') { p.cultivation.insight += 14; state.facts.twoHeavensIntel = true; }
        log(state, 'choice', `你处理了两天战场重叠：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.twoHeavens });
        return true;
      });
      engine.registerEvent('madDemonCaveOpening', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.madDemonCaveOpened = true; state.eternalWar.madDemonCave = true; activateSeed(state, 'luweiyin');
        if (choice === 'descend') { p.cultivation.insight += 18; state.eternalWar.cosmicHeat += 10; state.facts.originSecret = true; }
        if (choice === 'consult') { relation(state, 'player', 'luweiyin').trust += 8; p.cultivation.insight += 10; state.eternalWar.cosmicHeat = Math.max(0, state.eternalWar.cosmicHeat - 3); }
        if (choice === 'seal') { state.eternalWar.cosmicHeat = Math.max(0, state.eternalWar.cosmicHeat - 8); state.director.pressure += 1; }
        log(state, 'choice', `你处理了疯魔窟的元境线索：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.madDemonCave });
        return true;
      });
      engine.registerEvent('dreamRealmSurge', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.dreamSurgeOpened = true; state.eternalWar.dream = true;
        if (choice === 'enter') { p.cultivation.insight += 16; state.eternalWar.dreamPressure += 10; state.facts.dreamDepth = (state.facts.dreamDepth || 0) + 1; }
        if (choice === 'harvest') { p.inventory.stones += 5; state.eternalWar.dreamPressure += 14; state.factions.dreamPathForces.influence += 6; }
        if (choice === 'avoid') { state.eternalWar.dreamPressure = Math.max(0, state.eternalWar.dreamPressure - 5); state.director.pressure += 1; }
        log(state, 'choice', `你处理了梦境战场潮汐：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.twoHeavens });
        return true;
      });
      engine.registerEvent('starHostPlan', ({ state, choice, event }) => {
        const p = state.entities.player;
        state.flags.starHostPlanOpened = true; state.eternalWar.starHost = true;
        if (choice === 'defend') { state.eternalWar.cosmicHeat = Math.max(0, state.eternalWar.cosmicHeat - 12); state.factions.heavenlyCourt.influence += 8; }
        if (choice === 'break') { p.cultivation.insight += 22; state.eternalWar.cosmicHeat += 15; state.facts.starHostWeakness = true; state.factions.heavenlyCourt.tension += 10; }
        if (choice === 'wait') { p.needs.energy = Math.min(100, p.needs.energy + 20); state.eternalWar.cosmicHeat += 4; }
        log(state, 'choice', `你处理了星宿安排与天脉节点：${event.choices.find(c => c.id === choice).label}。`, { source: sourceNotes.starHost });
        return true;
      });
    }
    return { registerHandlers };
  }

  return { createRuntime };
});
