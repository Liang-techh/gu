(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationGuState = factory();
})(globalThis, function () {
  'use strict';

  // Content-side save/state normalizer. The kernel calls one provider hook;
  // this package owns the Gu-specific state schema and numeric invariants.
  function createRuntime({ engine, social, combat, condition, consequence, knowledge, identity, equipment, brain, zoneRuntime, market, factionInterests, locations, localMap, localObjects, copy, clamp }) {
    function normalize(state) {
      const player = state.entities.player;
      social.ensure(state);
      state.social.recent = state.social.recent.slice(0, 128);
      state.encounters ||= { sequence: 0, recent: [], lastByNpc: {} };
      state.encounters.recent ||= []; state.encounters.lastByNpc ||= {};
      state.encounters.sequence = Math.max(0, Number(state.encounters.sequence) || 0);
      state.encounters.recent = state.encounters.recent.slice(0, 128);
      const knownEntityIds = new Set([...Object.keys(state.entities || {}), ...Object.keys(state.entityCache || {})]);
      for (const id of Object.keys(state.social.lastActorClock)) if (!knownEntityIds.has(id)) delete state.social.lastActorClock[id];
      combat.ensure(state);
      state.combatLedger.exchanges = state.combatLedger.exchanges.slice(0, 128);
      state.events ||= { active: null, pending: [], recent: [], history: [], sequence: 0 };
      state.events.pending ||= []; state.events.recent ||= []; state.events.history ||= [];
      state.events.pending = state.events.pending.slice(-128);
      state.events.recent = state.events.recent.slice(-256);
      state.events.history = state.events.history.slice(-512);
      state.logSequence = Math.max(Number(state.logSequence) || 0, state.events.history.reduce((max, entry) => Math.max(max, Number(String(entry.id || '').replace(/^e/, '')) || 0), 0));
      for (const entity of [...Object.values(state.entities || {}), ...Object.values(state.entityCache || {})]) {
        knowledge.ensure(entity); identity.ensure(entity, knowledge); equipment.ensure(entity); brain.ensure(entity);
        const locationId = entity.position?.location;
        if (localMap && locationId && locations?.[locationId]) entity.position.cell = localMap.normalizeCell(locationId, entity.position.cell, locations[locationId], entity.id);
      }
      engine.initializeComponents(state);
      zoneRuntime.ensureState(state, player?.position?.location);
      if (localObjects) localObjects.ensure(state);
      state.rebirth ||= { charges: 1, count: 0, scars: [], echoes: [] };
      state.rebirth.charges = clamp(Number(state.rebirth.charges) || 0, 0, 9);
      state.rebirth.count = Math.max(0, Number(state.rebirth.count) || 0);
      state.rebirth.scars ||= []; state.rebirth.echoes ||= [];
      state.rebirth.scars = state.rebirth.scars.slice(-8); state.rebirth.echoes = state.rebirth.echoes.slice(-16);
      state.wolfCrisis ||= { active: false, phase: 'distant', pressure: 0, supply: 54, casualties: 0, battles: 0, displacement: 0, relief: 0, lastTickDay: 0, alliance: { active: false, legitimacy: 0, obligations: {}, contributions: {} } };
      state.wolfCrisis.phase ||= 'distant'; state.wolfCrisis.alliance ||= { active: false, legitimacy: 0, obligations: {}, contributions: {} };
      state.wolfCrisis.alliance.obligations ||= {}; state.wolfCrisis.alliance.contributions ||= {};
      state.wolfCrisis.active = !!state.wolfCrisis.active; state.wolfCrisis.pressure = clamp(Number(state.wolfCrisis.pressure) || 0, 0, 100); state.wolfCrisis.supply = clamp(Number(state.wolfCrisis.supply) || 0, 0, 100); state.wolfCrisis.casualties = Math.max(0, Number(state.wolfCrisis.casualties) || 0); state.wolfCrisis.battles = Math.max(0, Number(state.wolfCrisis.battles) || 0); state.wolfCrisis.displacement = Math.max(0, Number(state.wolfCrisis.displacement) || 0); state.wolfCrisis.relief = Math.max(0, Number(state.wolfCrisis.relief) || 0); state.wolfCrisis.lastTickDay = Math.max(0, Number(state.wolfCrisis.lastTickDay) || 0); state.wolfCrisis.alliance.legitimacy = clamp(Number(state.wolfCrisis.alliance.legitimacy) || 0, -100, 100);
      state.marketShock ||= { active: false, phase: 'quiet', kind: 'storm', severity: 0, days: 0, supplyLoss: 0, priceShock: 0, displaced: 0, relief: 0, resolved: false, responses: {} };
      state.marketShock.phase ||= 'quiet'; state.marketShock.kind ||= 'storm'; state.marketShock.responses ||= {};
      state.marketShock.active = !!state.marketShock.active; state.marketShock.severity = clamp(Number(state.marketShock.severity) || 0, 0, 100); state.marketShock.days = Math.max(0, Number(state.marketShock.days) || 0); state.marketShock.supplyLoss = Math.max(0, Number(state.marketShock.supplyLoss) || 0); state.marketShock.priceShock = clamp(Number(state.marketShock.priceShock) || 0, 0, 100); state.marketShock.displaced = Math.max(0, Number(state.marketShock.displaced) || 0); state.marketShock.relief = Math.max(0, Number(state.marketShock.relief) || 0); state.marketShock.resolved = !!state.marketShock.resolved;
      state.contracts ||= { available: [], active: {}, completed: [] };
      state.contracts.available ||= []; state.contracts.active ||= {}; state.contracts.completed ||= [];
      state.arena ||= { location: 'merchantCity', active: false, matches: 0, wins: 0, losses: 0, streak: 0, reputation: 0 };
      state.inheritance ||= { location: 'threeForkMountain', active: false, attempts: 0, round: 0, difficulty: 1, discoveries: [], completed: false };
      state.frontier ||= { location: 'northernPlains', opened: false, supply: 72, campaignPressure: 0, battles: 0, casualties: 0 };
      state.tower ||= { location: 'trueYangTower', formed: false, floors: 0, attempts: 0, discoveries: [], active: false };
      state.central ||= { foxOpened: false, centralOpened: false, auctionActive: false, lotsSold: 0, auctionHeat: 0, sectPressure: 0, marketSupply: 72, marketScarcity: 28, rumorCredibility: 58, marketDebt: 0, marketReputation: 0, tracePressure: 0 };
      state.blessedLand ||= { location: 'foxFairyLand', active: false, hidden: false, resources: 72, defense: 48, soulReserve: 34, residents: 4, reputation: 0, maintenance: 0, sectPressure: 0, upgrades: { housing: 0, defense: 0, production: 0 }, commissions: {}, lastTickDay: 0 };
      state.blessedLand.location ||= 'foxFairyLand'; state.blessedLand.upgrades ||= { housing: 0, defense: 0, production: 0 }; state.blessedLand.commissions ||= {};
      state.blessedLand.active = !!state.blessedLand.active; state.blessedLand.hidden = !!state.blessedLand.hidden; state.blessedLand.resources = clamp(Number(state.blessedLand.resources) || 0, 0, 200); state.blessedLand.defense = clamp(Number(state.blessedLand.defense) || 0, 0, 100); state.blessedLand.soulReserve = clamp(Number(state.blessedLand.soulReserve) || 0, 0, 100); state.blessedLand.residents = clamp(Number(state.blessedLand.residents) || 0, 0, 40); state.blessedLand.reputation = clamp(Number(state.blessedLand.reputation) || 0, -100, 100); state.blessedLand.maintenance = Math.max(0, Number(state.blessedLand.maintenance) || 0); state.blessedLand.sectPressure = clamp(Number(state.blessedLand.sectPressure) || 0, 0, 100); state.blessedLand.lastTickDay = Math.max(0, Number(state.blessedLand.lastTickDay) || 0);
      for (const key of ['housing', 'defense', 'production']) state.blessedLand.upgrades[key] = clamp(Number(state.blessedLand.upgrades[key]) || 0, 0, 10);
      state.shadowNetwork ||= { active: false, visibility: 18, cohesion: 26, resources: 28, recruits: 1, intelligence: 0, exposure: 12, betrayals: 0, lastTickDay: 0, sequence: 0, nodes: {}, operations: [] };
      state.shadowNetwork.nodes ||= {}; state.shadowNetwork.operations ||= []; state.shadowNetwork.operations = state.shadowNetwork.operations.slice(-128);
      const shadowNodeDefaults = { ruins: { id: 'ruins', location: 'shadowSectRuins', active: false, control: 35, supply: 34, secrecy: 72, contacts: 1 }, blessedLand: { id: 'blessedLand', location: 'foxFairyLand', active: false, control: 12, supply: 18, secrecy: 54, contacts: 0 }, central: { id: 'central', location: 'centralContinent', active: false, control: 8, supply: 12, secrecy: 38, contacts: 0 } };
      for (const [id, defaults] of Object.entries(shadowNodeDefaults)) { state.shadowNetwork.nodes[id] = { ...defaults, ...(state.shadowNetwork.nodes[id] || {}) }; const node = state.shadowNetwork.nodes[id]; node.active = !!node.active; node.control = clamp(Number(node.control) || 0, 0, 100); node.supply = clamp(Number(node.supply) || 0, 0, 100); node.secrecy = clamp(Number(node.secrecy) || 0, 0, 100); node.contacts = Math.max(0, Number(node.contacts) || 0); }
      state.shadowNetwork.active = !!state.shadowNetwork.active; state.shadowNetwork.visibility = clamp(Number(state.shadowNetwork.visibility) || 0, 0, 100); state.shadowNetwork.cohesion = clamp(Number(state.shadowNetwork.cohesion) || 0, 0, 100); state.shadowNetwork.resources = clamp(Number(state.shadowNetwork.resources) || 0, 0, 200); state.shadowNetwork.recruits = Math.max(0, Number(state.shadowNetwork.recruits) || 0); state.shadowNetwork.intelligence = Math.max(0, Number(state.shadowNetwork.intelligence) || 0); state.shadowNetwork.exposure = clamp(Number(state.shadowNetwork.exposure) || 0, 0, 100); state.shadowNetwork.betrayals = Math.max(0, Number(state.shadowNetwork.betrayals) || 0); state.shadowNetwork.lastTickDay = Math.max(0, Number(state.shadowNetwork.lastTickDay) || 0); state.shadowNetwork.sequence = Math.max(0, Number(state.shadowNetwork.sequence) || 0);
      state.central.marketSupply ??= 72; state.central.marketScarcity ??= 28; state.central.rumorCredibility ??= 58; state.central.marketDebt ??= 0; state.central.marketReputation ??= 0; state.central.tracePressure ??= 0;
      state.worldWar ||= { shadowRebuilt: false, fiveRegions: false, southern: false, western: false, heavenly: false, heat: 0, lastTickDay: 0, operations: [], fronts: {} };
      state.worldWar.operations ||= []; state.worldWar.operations = state.worldWar.operations.slice(-128); state.worldWar.fronts ||= {};
      const frontDefaults = {
        central: { id: 'central', location: 'centralContinent', active: false, supply: 62, pressure: 0, control: 55, battles: 0, casualties: 0, commanderId: null, primaryFaction: 'centralSects', opposingFaction: 'shadowSect', lastActionDay: 0 },
        southern: { id: 'southern', location: 'southernBorder', active: false, supply: 58, pressure: 0, control: 50, battles: 0, casualties: 0, commanderId: null, primaryFaction: 'southernSuperClans', opposingFaction: 'centralSects', lastActionDay: 0 },
        western: { id: 'western', location: 'westernDesert', active: false, supply: 58, pressure: 0, control: 50, battles: 0, casualties: 0, commanderId: null, primaryFaction: 'westernDesertFang', opposingFaction: 'centralSects', lastActionDay: 0 },
        heavenly: { id: 'heavenly', location: 'heavenlyCourt', active: false, supply: 70, pressure: 0, control: 62, battles: 0, casualties: 0, commanderId: null, primaryFaction: 'heavenlyCourt', opposingFaction: 'twoHeavensForces', lastActionDay: 0 }
      };
      for (const [id, defaults] of Object.entries(frontDefaults)) { state.worldWar.fronts[id] = { ...defaults, ...(state.worldWar.fronts[id] || {}) }; const front = state.worldWar.fronts[id]; front.active = !!front.active; front.supply = clamp(Number(front.supply) || 0, 0, 100); front.pressure = clamp(Number(front.pressure) || 0, 0, 100); front.control = clamp(Number(front.control) || 0, 0, 100); front.battles = Math.max(0, Number(front.battles) || 0); front.casualties = Math.max(0, Number(front.casualties) || 0); front.lastActionDay = Math.max(0, Number(front.lastActionDay) || 0); }
      state.worldWar.lastTickDay = Math.max(0, Number(state.worldWar.lastTickDay) || 0);
      state.eternalWar ||= { divineEmperor: false, twoHeavens: false, madDemonCave: false, dream: false, starHost: false, dreamPressure: 0, cosmicHeat: 0, dives: 0, successes: 0, failures: 0 };
      state.coalitions ||= { sequence: 0, diplomacyPressure: 0, lastTickDay: 0, pacts: {}, history: [] };
      state.coalitions.pacts ||= {}; state.coalitions.history ||= []; state.coalitions.history = state.coalitions.history.slice(-128);
      state.coalitions.sequence = Math.max(0, Number(state.coalitions.sequence) || 0); state.coalitions.diplomacyPressure = clamp(Number(state.coalitions.diplomacyPressure) || 0, 0, 100); state.coalitions.lastTickDay = Math.max(0, Number(state.coalitions.lastTickDay) || 0);
      for (const [id, pact] of Object.entries(state.coalitions.pacts)) { pact.id ||= id; pact.members = [...new Set((pact.members || []).filter(Boolean).map(String))].sort(); pact.status ||= 'active'; pact.legitimacy = clamp(Number(pact.legitimacy ?? 50), -100, 100); pact.cohesion = clamp(Number(pact.cohesion ?? 50), 0, 100); pact.supply = clamp(Number(pact.supply ?? 50), 0, 100); pact.obligations ||= {}; pact.history ||= []; pact.history = pact.history.slice(0, 24); pact.actions = Math.max(0, Number(pact.actions) || 0); pact.defections = Math.max(0, Number(pact.defections) || 0); for (const member of pact.members) pact.obligations[member] = clamp(Number(pact.obligations[member]) || 0, 0, 100); }
      state.intel ||= { leads: [], cases: {} }; state.intel.leads ||= []; state.intel.cases ||= {};
      consequence.ensure(state); state.consequences.records = state.consequences.records.slice(0, 256);
      state.provenance ||= { sequence: 0, records: [] }; state.provenance.records ||= []; state.provenance.records = state.provenance.records.slice(0, 512);
      state.intel.leads = state.intel.leads.slice(0, 256);
      state.pursuit ||= { teams: {}, sequence: 0, alert: 0, contacts: 0 }; state.pursuit.teams ||= {}; state.pursuit.sequence = Math.max(0, Number(state.pursuit.sequence) || 0); state.pursuit.alert = clamp(Number(state.pursuit.alert) || 0, 0, 100); state.pursuit.contacts = Math.max(0, Number(state.pursuit.contacts) || 0);
      state.agency ||= { commissions: {}, sequence: 0, reputation: 0, completed: 0, failed: 0 }; state.agency.commissions ||= {}; state.agency.sequence = Math.max(0, Number(state.agency.sequence) || 0); state.agency.reputation = clamp(Number(state.agency.reputation) || 0, -100, 100); state.agency.completed = Math.max(0, Number(state.agency.completed) || 0); state.agency.failed = Math.max(0, Number(state.agency.failed) || 0);
      state.market ||= { prices: {}, supply: {}, demand: {}, transactions: [], day: 1 }; market.ensure(state); state.market.transactions = state.market.transactions.slice(0, 256);
      state.director ||= { pressure: 0, lastTick: 0, thread: [], history: [], cooldowns: {}, beat: 'opening' };
      state.director.thread ||= []; state.director.history ||= []; state.director.cooldowns ||= {};
      state.arena.matches = Math.max(0, Number(state.arena.matches) || 0); state.arena.wins = Math.max(0, Number(state.arena.wins) || 0); state.arena.losses = Math.max(0, Number(state.arena.losses) || 0); state.arena.streak = Math.max(0, Number(state.arena.streak) || 0); state.arena.reputation = Math.max(0, Number(state.arena.reputation) || 0);
      state.inheritance.attempts = Math.max(0, Number(state.inheritance.attempts) || 0); state.inheritance.round = Math.max(0, Number(state.inheritance.round) || 0); state.inheritance.difficulty = Math.max(1, Number(state.inheritance.difficulty) || 1); state.inheritance.discoveries ||= [];
      state.inheritance.clues ||= []; state.inheritance.clues = state.inheritance.clues.slice(-24); state.inheritance.clueConfidence = clamp(Number(state.inheritance.clueConfidence) || 0, 0, 1); state.inheritance.qualification = Math.max(0, Number(state.inheritance.qualification) || 0); state.inheritance.rivalProgress ||= {}; state.inheritance.greed = Math.max(0, Number(state.inheritance.greed) || 0); state.inheritance.wrongTurns = Math.max(0, Number(state.inheritance.wrongTurns) || 0); state.inheritance.window = clamp(Number(state.inheritance.window) || 0, 0, 100);
      state.frontier.supply = clamp(Number(state.frontier.supply) || 0, 0, 100); state.frontier.campaignPressure = clamp(Number(state.frontier.campaignPressure) || 0, 0, 100); state.frontier.battles = Math.max(0, Number(state.frontier.battles) || 0); state.frontier.casualties = Math.max(0, Number(state.frontier.casualties) || 0);
      state.tower.floors = Math.max(0, Number(state.tower.floors) || 0); state.tower.attempts = Math.max(0, Number(state.tower.attempts) || 0); state.tower.discoveries ||= [];
      state.central.lotsSold = Math.max(0, Number(state.central.lotsSold) || 0); state.central.auctionHeat = clamp(Number(state.central.auctionHeat) || 0, 0, 100); state.central.sectPressure = clamp(Number(state.central.sectPressure) || 0, 0, 100); state.central.marketSupply = clamp(Number(state.central.marketSupply) || 0, 0, 100); state.central.marketScarcity = clamp(Number(state.central.marketScarcity) || 0, 0, 100); state.central.rumorCredibility = clamp(Number(state.central.rumorCredibility) || 0, 0, 100); state.central.marketDebt = clamp(Number(state.central.marketDebt) || 0, 0, 100); state.central.marketReputation = clamp(Number(state.central.marketReputation) || 0, -100, 100); state.central.tracePressure = clamp(Number(state.central.tracePressure) || 0, 0, 100);
      state.worldWar.heat = clamp(Number(state.worldWar.heat) || 0, 0, 100);
      state.eternalWar.dreamPressure = clamp(Number(state.eternalWar.dreamPressure) || 0, 0, 100);
      state.eternalWar.cosmicHeat = clamp(Number(state.eternalWar.cosmicHeat) || 0, 0, 100);
      state.eternalWar.dives = Math.max(0, Number(state.eternalWar.dives) || 0);
      state.eternalWar.successes = Math.max(0, Number(state.eternalWar.successes) || 0);
      state.eternalWar.failures = Math.max(0, Number(state.eternalWar.failures) || 0);
      state.dreamRealm ||= { active: false, control: 46, pressure: 18, resources: 26, contamination: 12, lastTickDay: 0, sequence: 0, claims: { dreamPathForces: 42, centralSects: 32, twoHeavensForces: 26 }, operations: [] };
      state.dreamRealm.claims ||= { dreamPathForces: 42, centralSects: 32, twoHeavensForces: 26 }; state.dreamRealm.operations ||= []; state.dreamRealm.operations = state.dreamRealm.operations.slice(-128);
      state.dreamRealm.active = !!state.dreamRealm.active; state.dreamRealm.control = clamp(Number(state.dreamRealm.control) || 0, 0, 100); state.dreamRealm.pressure = clamp(Number(state.dreamRealm.pressure) || 0, 0, 100); state.dreamRealm.resources = clamp(Number(state.dreamRealm.resources) || 0, 0, 200); state.dreamRealm.contamination = clamp(Number(state.dreamRealm.contamination) || 0, 0, 100); state.dreamRealm.lastTickDay = Math.max(0, Number(state.dreamRealm.lastTickDay) || 0); state.dreamRealm.sequence = Math.max(0, Number(state.dreamRealm.sequence) || 0);
      for (const id of ['dreamPathForces', 'centralSects', 'twoHeavensForces']) state.dreamRealm.claims[id] = clamp(Number(state.dreamRealm.claims[id]) || 0, 0, 100);
      for (const entity of engine.queryWith(state, 'cultivation')) {
        condition.ensure(entity);
        const cultivation = entity.cultivation;
        cultivation.rank = clamp(Number(cultivation.rank) || 1, 1, 9);
        cultivation.stage = clamp(Number(cultivation.stage) || 0, 0, 3);
        cultivation.aptitude = clamp(Number(cultivation.aptitude) || 0.45, 0, 1);
        cultivation.progress = clamp(Number(cultivation.progress) || 0, 0, 100);
        cultivation.insight = Math.max(0, Number(cultivation.insight) || 0);
        cultivation.essenceMax = Math.max(20, Math.round(34 + cultivation.aptitude * 38 + cultivation.stage * 8 + (cultivation.rank - 1) * 12));
        cultivation.essence = clamp(Number(cultivation.essence) || 0, 0, cultivation.essenceMax);
      }
      player.cultivation.rank = clamp(player.cultivation.rank, 1, 9);
      player.cultivation.stage = clamp(player.cultivation.stage, 0, 3);
      player.cultivation.essenceMax = Math.max(20, Math.round(34 + player.cultivation.aptitude * 38 + player.cultivation.stage * 8 + (player.cultivation.rank - 1) * 12));
      player.cultivation.essence = clamp(player.cultivation.essence, 0, player.cultivation.essenceMax);
      player.cultivation.progress = clamp(player.cultivation.progress, 0, 100);
      player.cultivation.vitality = clamp(player.cultivation.vitality, 0, 100);
      if (!player.body) player.body = { maxHealth: 78, health: 78, wounds: [], limbs: { head: 100, torso: 100, leftArm: 100, rightArm: 100, leftLeg: 100, rightLeg: 100 } };
      player.body.maxHealth = Math.max(1, Number(player.body.maxHealth) || 78);
      player.body.health = clamp(Number(player.body.health) || 0, 0, player.body.maxHealth);
      player.cultivation.vitality = clamp((player.body.health / player.body.maxHealth) * 100, 0, 100);
      for (const entity of engine.queryWith(state, 'body', 'alive')) {
        entity.body.maxHealth = Math.max(1, Number(entity.body.maxHealth) || 1);
        entity.body.health = clamp(Number(entity.body.health) || 0, 0, entity.body.maxHealth);
        if (entity.body.health <= 0) entity.alive = false;
      }
      player.needs.energy = clamp(player.needs.energy, 0, 100);
      player.needs.hunger = clamp(player.needs.hunger, 0, 100);
      for (const faction of Object.values(state.factions)) {
        faction.interests ||= copy(factionInterests[faction.id] || {});
        market.ensureFaction(faction);
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
      zoneRuntime.reconcile(state, player?.position?.location);
      return state;
    }

    return { normalize };
  }

  return { createRuntime };
});
