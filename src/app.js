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
      <p class="lead">你会作为一个小人进入世界，沿着道路移动，在眼前的地点遇见 NPC。远方的势力、战争和秘密不会凭空显示，只有接触、观察和传闻会让它们逐渐变得清楚。</p>
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
    return `<section class="director-event"><div class="event-tag">眼前发生 · ${esc(e.type)}</div><h2>${esc(e.title)}</h2><p>${esc(e.text)}</p><div class="choice-grid">${e.choices.map(c => button(c.label, { type: 'resolve_event', choice: c.id }, false, 'choice')).join('')}</div></section>`;
  }

  function terrainLabel(location) {
    const tags = location?.tags || [];
    if (tags.includes('sacred')) return '圣地';
    if (tags.includes('market')) return '商路';
    if (tags.includes('ruin')) return '遗迹';
    if (tags.includes('wild')) return '野外';
    if (tags.includes('institution')) return '建筑群';
    return '道路';
  }

  function mapPanel(s) {
    const here = s.entities.player.position.location;
    const location = S.LOCATIONS[here] || {};
    const local = S.LOCAL_MAP;
    const map = local.profile(here, location);
    const playerCell = local.normalizeCell(here, s.entities.player.position.cell, location, 'player');
    const people = Object.values(s.entities).filter(e => e.id !== 'player' && e.alive && e.position.location === here && e.position.cell);
    const occupant = new Map(people.map(e => [`${e.position.cell.x},${e.position.cell.y}`, e]));
    const tiles = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const cell = { x, y }; const cellKey = `${x},${y}`; const npc = occupant.get(cellKey);
      if (playerCell.x === x && playerCell.y === y) tiles.push('<div class="local-tile player-here" title="你"><span>🧍</span></div>');
      else if (npc) tiles.push(`<div class="local-tile npc-here" title="${esc(npc.identity.name)}"><span>●</span></div>`);
      else if (!local.isWalkable(cell, map)) tiles.push('<div class="local-tile blocked" aria-label="障碍">▪</div>');
      else tiles.push(`<div class="local-tile terrain-${esc(map.terrain)}">${esc(local.terrainSymbol(map.terrain))}</div>`);
    }
    const exits = local.ORDER.map(direction => {
      const target = map.neighbors[local.ORDER.indexOf(direction)];
      if (!target) return `<span class="road-exit absent">${local.DIRECTIONS[direction].label} · 无路</span>`;
      return `<button class="road-exit" data-command='${esc(JSON.stringify({ type: 'action', id: 'step', direction }))}'>${local.DIRECTIONS[direction].label} · ${esc(locName(target))}</button>`;
    }).join('');
    return `<article class="panel map-panel"><div class="panel-title"><h2>眼前的路</h2><span>${esc(location.name || here)} · 局部视野</span></div><div class="local-grid" style="--local-width:${map.width}">${tiles.join('')}</div><div class="road-exits">${exits}</div><p class="map-caption">你只能看见脚边的路和附近的人。走到边缘，才会进入另一处地点。</p></article>`;
  }

  function nearbyPanel(s) {
    const p = s.entities.player;
    const playerCell = S.LOCAL_MAP.normalizeCell(p.position.location, p.position.cell, S.LOCATIONS[p.position.location], 'player');
    const people = Object.values(s.entities).filter(e => e.id !== 'player' && e.alive && e.position.location === p.position.location && S.LOCAL_MAP.distance(playerCell, e.position.cell) <= 2);
    if (!people.length) return '<div class="empty">这里暂时没有熟人，只有风、雨和你的判断。</div>';
    return people.map(e => {
      const r = s.relationships[[e.id, 'player'].sort().join('::')] || {};
      const latest = e.memory.episodes[0];
      const distance = S.LOCAL_MAP.distance(playerCell, e.position.cell);
      const proximity = distance === 0 ? '就在你身边' : distance === 1 ? '离你只有一步' : '几步之外';
      const familiarity = Number(r.fear || 0) >= 20 ? `对你保持警惕 · ${proximity}` : Number(r.trust || 0) >= 10 ? `愿意听你说话 · ${proximity}` : `尚未熟悉 · ${proximity}`;
      const offers = (s.contracts?.available || []).map(id => S.CONTRACT_DEFS.find(def => def.id === id)).filter(def => def?.giver === e.id && def.locations.includes(p.position.location));
      const active = Object.values(s.contracts?.active || {}).map(item => S.CONTRACT_DEFS.find(def => def.id === item.id)).filter(def => def?.giver === e.id);
      const conversations = S.CONVERSATION_RUNTIME.list(S.CONVERSATION_DEFS, s, e.id, { day: S.day });
      return `<article class="person-card"><div class="person-heading"><span class="person-token">●</span><div><strong>${esc(e.identity.name)}</strong><span>${esc(e.identity.role)}</span></div></div><p class="familiarity">${familiarity}</p>${latest ? `<small>${esc(latest.text)}</small>` : ''}<div class="inline-actions">${button('交谈', { type: 'action', id: 'talk', target: e.id, mode: 'listen' })}${button('帮助', { type: 'action', id: 'talk', target: e.id, mode: 'help' })}${button('施压', { type: 'action', id: 'talk', target: e.id, mode: 'threaten' })}${button('挑战', { type: 'action', id: 'challenge', target: e.id }, false, 'danger')}${conversations.flatMap(def => def.choices.map(choice => button(choice.label, { type: 'action', id: 'conversation', target: e.id, conversationId: def.id, choiceId: choice.id }, false, 'choice'))).join('')}${offers.map(def => button('接受委托', { type: 'action', id: 'accept_contract', contractId: def.id }, false, 'choice')).join('')}${active.map(def => button('交付委托', { type: 'action', id: 'complete_contract', contractId: def.id }, false, 'choice')).join('')}</div></article>`;
    }).join('');
  }

  function localStatePanel(s, snap) {
    const p = snap.player;
    const gu = p.inventory.gu || {};
    const effects = (s.entities.player.effects?.active || []).map(item => `<span>${esc(item.data?.label || item.kind)}<b>${Math.max(0, Math.ceil(item.duration))}h</b></span>`).join('');
    const inventory = Object.entries(p.inventory).filter(([key]) => key !== 'gu').map(([key, value]) => `<span>${esc(itemName(key))}<b>${esc(value)}</b></span>`).join('');
    const refined = Object.entries(gu).map(([key, value]) => `<span>${esc(S.GU_SEEDS[key]?.name || key)}<b>${value.refined ? '已炼化' : Math.round(value.progress) + '%'}</b></span>`).join('');
    return `<article class="panel compact"><div class="panel-title"><h2>你</h2><span>${esc(p.identity.role || '行路人')}</span></div><div class="player-vitals"><div><b>${Math.round(p.vitality)}%</b><small>身体</small></div><div><b>${Math.round(p.essence)}/${p.essenceMax}</b><small>真元</small></div><div><b>${Math.round(p.needs.energy)}</b><small>精力</small></div></div><div class="meter-row"><span>修为</span><b>${Math.round(p.progress)}%</b><i><em style="width:${p.progress}%"></em></i></div><h3>随身物</h3><div class="inventory">${inventory}${refined}</div>${effects ? `<h3>身上的影响</h3><div class="inventory">${effects}</div>` : ''}</article>`;
  }

  function localNotesPanel(s) {
    const episodes = (s.entities.player.memory?.episodes || []).slice(0, 7);
    return `<article class="panel compact"><div class="panel-title"><h2>你的记忆</h2><span>只记录你经历过的事</span></div><div class="log local-log">${episodes.map(item => `<p><time>日${Math.floor((item.clock || 0) / 24) + 1}</time>${esc(item.text)}</p>`).join('') || '<p class="empty">还没有值得记住的事。</p>'}</div></article>`;
  }

  function sceneText(id) {
    const texts = { academy: '雨水敲在学堂檐角。家老在观察谁更像一块值得下注的玉，少年们也在互相寻找破绽。', village: '吊楼的灯火沿山腰铺开。这里有家族秩序，也有交易、传闻和无法被写进族谱的秘密。', ancestralHall: '香火和权力在同一座祠堂里升起。每一句话都会被不同的人解释成不同的立场。', bambooForest: '竹叶洗过雨，气味比记忆更诚实。这里的机缘不会主动等人，但也不会因为主线没有安排就消失。', riverbank: '山溪把脚印和酒香带向更深处。水面平静，水下的因果并不平静。', cliffCave: '石缝里残留着不属于今夜的痕迹。你看到的每一件东西，都可能成为别人的记忆。', caravanCamp: '商队暂时停在寨外，货物、消息和立场一起流动。', whiteBoneMountain: '白骨山道脱离了山寨的保护，赶路、补给和伏击都成为独立的生存问题。', merchantCity: '商家城把交易、演武、贵宾身份和家族派系压缩在城墙之内。每一次胜负都会改变你的价格。', threeForkMountain: '三叉山的三道传承光柱周期性开启。传承不是宝箱，而是会消耗队伍、抬高难度并制造新的敌人。', heavenClimbMountain: '天梯山的传承消息来自更高层级的门派世界。这里的竞争不只比较蛊力，也比较意志与资格。', northernPlains: '北原草原没有山寨围墙替你定义安全。侦察、风雪、部族军势和补给线会先于正面战斗决定谁能活到下一场战役。', blackTribeCamp: '黑家盟军的军帐、伤员和战利品挤在同一片营地。这里的每个决定都会同时改变战线与部族关系。', imperialCourt: '王庭福地把部族野心、历史遗产和休养需求放在同一张棋盘上。表面安静的湖泊下，战争仍在结算。', trueYangTower: '八十八角真阳楼的塔影随风雪逐层显化。血脉资格、外界天气、后勤和闯关者记忆共同决定哪一道门会出现。', foxFairyLand: '狐仙福地是从北原踏入更高层次世界的第一道门。资源、地灵、外敌和主人留下的规则共同决定这里能否继续生长。', centralContinent: '中洲的道路被古派、商路和情报网切成许多层。你每走一步，都会被不同势力记录并重新估价。', immortalAuction: '中洲拍卖会把仙蛊、蛊方、情报和各大势力的关系网放在同一个大厅里。出价本身也是一种暴露。', immortalCraneSect: '仙鹤门的山门、云海与弟子秩序把宗门压力具象化。这里的战争常常先以一封信、一项传承或一个弟子的归属开始。', southernBorder: '南疆群山把超级家族、边境冲突和血仇藏在层层雾瘴后。外交谈判与战争准备往往只隔着一封家书。', westernDesert: '西漠的风沙掩埋道路，却掩不住房家蛊屋、智道传承和各方争夺的资源线。', easternSea: '东海的岛屿与海路让散修、超级势力和远方消息保持流动，任何港口都可能成为新的政治节点。', heavenlyCourt: '天庭的云宫把秩序、传承和五域战争压缩成一套高层决策。这里的每一份命令都可能在远方形成灾难。', longLifeHeaven: '长生天的北原遗产仍在影响部族和王庭。草原上的旧盟约被重新解释，战争因此有了更长的影子。', shadowSectRuins: '影宗遗址只留下残破的阵痕与不完整的记忆。废墟没有消失，只是在等待有人重新组织它。', divineEmperorCity: '神帝城不是一座静止的城，而是一件正在调度人道资源、守卫和战报的仙蛊屋。', bookMountain: '书山收集着远方战场的情报。每一页记录既是知识，也是会改变势力判断的资源。', primordialDesolateWorld: '蛮荒大世界的战线逼近世界边缘，荒兽、异族与天庭前线都在争夺可以立足的道痕。', loessWorld: '黄土大世界的风沙把战场和资源埋在一起。补给线断裂时，整个世界都会变成一座消耗人的迷宫。', reverseFlowRiver: '逆流河不允许任何人用熟悉的方式前进。求生、追逐和河流本身的规则共同决定谁能抵达下一处岸边。', dreamRealms: '梦境战场正在侵入现实。这里的每一次探索都可能带回认知，也可能把梦境的危险带回身体。', madDemonCave: '疯魔窟的深处不是普通遗迹。元境与无极魔尊的传闻让每一步探索都接近世界结构的底层。' };
    return texts[id] || '世界在自行运转。';
  }

  function combatPanel(s) {
    const c = s.combat;
    if (!c) return '';
    const target = s.entities[c.defender];
    return `<section class="director-event combat-event"><div class="event-tag">眼前冲突 · 第 ${c.round} 回合</div><h2>你与${esc(target?.identity.name || '未知目标')}正在交锋</h2><p>伤势会写入双方身体和记忆。其他行动暂时不可用。</p><div class="choice-grid">${button('攻击', { type: 'combat', id: 'attack' }, false, 'choice')}${button('催动月光蛊', { type: 'combat', id: 'gu' }, false, 'choice')}${button('防守', { type: 'combat', id: 'guard' }, false, 'choice')}${button('脱身', { type: 'combat', id: 'flee' }, false, 'choice')}</div><small>你的身体：${Math.round(s.entities.player.body.health)} / ${Math.round(s.entities.player.body.maxHealth)} · 对方：${Math.round(target?.body.health || 0)} / ${Math.round(target?.body.maxHealth || 0)}</small></section>`;
  }

  function render() {
    if (!state) return startScreen();
    const snap = S.snapshot(state);
    const p = snap.player;
    const here = state.entities.player.position.location;
    const zone = snap.zone;
    app.innerHTML = `<div class="shell">
      <header class="topbar"><div><div class="kicker">青茅山 · 野外视角</div><h1>${esc(p.name)}</h1><p>${esc(timeText(state))} · ${esc(locName(here))}</p></div><div class="top-actions"><button id="save-game">保存</button><button id="new-world">离开世界</button></div></header>
      <section class="top-player">${localStatePanel(state, snap)}</section>
      ${eventPanel(state)}
      ${combatPanel(state)}
      <section class="playfield">
        <div class="road-column">
          ${mapPanel(state)}
          <article class="scene"><div class="scene-label">场景</div><h2>${esc(locName(here))}</h2><p>${esc(sceneText(here))}</p><div class="zone-meta"><span>${esc(zone.weather)}</span><span>${zone.danger >= 60 ? '危险迹象明显' : zone.danger >= 30 ? '四周不太安稳' : '暂时平静'}</span><span>${(zone.hazards || []).filter(hazard => zone.danger >= Number(hazard.threshold || 0)).map(hazard => esc(hazard.label)).join(' · ') || '没有辨认出特殊危险'}</span></div></article>
        </div>
        <div class="action-column">
          <article class="panel"><div class="panel-title"><h2>手边行动</h2><span>行动会推进时间，世界不会暂停</span></div><div class="action-grid">${actionButtons(state)}</div><div class="command-row"><input id="free-command" placeholder="描述你要做什么：观察、去竹林、和方正说话……"><button id="run-command">行动</button></div></article>
          <article class="panel"><div class="panel-title"><h2>眼前的人</h2><span>只有同一地点的人会出现在这里</span></div><div class="people-grid">${nearbyPanel(state)}</div></article>
        </div>
      </section>
      <section class="lower-field">${localNotesPanel(state)}<article class="panel compact local-rule"><div class="panel-title"><h2>你知道的范围</h2><span>信息边界</span></div><p>远方的势力、市场和战争不会凭空出现在你的视野里。先走过去，遇到人，听到传闻，或者亲自观察。</p></article></section>
      <footer><span>世界种子：${esc(state.seed)} · schema ${state.schema}</span><span>小人正在世界中移动；世界不会因为你离开页面而停止</span></footer>
    </div>`;
    wire();
  }

  function itemName(id) { return ({ water: '清水', moonPetal: '月兰花瓣', wine: '酒', stones: '元石', food: '食物', relicFragment: '遗藏碎片' }[id] || id); }
  function actionButtons(s) {
    return S.ACTION_CATALOG.list(s, { locations: S.LOCATIONS })
      .filter(item => item.kind !== 'travel' && !item.id.startsWith('commission_agent:'))
      .map(item => button(item.command.label || item.label, item.command, false, item.kind)).join('');
  }
  function wire() {
    document.querySelectorAll('[data-command]').forEach(el => el.addEventListener('click', () => run(JSON.parse(el.dataset.command))));
    document.getElementById('save-game').onclick = () => { save(); toast('世界已保存。'); };
    document.getElementById('new-world').onclick = () => { if (confirm('离开会回到世界入口，本地存档仍会保留。确定吗？')) { state = null; startScreen(); } };
    document.getElementById('run-command').onclick = () => {
      const input = document.getElementById('free-command'); const parsed = S.interpret(input.value, state);
      if (!parsed.ok) return toast(parsed.message);
      let command = parsed.command;
      if (command.id === 'travel') {
        const index = S.LOCATIONS[state.entities.player.position.location]?.neighbors?.indexOf(command.location) ?? -1;
        if (index < 0) return toast('远处的地点还不能直接抵达，请先沿眼前的道路逐格前进。');
        command = { type: 'action', id: 'step', direction: S.LOCAL_MAP.ORDER[index] };
      }
      run(command);
    };
    document.getElementById('free-command').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('run-command').click(); });
  }
  function run(command) { const result = S.dispatch(state, command); if (!result.ok) return toast(result.message); state = result.state; save(); render(); }
  function toast(message) { const node = document.createElement('div'); node.className = 'toast'; node.textContent = message; document.body.appendChild(node); setTimeout(() => node.remove(), 2400); }
  state = load();
  render();
})();
