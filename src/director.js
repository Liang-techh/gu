(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationDirector = factory();
})(globalThis, function () {
  'use strict';

  function tick(state, { engine, day, log }) {
    const director = state.director;
    if (state.events.active || state.clock - director.lastTick < 6) return null;
    const player = state.entities.player;
    director.cooldowns ||= {};
    director.history ||= [];
    const candidates = (engine.findDirectorEvents ? engine.findDirectorEvents(state) : [{ rule: {}, event: engine.findDirectorEvent(state) }])
      .filter(candidate => candidate.event && (!director.cooldowns[candidate.rule.id] || director.cooldowns[candidate.rule.id] <= state.clock))
      .map(candidate => ({ ...candidate, score: (candidate.rule.priority || 0) + (typeof candidate.rule.score === 'function' ? candidate.rule.score(state, candidate.event) : 0) }))
      .sort((a, b) => b.score - a.score || (b.rule.priority || 0) - (a.rule.priority || 0) || String(a.event.id).localeCompare(String(b.event.id)));
    const selected = candidates[0];
    if (!selected) return null;
    const candidate = selected.event;
    const cooldownHours = Number(selected.rule.cooldownHours || candidate.cooldownHours || 0);
    if (cooldownHours > 0) director.cooldowns[selected.rule.id] = state.clock + cooldownHours;
    state.events.active = candidate;
    director.lastTick = state.clock;
    director.thread.push(candidate.id);
    director.history.unshift({ id: candidate.id, ruleId: selected.rule.id, clock: state.clock, score: selected.score });
    director.history = director.history.slice(0, 64);
    engine.emit(state, 'director.event_available', { eventId: candidate.id, location: player.position.location, pressure: director.pressure });
    log(state, 'director_event', candidate.title, { eventId: candidate.id, ruleId: selected.rule.id, score: selected.score });
    return candidate;
  }

  function resolve(state, choice, { engine, advance }) {
    const event = state.events.active;
    if (!event) throw new Error('当前没有待处理事件');
    if (!event.choices.some(item => item.id === choice)) throw new Error('无效的事件选择');
    state.events.active = null;
    const handled = engine.runEvent(event.id, { state, event, choice });
    if (handled === false) throw new Error(`没有注册的事件处理器：${event.id}`);
    if (event.id !== 'openingRite') advance(state, 1, event.id);
    return handled;
  }

  return { tick, resolve };
});
