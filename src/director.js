(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuSimulationDirector = factory();
})(globalThis, function () {
  'use strict';

  function tick(state, { engine, day, log }) {
    const director = state.director;
    if (state.events.active || state.clock - director.lastTick < 6) return null;
    const player = state.entities.player;
    const candidate = engine.findDirectorEvent(state);
    if (!candidate) return null;
    state.events.active = candidate;
    director.lastTick = state.clock;
    director.thread.push(candidate.id);
    engine.emit(state, 'director.event_available', { eventId: candidate.id, location: player.position.location, pressure: director.pressure });
    log(state, 'director_event', candidate.title, { eventId: candidate.id });
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
