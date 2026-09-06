(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationGuWorld = factory();
})(globalThis, function () {
  'use strict';

  // Gu content pack world provider. Kernel services (clock, dispatch,
  // persistence and registries) are injected instead of being recreated here.
  function createRuntime({
    schema, contentIndex, contentVersion, aptitude, locations, populationTables,
    factionSeeds, factionInterests, npcSeeds, sourceNotes, history, entity,
    identity, knowledge, zoneBuilder, zoneRuntime, copy, hash, random, day,
    relation, affectFaction, remember, log, advance
  }) {
    function activateSeed(state, id) {
      if (state.entities[id]) return state.entities[id];
      const seed = npcSeeds[id];
      if (!seed) throw new Error(`内容包中不存在 NPC：${id}`);
      const next = entity.createEntity(id, seed);
      state.entities[id] = next;
      if (state.facts.latentNpcs) delete state.facts.latentNpcs[id];
      remember(state, id, 'world', { kind: 'arrival', text: `${seed.name}进入了青茅山的公共视野。`, facts: { arrivedDay: day(state) } });
      log(state, 'world_arrival', `${seed.name}进入了当前区域的公共视野。`, { npcId: id });
      return next;
    }

    function openingEvent(state) {
      return {
        id: 'openingRite', type: 'rite', title: '开窍大典前的选择',
        text: '宗祖祠堂的灯火映在雨幕里。你可以把自己的真实资质交给家族，也可以先观察，再决定要让谁知道。',
        source: sourceNotes.academy,
        choices: [
          { id: 'reveal', label: '如实参加开窍大典', hint: '获得家族信任，减少隐匿空间。' },
          { id: 'observe', label: '先观察家老与同辈的反应', hint: '获得线索与秘密，降低初始公开度。' },
          { id: 'challenge', label: '主动展示胆识', hint: '提高威胁感，也可能让竞争者记住你。' }
        ]
      };
    }

    function applyOpening(state, choice) {
      const player = state.entities.player;
      state.flags.openingRiteResolved = true;
      state.events.active = null;
      if (choice === 'reveal') {
        relation(state, 'player', 'guYue').trust += 12;
        affectFaction(state, 'guYue', 5, -1);
        player.memory.facts.world.opening = '公开参加开窍大典';
        log(state, 'choice', '你如实参加开窍大典，家族开始把你视作可培养的变量。');
      } else if (choice === 'observe') {
        player.cultivation.insight += 4;
        player.cultivation.essence += 4;
        player.memory.facts.world.opening = '观察后再决定';
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

    function newWorld(options = {}) {
      const seed = String(options.seed ?? '青茅山');
      const aptitudeName = aptitude[options.aptitude] ? options.aptitude : '丙等';
      const state = {
        schema,
        content: { id: contentIndex.id, version: contentVersion },
        history: history.create(seed, { id: contentIndex.id, version: contentVersion }),
        contracts: { available: [], active: {}, completed: [] },
        seed,
        rng: hash(seed),
        clock: 6,
        playerId: 'player',
        entities: {},
        provenance: { sequence: 0, records: [] },
        consequences: { sequence: 0, records: [], counts: {} },
        locations: copy(locations),
        zones: {},
        factions: {},
        relationships: {},
        social: { sequence: 0, recent: [], lastActorClock: {} },
        logSequence: 0,
        facts: {},
        flags: { openingRiteResolved: false, moonlightRumor: false, relicDiscovered: false, marketArrived: false, auctionHeld: false, allianceCouncil: false, wolfTide: false, tournamentAnnounced: false, investigationArrived: false, merchantCityOpened: false, arenaTrial: false, threeKingsAwakened: false, heavenClimbRumor: false, northernFrontierOpened: false, blackCampaign: false, imperialCourtOpened: false, trueYangTowerFormed: false, foxFairyLandOpened: false, centralContinentOpened: false, immortalAuctionOpened: false, sectPressureActive: false, shadowSectRebuilt: false, fiveRegionsWarOpened: false, southernFrontOpened: false, westernFrontOpened: false, heavenlyCourtOpened: false, divineEmperorOpened: false, twoHeavensOpened: false, madDemonCaveOpened: false, dreamSurgeOpened: false, starHostPlanOpened: false },
        events: { active: null, pending: [], recent: [], history: [], sequence: 0 },
        combat: null,
        combatLedger: { sequence: 0, exchanges: [], lastPairClock: {} },
        arena: { location: 'merchantCity', active: false, matches: 0, wins: 0, losses: 0, streak: 0, reputation: 0 },
        inheritance: { location: 'threeForkMountain', active: false, attempts: 0, round: 0, difficulty: 1, discoveries: [], completed: false },
        frontier: { location: 'northernPlains', opened: false, supply: 72, campaignPressure: 0, battles: 0, casualties: 0 },
        tower: { location: 'trueYangTower', formed: false, floors: 0, attempts: 0, discoveries: [], active: false },
        central: { foxOpened: false, centralOpened: false, auctionActive: false, lotsSold: 0, auctionHeat: 0, sectPressure: 0, marketSupply: 72, marketScarcity: 28, rumorCredibility: 58, marketDebt: 0, marketReputation: 0, tracePressure: 0 },
        worldWar: { shadowRebuilt: false, fiveRegions: false, southern: false, western: false, heavenly: false, heat: 0 },
        eternalWar: { divineEmperor: false, twoHeavens: false, madDemonCave: false, dream: false, starHost: false, dreamPressure: 0, cosmicHeat: 0, dives: 0, successes: 0, failures: 0 },
        intel: { leads: [], cases: {} },
        pursuit: { teams: {}, sequence: 0, alert: 0, contacts: 0 },
        agency: { commissions: {}, sequence: 0, reputation: 0, completed: 0, failed: 0 },
        market: { prices: {}, supply: {}, demand: {}, transactions: [], day: 1 },
        director: { pressure: 0, lastTick: 0, thread: [], history: [], cooldowns: {}, beat: 'opening' },
        log: [],
        version: 1
      };
      for (const [id, faction] of Object.entries(factionSeeds)) state.factions[id] = { id, ...copy(faction), interests: copy(factionInterests[id] || {}), relations: {} };
      state.entities.player = entity.createEntity('player', {
        name: String(options.name || '古月族人').slice(0, 20), role: '玩家', faction: 'guYue', location: 'academy',
        cultivation: { rank: 1, stage: 0, aptitude: aptitude[aptitudeName], aptitudeName, progress: 0, essence: 32, essenceMax: 50, vitality: 100, insight: 8 },
        schedule: {}, goals: ['survive', 'grow']
      });
      state.entities.player.inventory = { water: 5, moonPetal: 6, wine: 1, stones: 8 };
      state.entities.player.body.health = state.entities.player.body.maxHealth;
      state.entities.player.needs = { energy: 92, hunger: 8, safety: 70 };
      identity.ensure(state.entities.player, knowledge);
      for (const [id, seedData] of Object.entries(npcSeeds)) {
        if (seedData.fromDay && seedData.fromDay > day(state)) { state.facts.latentNpcs ||= {}; state.facts.latentNpcs[id] = seedData.fromDay; }
        else state.entities[id] = entity.createEntity(id, seedData);
      }
      state.zones = zoneBuilder.buildZones(locations);
      zoneRuntime.ensureState(state, state.entities.player.position.location);
      zoneBuilder.seedPopulation(state, { locations, populationTables, random, createEntity: entity.createEntity });
      for (const id of Object.keys(state.entities)) remember(state, id, 'world', { kind: 'origin', text: '青茅山的雨季刚刚开始。', facts: { region: '青茅山' } });
      zoneRuntime.reconcile(state, state.entities.player.position.location);
      relation(state, 'player', 'fangyuan').fear = 4;
      relation(state, 'player', 'fangzheng').trust = 6;
      relation(state, 'player', 'guYue').trust = 8;
      const factionIds = Object.keys(state.factions);
      for (const a of factionIds) for (const b of factionIds) if (a !== b) state.factions[a].relations[b] = a === 'guYue' && ['bai', 'xiong', 'demonic'].includes(b) ? -24 : 0;
      state.events.active = openingEvent(state);
      log(state, 'world_started', `第${day(state)}日，青茅山的开窍大典即将开始。`, { source: sourceNotes.opening });
      return state;
    }

    return { newWorld, activateSeed, openingEvent, applyOpening };
  }

  return { createRuntime };
});
