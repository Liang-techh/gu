(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationRepeatableSystems = factory();
})(globalThis, function () {
  'use strict';

  function createRuntime({ engine, random, clamp, relation, remember, log, damageEntity, advance }) {
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
        log(state, 'arena_match', '你在演武场落败，伤势和旁观者的判断一起留下。', { result: 'loss', matches: state.arena.matches, losses: state.arena.losses });
      }
      engine.emit(state, 'arena.match', { result: win ? 'win' : 'loss', matches: state.arena.matches, wins: state.arena.wins, losses: state.arena.losses });
      advance(state, 2, 'arena_match');
    }

    function inheritanceRound(state, p) {
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
      engine.emit(state, 'inheritance.round', { result: success ? 'success' : 'failure', round: nextRound, difficulty, attempts: state.inheritance.attempts });
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
        log(state, 'frontier_patrol', '北原巡逻遭到伏击，补给和人员都付出了代价。', { result: 'failure', supply: state.frontier.supply, casualties: state.frontier.casualties });
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
        log(state, 'tower_floor', `你在真阳楼第 ${nextFloor} 层受挫，楼层没有因此停止显化。`, { result: 'failure', floor: nextFloor, difficulty });
      }
      engine.emit(state, 'tower.floor', { result: success ? 'success' : 'failure', floor: nextFloor, difficulty, attempts: state.tower.attempts });
      advance(state, 5, 'tower_floor');
    }

    function auctionLot(state, p, command) {
      if (p.position.location !== 'immortalAuction' || !state.central?.auctionActive) throw new Error('当前没有开放的中洲拍卖会');
      const mode = command.mode || 'observe';
      const price = 2 + Math.floor(state.central.auctionHeat / 12) + Math.floor(random(state) * 3);
      if (!['bid', 'observe', 'rumor'].includes(mode)) throw new Error('未知的拍卖行动');
      if (mode === 'bid') {
        if ((p.inventory.stones || 0) < price) throw new Error(`竞拍至少需要 ${price} 枚元石`);
        p.inventory.stones -= price; state.central.lotsSold += 1; state.central.auctionHeat += 4;
        p.cultivation.insight += 3 + Math.min(5, Math.floor(price / 2)); state.factions.auctionImmortals.influence += 0.8;
      } else if (mode === 'observe') {
        state.central.auctionHeat += 1; p.cultivation.insight += 2; state.facts.auctionIntel = true;
      } else {
        p.inventory.stones += Math.max(1, Math.floor(price / 2)); state.central.auctionHeat += 5; state.central.sectPressure += 1; state.facts.auctionIntel = true;
      }
      state.central.auctionHeat = clamp(state.central.auctionHeat, 0, 100);
      engine.emit(state, 'auction.lot', { actorId: 'player', location: p.position.location, result: mode, price, lotsSold: state.central.lotsSold, heat: state.central.auctionHeat });
      log(state, 'auction_lot', `你在中洲拍卖会选择${mode === 'bid' ? '竞拍' : mode === 'observe' ? '观察' : '出售情报'}，当前成交 ${state.central.lotsSold} 笔。`, { result: mode, price, lotsSold: state.central.lotsSold, heat: state.central.auctionHeat });
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
        log(state, 'dream_dive', '梦境反噬把你从深层认知中强行拖回现实。', { result: 'failure', pressure: state.eternalWar.dreamPressure });
      }
      engine.emit(state, 'dream.dive', { actorId: p.id, result: success ? 'success' : 'failure', pressure: state.eternalWar.dreamPressure, dives: state.eternalWar.dives });
      advance(state, 4, 'dream_dive');
    }

    return { arenaMatch, inheritanceRound, frontierPatrol, towerFloor, auctionLot, dreamDive };
  }

  return { createRuntime };
});
