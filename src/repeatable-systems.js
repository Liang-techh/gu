(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationRepeatableSystems = factory();
})(globalThis, function () {
  'use strict';

  function createRuntime({ engine, random, clamp, relation, remember, log, damageEntity, advance, consequence = () => null }) {
    function arenaMatch(state, p) {
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
        const reason = '你在演武场落败，伤势和旁观者的判断一起留下。';
        consequence(state, { kind: 'loss', actorId: p.id, source: 'arena_match', location: p.position.location, reason, data: { matches: state.arena.matches, losses: state.arena.losses }, pressure: 0.1 });
        log(state, 'arena_match', reason, { result: 'loss', matches: state.arena.matches, losses: state.arena.losses });
      }
      engine.emit(state, 'arena.match', { result: win ? 'win' : 'loss', matches: state.arena.matches, wins: state.arena.wins, losses: state.arena.losses });
      advance(state, 2, 'arena_match');
    }

    function inheritanceScout(state, p) {
      if (p.position.location !== 'threeForkMountain' || !state.inheritance?.active || state.inheritance.completed) throw new Error('当前没有可侦查的三王传承');
      const kinds = ['sequence', 'qualification', 'hazard', 'rival'];
      const kind = kinds[Math.floor(random(state) * kinds.length)];
      const quality = clamp(0.32 + p.cultivation.insight * 0.012 + p.cultivation.aptitude * 0.12 - state.inheritance.attempts * 0.006, 0.1, 0.95);
      state.inheritance.clues.push({ kind, quality, clock: state.clock, source: 'player-scout' });
      state.inheritance.clueConfidence = clamp(state.inheritance.clueConfidence * 0.65 + quality * 0.35, 0, 1);
      state.inheritance.qualification += kind === 'qualification' ? 2 : 1;
      state.inheritance.window = Math.max(0, state.inheritance.window - 2);
      p.needs.energy -= 5;
      p.cultivation.insight += 2;
      remember(state, 'player', 'world', { kind: 'inheritance-scout', valence: 2, text: `你侦查三王传承，确认了${kind}线索，但也让竞争者知道有人在提前布局。`, facts: { inheritanceClue: kind, inheritanceClueConfidence: state.inheritance.clueConfidence } });
      log(state, 'inheritance_scout', `你侦查了三王传承，线索可信度达到 ${Math.round(state.inheritance.clueConfidence * 100)}%。`, { kind, quality, qualification: state.inheritance.qualification });
      engine.emit(state, 'inheritance.scout', { actorId: p.id, kind, quality, confidence: state.inheritance.clueConfidence, qualification: state.inheritance.qualification });
      advance(state, 2, 'inheritance_scout');
    }

    function inheritanceRound(state, p, command = {}) {
      if (p.position.location !== 'threeForkMountain' || !state.inheritance?.active || state.inheritance.completed) throw new Error('当前没有可进入的三王传承');
      const nextRound = state.inheritance.round + 1;
      const difficulty = 1 + Math.floor((nextRound - 1) / 10) * 0.22 + state.inheritance.attempts * 0.015;
      const mode = command.mode || 'claim';
      if (!['claim', 'greed'].includes(mode)) throw new Error('未知的传承推进方式');
      const qualificationGate = nextRound >= 6 && state.inheritance.qualification < Math.floor(nextRound / 5);
      const clueBonus = state.inheritance.clueConfidence * 0.14 + Math.min(0.08, state.inheritance.qualification * 0.01);
      const greedPenalty = mode === 'greed' ? 0.1 + state.inheritance.greed * 0.01 : 0;
      const power = 0.38 + p.cultivation.rank * 0.07 + p.cultivation.insight * 0.007 + p.cultivation.aptitude * 0.06;
      const success = !qualificationGate && random(state) < clamp(0.72 + power - difficulty * 0.34 + clueBonus - greedPenalty, 0.08, 0.92);
      state.inheritance.attempts += 1; state.inheritance.difficulty = difficulty;
      state.inheritance.window = Math.max(0, state.inheritance.window - (mode === 'greed' ? 5 : 3));
      const rivalId = ['shang', 'iron', 'demonic'][state.inheritance.attempts % 3];
      state.inheritance.rivalProgress[rivalId] = (state.inheritance.rivalProgress[rivalId] || 0) + (success ? 0.5 : 1.5) + (mode === 'greed' ? 1 : 0);
      if (success) {
        state.inheritance.round = nextRound; state.inheritance.discoveries.push({ round: nextRound, clock: state.clock, mode, confidence: state.inheritance.clueConfidence });
        const reward = mode === 'greed' ? 2 : 1;
        p.cultivation.progress += 3 + difficulty * 2 + (mode === 'greed' ? 1 : 0); p.inventory.relicFragment = (p.inventory.relicFragment || 0) + reward;
        if (mode === 'greed') state.inheritance.greed += 1;
        state.facts.threeKingsAttempts = state.inheritance.attempts;
        if (nextRound >= 30) state.inheritance.completed = true;
        remember(state, 'player', 'world', { kind: 'inheritance', valence: 3, text: `你通过了三王传承第${nextRound}轮，${mode === 'greed' ? '贪取捷径让竞争者更快锁定了你的路线。' : '下一轮的门槛更高。'}`, facts: { lastInheritanceRound: nextRound, inheritanceMode: mode } });
        log(state, 'inheritance_round', `你通过了三王传承第 ${nextRound} 轮${mode === 'greed' ? '，并贪取了额外收益' : ''}。`, { result: 'success', round: nextRound, difficulty, mode, rivalId });
      } else {
        state.inheritance.wrongTurns += 1;
        p.needs.energy -= 10; damageEntity(state, 'player', 4 + difficulty * 2, 'inheritance', 'inheritance_trial');
        const reason = qualificationGate ? `你缺少通过第 ${nextRound} 轮所需的资格线索，传承拒绝了这次推进。` : `你在三王传承第 ${nextRound} 轮受挫，传承拒绝了这次推进。`;
        consequence(state, { kind: qualificationGate ? 'wrong_route' : 'failure', actorId: p.id, source: 'inheritance_round', location: p.position.location, reason, data: { round: nextRound, difficulty, mode, rivalId, clueConfidence: state.inheritance.clueConfidence }, pressure: 0.15 });
        log(state, 'inheritance_round', reason, { result: 'failure', round: nextRound, difficulty, mode, rivalId, wrongTurns: state.inheritance.wrongTurns });
      }
      engine.emit(state, 'inheritance.round', { result: success ? 'success' : 'failure', round: nextRound, difficulty, attempts: state.inheritance.attempts, mode, rivalId, clueConfidence: state.inheritance.clueConfidence, qualification: state.inheritance.qualification });
      advance(state, 4, 'inheritance_round');
    }

    function frontierPatrol(state, p) {
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
        const reason = '北原巡逻遭到伏击，补给和人员都付出了代价。';
        consequence(state, { kind: 'failure', actorId: p.id, factionId: 'black', source: 'frontier_patrol', location: p.position.location, reason, data: { supply: state.frontier.supply, casualties: state.frontier.casualties }, tension: 1, pressure: 0.2 });
        log(state, 'frontier_patrol', reason, { result: 'failure', supply: state.frontier.supply, casualties: state.frontier.casualties });
      }
      engine.emit(state, 'frontier.patrol', { result: success ? 'success' : 'failure', supply: state.frontier.supply, battles: state.frontier.battles, casualties: state.frontier.casualties });
      advance(state, 3, 'frontier_patrol');
    }

    function towerFloor(state, p) {
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
        const reason = `你在真阳楼第 ${nextFloor} 层受挫，楼层没有因此停止显化。`;
        consequence(state, { kind: 'failure', actorId: p.id, factionId: 'giantSun', source: 'tower_floor', location: p.position.location, reason, data: { floor: nextFloor, difficulty }, tension: 1, pressure: 0.2 });
        log(state, 'tower_floor', reason, { result: 'failure', floor: nextFloor, difficulty });
      }
      engine.emit(state, 'tower.floor', { result: success ? 'success' : 'failure', floor: nextFloor, difficulty, attempts: state.tower.attempts });
      advance(state, 5, 'tower_floor');
    }

    function auctionLot(state, p, command) {
      if (p.position.location !== 'immortalAuction' || !state.central?.auctionActive) throw new Error('当前没有开放的中洲拍卖会');
      const mode = command.mode || 'observe';
      const scarcity = Number(state.central.marketScarcity || 0);
      const price = Math.max(1, 2 + Math.floor(state.central.auctionHeat / 12) + Math.floor(scarcity / 25) + Math.floor(random(state) * 3));
      if (!['bid', 'observe', 'rumor', 'raise', 'mortgage', 'verify'].includes(mode)) throw new Error('未知的拍卖行动');
      if (mode === 'bid') {
        if ((p.inventory.stones || 0) < price) throw new Error(`竞拍至少需要 ${price} 枚元石`);
        p.inventory.stones -= price; state.central.lotsSold += 1; state.central.auctionHeat += 4;
        state.central.marketSupply -= 5; state.central.marketScarcity += 5; state.central.marketReputation += 2;
        state.central.marketDebt = Math.max(0, state.central.marketDebt - 1);
        p.cultivation.insight += 3 + Math.min(5, Math.floor(price / 2));
        if (state.factions.auctionImmortals) state.factions.auctionImmortals.influence += 0.8;
        remember(state, 'player', 'auctionMarket', { kind: 'observation', source: 'auction:purchase', text: `你以${price}枚元石拿下一笔拍卖品。`, facts: { lastAuctionPrice: price, lastAuctionMode: mode, marketScarcity: state.central.marketScarcity } });
      } else if (mode === 'observe') {
        state.central.auctionHeat += 1; p.cultivation.insight += 2; state.facts.auctionIntel = true;
        remember(state, 'player', 'auctionMarket', { kind: 'observation', source: 'auction:order-book', confidence: 0.72, text: '你观察了几轮出价，摸到了拍卖会的价格和供给规律。', facts: { auctionIntel: true, lastAuctionPrice: price, marketScarcity: state.central.marketScarcity, auctionHeat: state.central.auctionHeat } });
      } else if (mode === 'rumor') {
        const payout = Math.max(1, Math.floor(price * (0.35 + state.central.rumorCredibility / 100)));
        p.inventory.stones += payout; state.central.auctionHeat += 5; state.central.sectPressure += 1;
        state.central.rumorCredibility -= 4; state.central.tracePressure += 6; state.central.marketReputation -= 1; state.facts.auctionIntel = true;
        state.director.pressure = clamp(state.director.pressure + 0.4, 0, 10);
        remember(state, 'player', 'auctionMarket', { kind: 'rumor-market', source: 'auction:rumor-sale', confidence: 0.45, text: `你把一条情报卖给了拍卖会，换回${payout}枚元石，但留下了可追踪的交易痕迹。`, facts: { auctionIntel: true, lastRumorPayout: payout, rumorCredibility: state.central.rumorCredibility } });
        remember(state, 'qinbaisheng', 'player', { kind: 'rumor', source: 'auction:rumor-sale', text: '拍卖会有人在出售经过包装的情报。', facts: { marketTrace: true } });
      } else if (mode === 'raise') {
        const cost = Math.max(1, Math.ceil(price / 2));
        if ((p.inventory.stones || 0) < cost) throw new Error(`抬价至少需要 ${cost} 枚元石`);
        p.inventory.stones -= cost; state.central.auctionHeat += 8; state.central.marketScarcity += 3; state.central.tracePressure += 2;
        state.central.marketReputation += 1; state.central.sectPressure += 1;
        if (state.factions.auctionImmortals) state.factions.auctionImmortals.tension += 3;
        remember(state, 'qinbaisheng', 'player', { kind: 'suspicion', source: 'auction:price-war', text: '这个竞价者正在用异常出价测试市场底线。', facts: { priceWar: true } });
      } else if (mode === 'mortgage') {
        const amount = Math.max(3, Math.min(10, 4 + Math.floor(state.central.auctionHeat / 20)));
        p.inventory.stones += amount; state.central.marketDebt += amount; state.central.marketReputation -= 2; state.central.tracePressure += 1;
        state.central.sectPressure += state.central.marketDebt >= 12 ? 2 : 0;
        remember(state, 'player', 'auctionMarket', { kind: 'secret', source: 'auction:credit', text: `你以未兑现的市场信用借到${amount}枚元石。`, facts: { marketDebt: state.central.marketDebt, creditLine: true } });
        remember(state, 'qinbaisheng', 'player', { kind: 'suspicion', source: 'auction:credit', text: '这个竞价者开始透支市场信用。', facts: { marketDebt: state.central.marketDebt } });
      } else {
        if (p.cultivation.insight < 3) throw new Error('核验情报至少需要 3 点洞察');
        p.cultivation.insight -= 3; state.central.rumorCredibility += 8; state.central.tracePressure = Math.max(0, state.central.tracePressure - 3);
        state.central.marketReputation += 1; state.facts.auctionIntelVerified = (state.facts.auctionIntelVerified || 0) + 1;
        remember(state, 'player', 'auctionMarket', { kind: 'observation', source: 'auction:verification', confidence: 0.95, text: '你用洞察核验了市场情报，真假边界变得清晰。', facts: { auctionIntelVerified: state.facts.auctionIntelVerified, verifiedAuctionPrice: price, rumorCredibility: state.central.rumorCredibility } });
      }
      state.central.auctionHeat = clamp(state.central.auctionHeat, 0, 100);
      state.central.marketSupply = clamp(state.central.marketSupply, 0, 100);
      state.central.marketScarcity = clamp(state.central.marketScarcity, 0, 100);
      state.central.rumorCredibility = clamp(state.central.rumorCredibility, 0, 100);
      state.central.marketDebt = clamp(state.central.marketDebt, 0, 100);
      state.central.marketReputation = clamp(state.central.marketReputation, -100, 100);
      state.central.tracePressure = clamp(state.central.tracePressure, 0, 100);
      engine.emit(state, 'auction.lot', { actorId: 'player', location: p.position.location, result: mode, price, lotsSold: state.central.lotsSold, heat: state.central.auctionHeat, debt: state.central.marketDebt, trace: state.central.tracePressure, credibility: state.central.rumorCredibility, supply: state.central.marketSupply, scarcity: state.central.marketScarcity });
      const labels = { bid: '竞拍', observe: '观察', rumor: '出售情报', raise: '抬价', mortgage: '抵押借元石', verify: '核验情报' };
      log(state, 'auction_lot', `你在中洲拍卖会选择${labels[mode]}，当前成交 ${state.central.lotsSold} 笔。`, { result: mode, price, lotsSold: state.central.lotsSold, heat: state.central.auctionHeat, debt: state.central.marketDebt, trace: state.central.tracePressure, credibility: state.central.rumorCredibility });
      advance(state, 2, 'auction_lot');
    }

    function dreamDive(state, p) {
      if (p.position.location !== 'dreamRealms' || !state.eternalWar?.dream) throw new Error('梦境战场当前没有开放探索窗口');
      const pressure = state.eternalWar.dreamPressure;
      const power = 0.38 + p.cultivation.rank * 0.075 + p.cultivation.insight * 0.006 + p.cultivation.aptitude * 0.08;
      const success = random(state) < clamp(0.72 + power - pressure * 0.004, 0.1, 0.94);
      state.eternalWar.dives += 1;
      if (success) {
        state.eternalWar.successes += 1; state.eternalWar.dreamPressure = clamp(pressure + 4, 0, 100);
        p.cultivation.insight += 5; p.cultivation.progress += 6; state.facts.dreamDepth = (state.facts.dreamDepth || 0) + 1;
        remember(state, 'player', 'world', { kind: 'dream', valence: 3, text: '你从梦境深处带回了一段不属于现实的认知。', facts: { dreamDepth: state.facts.dreamDepth } });
        log(state, 'dream_dive', `你在梦境战场中取得一次突破，梦境深度达到 ${state.facts.dreamDepth}。`, { result: 'success', depth: state.facts.dreamDepth, pressure: state.eternalWar.dreamPressure });
      } else {
        state.eternalWar.failures += 1; state.eternalWar.dreamPressure = clamp(pressure + 10, 0, 100);
        damageEntity(state, 'player', 4 + pressure * 0.05, 'dreamRealms', 'dream_backlash'); p.needs.energy -= 10;
        const reason = '梦境反噬把你从深层认知中强行拖回现实。';
        consequence(state, { kind: 'failure', actorId: p.id, factionId: 'dreamPathForces', source: 'dream_dive', location: p.position.location, reason, data: { pressure: state.eternalWar.dreamPressure }, tension: 1, pressure: 0.25 });
        log(state, 'dream_dive', reason, { result: 'failure', pressure: state.eternalWar.dreamPressure });
      }
      engine.emit(state, 'dream.dive', { actorId: p.id, result: success ? 'success' : 'failure', pressure: state.eternalWar.dreamPressure, dives: state.eternalWar.dives });
      advance(state, 4, 'dream_dive');
    }

    return { arenaMatch, inheritanceScout, inheritanceRound, frontierPatrol, towerFloor, auctionLot, dreamDive };
  }

  return { createRuntime };
});
