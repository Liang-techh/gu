(function () {
  'use strict';
  const S = window.GuSimulation;
  const KEY = 'gu-simulation-save-v2';
  const app = document.getElementById('app');
  let state = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const locName = id => S.LOCATIONS[id]?.name || id;
  const timeText = s => `第${S.day(s)}日 · ${String(S.hour(s)).padStart(2, '0')}:00 · ${s.entities.player.needs.energy < 30 ? '疲惫' : '行动中'}`;
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const load = () => { const raw = localStorage.getItem(KEY); if (!raw) return null; try { return S.validate(raw); } catch { return null; } };
  const button = (label, command, disabled = false, cls = '') => `<button class="action ${cls}" data-command='${esc(JSON.stringify(command))}' ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;

  function startScreen() {
    app.innerHTML = `<section class="landing">
      <div class="kicker">SIMULATION-FIRST RPG · 青茅山</div>
      <h1>蛊真人<br><span>不是重放小说，而是让世界继续运转</span></h1>
      <p class="lead">人物会按自己的目标行动，势力会积累压力，NPC 会记住你做过的事。小说原文提供人物、地点与因果素材；最终发生什么，由世界状态和你的行动共同决定。</p>
      <div class="setup-grid">
        <label>称呼<input id="new-name" maxlength="20" value="古月族人"></label>
        <label>资质<select id="new-aptitude"><option>丙等</option><option>乙等</option><option>甲等</option><option>丁等</option></select></label>
        <label>世界种子<input id="new-seed" maxlength="60" value="青茅山"></label>
      </div>
      <div class="landing-actions"><button class="primary" id="new-game">进入持续世界</button>${load() ? '<button id="continue-game">继续上次世界</button>' : ''}</div>
      <p class="source-note">内容依据仓库 <code>reference/novel</code> 的原文素材重构；引擎只接受经过规则验证的行动结果。</p>
    </section>`;
    document.getElementById('new-game').onclick = () => { state = S.newWorld({ name: document.getElementById('new-name').value, aptitude: document.getElementById('new-aptitude').value, seed: document.getElementById('new-seed').value }); save(); render(); };
    document.getElementById('continue-game')?.addEventListener('click', () => { state = load(); render(); });
  }

  function eventPanel(s) {
    const e = s.events.active;
    if (!e) return '';
    return `<section class="director-event"><div class="event-tag">世界导演 · ${esc(e.type)}</div><h2>${esc(e.title)}</h2><p>${esc(e.text)}</p><div class="choice-grid">${e.choices.map(c => button(c.label, { type: 'resolve_event', choice: c.id }, false, 'choice')).join('')}</div><small>${esc(e.source?.note || '这是由当前世界状态生成的事件。')}</small></section>`;
  }

  function nearbyPanel(s) {
    const p = s.entities.player;
    const people = Object.values(s.entities).filter(e => e.id !== 'player' && e.alive && e.position.location === p.position.location);
    if (!people.length) return '<div class="empty">这里暂时没有熟人，只有风、雨和你的判断。</div>';
    return people.map(e => { const r = s.relationships[[e.id, 'player'].sort().join('::')] || {}; const latest = e.memory.episodes[0]; const offers = (s.contracts?.available || []).map(id => S.CONTRACT_DEFS.find(def => def.id === id)).filter(def => def?.giver === e.id && def.locations.includes(p.position.location)); const active = Object.values(s.contracts?.active || {}).map(item => S.CONTRACT_DEFS.find(def => def.id === item.id)).filter(def => def?.giver === e.id); return `<article class="person-card"><div><strong>${esc(e.identity.name)}</strong><span>${esc(e.identity.role)}</span></div><p>目标：${esc(e.goals.active || '观望')} · 信任 ${Math.round(r.trust || 0)} · 畏惧 ${Math.round(r.fear || 0)}</p>${latest ? `<small>记忆：${esc(latest.text)}</small>` : ''}<div class="inline-actions">${button('交谈', { type: 'action', id: 'talk', target: e.id, mode: 'listen' })}${button('帮助', { type: 'action', id: 'talk', target: e.id, mode: 'help' })}${button('施压', { type: 'action', id: 'talk', target: e.id, mode: 'threaten' })}${button('挑战', { type: 'action', id: 'challenge', target: e.id }, false, 'danger')}${offers.map(def => button('接受委托', { type: 'action', id: 'accept_contract', contractId: def.id }, false, 'choice')).join('')}${active.map(def => button('交付委托', { type: 'action', id: 'complete_contract', contractId: def.id }, false, 'choice')).join('')}</div></article>`; }).join('');
  }

  function render() {
    if (!state) return startScreen();
    const snap = S.snapshot(state); const p = snap.player; const here = state.entities.player.position.location; const zone = snap.zone;
    const gu = p.inventory.gu || {};
    app.innerHTML = `<div class="shell">
      <header class="topbar"><div><div class="kicker">青茅山 · 持续世界</div><h1>${esc(p.name)}</h1><p>${esc(timeText(state))} · ${esc(locName(here))}</p></div><div class="top-actions"><button id="save-game">保存</button><button id="new-world">新世界</button></div></header>
      ${eventPanel(state)}
      ${combatPanel(state)}
      <section class="dashboard">
        <div class="main-column">
          <article class="scene"><div class="scene-label">当前场景</div><h2>${esc(locName(here))}</h2><p>${esc(sceneText(here))}</p><div class="zone-meta"><span>天气 ${esc(zone.weather)}</span><span>危险 ${Math.round(zone.danger)}</span><span>区域活动 ${Math.round(zone.activity)}</span><span>人口 ${Math.round(zone.population)}</span></div><div class="meter-row"><span>生命</span><b>${Math.round(p.vitality)}%</b><i><em style="width:${p.vitality}%"></em></i></div><div class="meter-row"><span>真元</span><b>${Math.round(p.essence)} / ${p.essenceMax}</b><i><em style="width:${(p.essence / p.essenceMax) * 100}%"></em></i></div><div class="meter-row"><span>修为</span><b>${Math.round(p.progress)}%</b><i><em style="width:${p.progress}%"></em></i></div></article>
          <article class="panel"><div class="panel-title"><h2>行动</h2><span>所有按钮都会推进世界时间</span></div><div class="action-grid">${actionButtons(state)}</div><div class="command-row"><input id="free-command" placeholder="自由描述：去竹林、修炼、和方正说话……"><button id="run-command">执行</button></div></article>
          <article class="panel"><div class="panel-title"><h2>同场人物</h2><span>他们会移动，也会记住你</span></div><div class="people-grid">${nearbyPanel(state)}</div></article>
        </div>
        <aside class="side-column">
          <article class="panel compact"><div class="panel-title"><h2>世界状态</h2><span>导演压力 ${state.director.pressure}/10</span></div>${snap.factions.map(f => `<div class="faction-row"><div><strong>${esc(f.name)}</strong><small>影响力 ${Math.round(f.influence)} · 态度 ${Math.round(f.attitude)}</small></div><i><em style="width:${f.tension}%"></em></i><small>紧张 ${Math.round(f.tension)}</small></div>`).join('')}</article>
          <article class="panel compact"><div class="panel-title"><h2>历史账本</h2><span>观测 ${snap.history.facts.daysObserved || 1} 日</span></div><div class="log history-log">${snap.history.recent.slice(0, 6).map(e => `<p><time>日${e.day}</time>${esc(e.text)}</p>`).join('')}</div></article>
          <article class="panel compact"><div class="panel-title"><h2>行囊与组件</h2><span>数据不是 UI 状态</span></div><div class="inventory">${Object.entries(p.inventory).filter(([k]) => k !== 'gu').map(([k,v]) => `<span>${esc(itemName(k))}<b>${esc(v)}</b></span>`).join('')}${Object.entries(gu).map(([k,v]) => `<span>${esc(S.GU_SEEDS[k]?.name || k)}<b>${v.refined ? '已炼化' : Math.round(v.progress) + '%'}</b></span>`).join('')}</div></article>
          <article class="panel compact log-panel"><div class="panel-title"><h2>事件流</h2><span>最近 ${snap.log.length} 条</span></div><div class="log">${snap.log.map(e => `<p><time>日${e.day} ${String(e.clock % 24).padStart(2, '0')}:00</time>${esc(e.text)}</p>`).join('')}</div></article>
        </aside>
      </section>
      <footer><span>世界种子：${esc(state.seed)} · schema ${state.schema}</span><span>状态、事件、记忆和势力均可存档恢复</span></footer>
    </div>`;
    wire();
  }

  function sceneText(id) {
    const texts = { academy: '雨水敲在学堂檐角。家老在观察谁更像一块值得下注的玉，少年们也在互相寻找破绽。', village: '吊楼的灯火沿山腰铺开。这里有家族秩序，也有交易、传闻和无法被写进族谱的秘密。', ancestralHall: '香火和权力在同一座祠堂里升起。每一句话都会被不同的人解释成不同的立场。', bambooForest: '竹叶洗过雨，气味比记忆更诚实。这里的机缘不会主动等人，但也不会因为主线没有安排就消失。', riverbank: '山溪把脚印和酒香带向更深处。水面平静，水下的因果并不平静。', cliffCave: '石缝里残留着不属于今夜的痕迹。你看到的每一件东西，都可能成为别人的记忆。', caravanCamp: '商队暂时停在寨外，货物、消息和立场一起流动。', whiteBoneMountain: '白骨山道脱离了山寨的保护，赶路、补给和伏击都成为独立的生存问题。', merchantCity: '商家城把交易、演武、贵宾身份和家族派系压缩在城墙之内。每一次胜负都会改变你的价格。', threeForkMountain: '三叉山的三道传承光柱周期性开启。传承不是宝箱，而是会消耗队伍、抬高难度并制造新的敌人。', heavenClimbMountain: '天梯山的传承消息来自更高层级的门派世界。这里的竞争不只比较蛊力，也比较意志与资格。' }; return texts[id] || '世界在自行运转。';
  }
  function combatPanel(s) {
    const c = s.combat;
    if (!c) return '';
    const target = s.entities[c.defender];
    return `<section class="director-event combat-event"><div class="event-tag">冲突 · 第 ${c.round} 回合</div><h2>你与${esc(target?.identity.name || '未知目标')}正在交锋</h2><p>伤势会写入双方身体组件和记忆。其他行动暂时不可用。</p><div class="choice-grid">${button('攻击', { type: 'combat', id: 'attack' }, false, 'choice')}${button('催动月光蛊', { type: 'combat', id: 'gu' }, false, 'choice')}${button('防守', { type: 'combat', id: 'guard' }, false, 'choice')}${button('脱身', { type: 'combat', id: 'flee' }, false, 'choice')}</div><small>你的身体：${Math.round(s.entities.player.body.health)} / ${Math.round(s.entities.player.body.maxHealth)} · 对方：${Math.round(target?.body.health || 0)} / ${Math.round(target?.body.maxHealth || 0)}</small></section>`;
  }
  function itemName(id) { return ({ water: '清水', moonPetal: '月兰花瓣', wine: '酒', stones: '元石', food: '食物', relicFragment: '遗藏碎片' }[id] || id); }
  function actionButtons(s) {
    const here = s.entities.player.position.location; const out = [button('修炼', { type: 'action', id: 'cultivate' }), button('等待两小时', { type: 'action', id: 'wait', hours: 2 }), button('休息', { type: 'action', id: 'rest' })];
    if (here === 'academy') out.unshift(button('听课', { type: 'action', id: 'study' }));
    if (['bambooForest', 'riverbank', 'cliffCave'].includes(here)) out.unshift(button('探索 / 采集', { type: 'action', id: 'gather' }));
    if (here === 'academy' || here === 'village') out.push(button('炼化月光蛊', { type: 'action', id: 'refine', guId: 'moonlight' }));
    if (here === 'merchantCity' && s.arena.active) out.push(button(`参加演武（${s.arena.wins}胜/${s.arena.matches}场）`, { type: 'action', id: 'arena_match' }, false, 'choice'));
    if (here === 'threeForkMountain' && s.inheritance.active && !s.inheritance.completed) out.push(button(`挑战传承第${s.inheritance.round + 1}轮`, { type: 'action', id: 'inheritance_round' }, false, 'choice'));
    return out.concat(S.LOCATIONS[here].neighbors.map(id => button(`去${S.LOCATIONS[id].name}`, { type: 'action', id: 'travel', location: id }, false, 'travel')));
  }
  function wire() {
    document.querySelectorAll('[data-command]').forEach(el => el.addEventListener('click', () => run(JSON.parse(el.dataset.command))));
    document.getElementById('save-game').onclick = () => { save(); toast('世界已保存。'); };
    document.getElementById('new-world').onclick = () => { if (confirm('新世界会替换本地存档，确定继续吗？')) { localStorage.removeItem(KEY); state = null; startScreen(); } };
    document.getElementById('run-command').onclick = () => { const input = document.getElementById('free-command'); const parsed = S.interpret(input.value, state); if (!parsed.ok) return toast(parsed.message); run(parsed.command); };
    document.getElementById('free-command').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('run-command').click(); });
  }
  function run(command) { const result = S.dispatch(state, command); if (!result.ok) return toast(result.message); state = result.state; save(); render(); }
  function toast(message) { const node = document.createElement('div'); node.className = 'toast'; node.textContent = message; document.body.appendChild(node); setTimeout(() => node.remove(), 2400); }
  state = load(); render();
})();
