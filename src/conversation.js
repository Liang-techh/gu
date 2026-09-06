(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationConversation = factory();
})(globalThis, function () {
  'use strict';

  function relationKey(a, b) { return [a, b].sort().join('::'); }

  function available(definition, state, npcId, { day }) {
    const npc = state.entities[npcId];
    const player = state.entities.player;
    if (!npc?.alive || !player || npc.position.location !== player.position.location) return false;
    if (day(state) < (definition.availableFromDay || 1)) return false;
    if (definition.locations?.length && !definition.locations.includes(player.position.location)) return false;
    if ((definition.flags || []).some(flag => !state.flags[flag])) return false;
    const relation = state.relationships[relationKey('player', npcId)] || {};
    if (relation.trust < (definition.minTrust || -Infinity)) return false;
    return true;
  }

  function list(definitions, state, npcId, context) {
    return definitions.filter(definition => definition.speaker === npcId && available(definition, state, npcId, context));
  }

  function resolve(definitions, state, command, context) {
    const definition = definitions.find(item => item.id === command.conversationId);
    if (!definition || definition.speaker !== command.target || !available(definition, state, command.target, context)) throw new Error('当前没有这段可用对话');
    const choice = definition.choices.find(item => item.id === command.choiceId);
    if (!choice) throw new Error('无效的对话选项');
    const effects = choice.effects || {};
    const relation = context.relation(state, 'player', command.target);
    relation.trust += effects.trust || 0;
    relation.fear += effects.fear || 0;
    relation.debt += effects.debt || 0;
    if (effects.insight) state.entities.player.cultivation.insight += effects.insight;
    if (effects.progress) state.entities.player.cultivation.progress += effects.progress;
    if (effects.faction) context.affectFaction(state, effects.faction.id, effects.faction.attitude || 0, effects.faction.tension || 0);
    if (effects.playerFacts) context.remember(state, 'player', 'world', { kind: 'conversation', valence: effects.valence || 1, text: choice.text, facts: effects.playerFacts });
    if (effects.npcFacts) context.remember(state, command.target, 'player', { kind: 'conversation', valence: effects.valence || 1, text: choice.text, facts: effects.npcFacts });
    context.log(state, 'conversation', `${state.entities[command.target].identity.name}：${choice.text}`, { conversationId: definition.id, choiceId: choice.id });
    return { definition, choice };
  }

  return { available, list, resolve };
});
