# 蛊真人 · Simulation-First RPG

这是一个从《蛊真人》小说原文素材重建的持续世界 RPG 原型。它不把小说强行展开成固定分支树，而是让玩家、NPC、势力、资源、记忆和时间共同推进世界。

当前工作目录：`D:\Caves of Qud\gu-rpg`

远端仓库：[Liang-techh/gu](https://github.com/Liang-techh/gu)

## 已落地的世界内核

- 确定性世界时钟与小时级推进；跨越多日时按每个世界日分别执行资源、需求、势力和历史结算；
- 玩家/NPC 共用的组件式实体模型；
- 独立运行时内核：组件查询、领域事件流、GoalHandler/Conversation/Interaction 注册表，以及按小时/按日排序执行的系统管线；
- 独立内容包 [src/content.js](<D:\Caves of Qud\gu-rpg\src\content.js>)：地点、人口表、势力、人物、蛊虫和章节来源可按内容版本扩展；
- 独立区域构建器 [src/zone-builder.js](<D:\Caves of Qud\gu-rpg\src\zone-builder.js>)：按地点标签生成资源状态，并按人口表重建环境居民；
- 独立 NPC AI 层 [src/npc-ai.js](<D:\Caves of Qud\gu-rpg\src\npc-ai.js>)：目标选择、日程导航、需求驱动和同场记忆通过依赖注入接入运行时；
- NPC 目标选择使用效用评分：需求、性格、势力紧张、关系恐惧和近期目标历史共同决定下一个 GoalHandler，不再只是固定队列轮询；
- 通用 NPC 目标处理器 [src/default-goals.js](<D:\Caves of Qud\gu-rpg\src\default-goals.js>)：人口表和关键人物使用的采集、巡逻、学习、调查、战争、疗伤等目标均有实际世界后果，不再静默 no-op；
- 组件化蛊虫能力运行时 [src/ability.js](<D:\Caves of Qud\gu-rpg\src\ability.js>)：炼化、学习、真元消耗、能力发动和 `ability.used` 事件统一处理，不再把月光蛊逻辑写死在战斗分支中；
- 独立实体/组件工厂 [src/entity.js](<D:\Caves of Qud\gu-rpg\src\entity.js>)：玩家、关键 NPC 和环境居民共用同一套组件默认值与校验入口；
- 运行时组件与状态效果 [src/condition.js](<D:\Caves of Qud\gu-rpg\src\condition.js>)：恐惧、受伤等效果可以附着、刷新、过期，并被 NPC AI 和小时系统读取；引擎提供组件 attach/detach/patch 与动作前后钩子；
- 信息与怀疑组件 [src/knowledge.js](<D:\Caves of Qud\gu-rpg\src\knowledge.js>)：事实带置信度、来源和时间，NPC 对玩家的怀疑会影响调查、观察和回避目标，支持身份伪装与反转；
- 身份面具组件 [src/identity.js](<D:\Caves of Qud\gu-rpg\src\identity.js>)：公开标签、面具强度、主动切换、指定 NPC 摊牌和交易痕迹都进入同一份世界状态；
- 内容驱动对话运行时 [src/conversation.js](<D:\Caves of Qud\gu-rpg\src\conversation.js>)：地点、旗标、信任门槛和对话选项后果统一写入关系、势力、记忆与历史；
- 独立委托运行时 [src/contracts.js](<D:\Caves of Qud\gu-rpg\src\contracts.js>)：委托发现、目标判定、接受、交付和奖励不再混在主模拟器中；
- 可复用重复系统运行时 [src/repeatable-systems.js](<D:\Caves of Qud\gu-rpg\src\repeatable-systems.js>)：演武、传承、巡逻、闯楼、拍卖和梦境探索作为注入式世界行动运行，不依赖主模拟器内的重复分支；
- 领域事件账本与传闻传播 [src/rumor.js](<D:\Caves of Qud\gu-rpg\src\rumor.js>)：事件不再只存在于待处理队列，同地点 NPC 和同势力关系网会根据交互、冲突、资源和战线事件形成带来源的二手记忆；
- 情报网络与案件压力：传闻保留事件来源、传播路径和置信度，并在 `intel.cases` 中按目标与势力累计调查压力，NPC 的调查目标会真实消耗和更新这些压力；
- 势力追捕队与代理人 [src/pursuit.js](<D:\Caves of Qud\gu-rpg\src\pursuit.js>)：追捕使作为真实 `agent` 实体在地图中寻路、接触和记忆目标，玩家可收买、误导或警告追兵，进度和警戒会显示在 UI；
- NPC 委托网络 [src/agency.js](<D:\Caves of Qud\gu-rpg\src\agency.js>)：玩家可把打探、侦查、交易和游说交给同地点 NPC，委托跨小时推进，受关系、位置、精力和人格影响并留下可回放的结果事件；
- 共享动态市场 [src/market.js](<D:\Caves of Qud\gu-rpg\src\market.js>)：NPC 自主交易、玩家委托交易和未来的玩家交易共用报价、供需、元石结算与交易事件；普通交易会进入区域活动和低风险传闻，但不会被误判成追杀证据；
- 统一社会交互运行时 [src/social.js](<D:\Caves of Qud\gu-rpg\src\social.js>)：玩家和 NPC-NPC 的帮助、施压、交易、交谈与调停共用关系、记忆、状态效果、事件 provenance 和势力后果；普通自治交谈采用局部记忆，威胁/调停才升级到全局传闻网络；
- 统一 Combat runtime [src/combat.js](<D:\Caves of Qud\gu-rpg\src\combat.js>)：玩家战斗回合、环境伤害、离线冲突和活跃 NPC 伏击共用身体部位、伤势、Effect、死亡、记忆和战斗事件结算；攻击、蛊术、防守和脱身也都通过 Action Registry；
- 统一组件包 [src/gu-components.js](<D:\Caves of Qud\gu-rpg\src\gu-components.js>)：身份、位置、势力、修为、需求、日程、目标、能力、库存、记忆、知识、状态、身体、装备、效果、Brain 和代理人均注册生命周期/序列化定义，不再只有裸 JSON 字段；
- 独立行动目录 [src/action-catalog.js](<D:\Caves of Qud\gu-rpg\src\action-catalog.js>)：可用 command 根据当前世界状态生成，UI、自由意图解析和未来 AI 代理共享同一行动入口；
- 区域交互 affordance 包 [src/gu-affordances.js](<D:\Caves of Qud\gu-rpg\src\gu-affordances.js>)：观察、采集、遗藏搜索和侦查通过 Interaction Registry 注册；有效性由当前区域、资源、标签和战区状态决定，玩家、NPC 和未来代理人共用同一处理器，执行后统一写入资源、记忆、事件、后果和时间，而不是再把环境动作硬编码在某个 UI 按钮里；
- 基础行动全部进入 Action Registry：等待、旅行、修炼、学习、采集、休息、炼蛊、装备、交谈、挑战和势力影响不再由主模拟器的 ID 条件链直接分叉；
- 内容系统包 [src/gu-systems.js](<D:\Caves of Qud\gu-rpg\src\gu-systems.js>)：小时级需求/状态/AI 与日级市场、区域、家族压力、战争和历史快照都通过可排序 System Registry 注册，世界推进不再藏在单一 daily tick 函数里；
- NPC 内容目标包 [src/gu-goals.js](<D:\Caves of Qud\gu-rpg\src\gu-goals.js>)：资源争夺、遗藏调查、学堂竞争、保护关系、避开玩家和势力结盟等目标从模拟内核移出，通过 Goal Registry 注入世界；
- 内容事件监听包 [src/gu-listeners.js](<D:\Caves of Qud\gu-rpg\src\gu-listeners.js>)：传闻、旅行、演武、传承、战线、拍卖、交易和梦境的世界后果通过 Event Registry 注入，不再由主模拟器维护内容监听器；
- 玩家行动内容包 [src/gu-actions.js](<D:\Caves of Qud\gu-rpg\src\gu-actions.js>)：旅行、修炼、采集、炼蛊、身份、交谈、委托、拍卖、传承、战斗等行动的世界规则从 `simulation.js` 移出，输入层只提交 command；
- 世界内容提供器 [src/gu-world.js](<D:\Caves of Qud\gu-rpg\src\gu-world.js>)：世界状态初始种子、青茅山开场局势、延迟 NPC 激活和内容包关系初始化从 kernel 移出，替换世界不需要重写时间/dispatch/存档管线；
- 世界状态提供器 [src/gu-state.js](<D:\Caves of Qud\gu-rpg\src\gu-state.js>)：蛊真人专属的存档默认值、组件修复、数值边界和区域状态归一化从 kernel 移出，换内容包时只替换状态 schema provider；
- 高代价命运逆转：春秋蝉式行动只在濒死绝境开放，消耗有限次数、丢失当前资源、改变世界随机轨迹并留下身体裂痕，同时只携带低置信度的未来回声；
- 规则型传承运行时：三王传承保存侦查线索、可信度、资格、竞争者进度、开放窗口、贪取捷径和错误路线，侦查与推进共用 Action/Event/History 管线；
- 持续狼潮危机：三寨联盟、补给、压力、合法性、战斗、伤亡和迁徙进入日级系统；玩家可救援、侦查或囤积，世界会在玩家不操作时继续结算；
- 灾害型动态市场：商路灾害会重写供给、价格、人口迁徙和势力张力；玩家可救济、套利或核验，NPC 知识会保留互相冲突的传闻版本；
- 持续狐仙福地：`blessedLand` 保存资源、魂魄储备、守备、驻民、声望、宗门压力和升级；`blessedLandTick` 在玩家离开后继续生产、消耗、承压，并把经营失败转成驻民迁徙；玩家可加固、培育、招募或隐藏福地；
- 持续五域战区：`worldWar.fronts` 保存各战区的补给、压力、控制权、战斗、伤亡和指挥者；`worldWarTick` 会在玩家离开时自动结算战线，玩家可支援、侦查、破坏补给或调停，战斗会写入 NPC 记忆、势力张力和持久后果；
- NPC 战争目标接入战区：`prepareWar`、`protectClan`、`patrol` 和 `mediate` 在战区内会真实改变补给、控制权和压力，并留下目标事件，不再只是增加一个全局计数器；
- 影宗隐秘网络：`shadowNetwork` 保存遗址、福地和中洲节点的控制、补给、隐蔽性、招募、情报、凝聚力和暴露度；NPC 可自主重建，玩家可招募、整理情报、隐藏或出卖暗线，网络会在日级系统中继续运转；
- 状态反应型 AI 导演：影宗暴露度达到阈值后会动态生成 `shadowNetworkExposure` 局势窗口，玩家可以抹痕、套利、举报或忽略；导演不再只依赖固定章节日期和一次性旗标；
- 涌现型 AI 导演：`coalitionFracture` 根据盟约合法性、补给和凝聚力生成动态政治危机；同一条导演规则可以在不同地点、不同势力和不同玩家介入下产生不同后果，而不是只按小说章节顺序播放；
- 持续梦境争夺：`dreamRealm` 保存梦道势力、中洲与两天异族的控制权、资源、污染和压力；NPC 学习、玩家梦境探索以及锚定、收割、稳定、破坏都会改变所有权，离线时仍会产生争夺行动；
- 动态势力契约：`state.coalitions` 保存跨势力盟约的成员、信誉、凝聚力、补给、逐方义务、状态和倒戈历史；`coalitionTick` 会根据战争压力、市场供给、势力关系和紧张度自动恢复、承压、破裂或驱动一方倒戈；玩家可撮合盟约、兑现承诺、揭露隐性条件或公开退出，NPC 的备战、保护与调停目标也会为同一账本补充或消耗信用；
- 独立导演运行时 [src/director.js](<D:\Caves of Qud\gu-rpg\src\director.js>)：候选事件发现、选择校验、事件处理器调用和时间推进与小说内容规则分离；
- 小说内容导演规则包 [src/gu-director-rules.js](<D:\Caves of Qud\gu-rpg\src\gu-director-rules.js>)：30 个卷章局势只声明触发条件、爽点选择和来源，内核不再持有内容包的导演候选定义；
- 小说事件结算包 [src/gu-event-rules.js](<D:\Caves of Qud\gu-rpg\src\gu-event-rules.js>)：导演选择后的旗标、资源、关系、记忆、势力和战争后果通过统一事件注册表结算，模拟内核不再承载卷章事件处理器；
- 导演运行时支持候选评分、规则冷却和有限导演历史，多个同时满足条件的世界事件可以按当前状态竞争，而不是永远按注册顺序触发；
- 独立意图解析 [src/intent.js](<D:\Caves of Qud\gu-rpg\src\intent.js>)：从完整内容地图生成地点意图，覆盖狐仙福地、中洲、仙鹤门和拍卖会等后续区域；
- 内容包已覆盖第一卷青茅山后段、第二卷白骨山—商家城—三叉山—天梯山、第三卷北原草原—黑家军营—王庭福地—八十八角真阳楼、第四卷狐仙福地—中洲—仙鹤门—仙蛊拍卖会、第五卷首批五域战争区域链，以及第六卷首批两天终局区域链；
- 商家城演武与三王传承不是一次性剧情：可以反复行动，积累连胜、声望、轮次、难度、资源和伤势；
- 北原巡逻与真阳楼闯层是第三卷的重复系统：补给、战争压力、伤亡、楼层难度和探索记录会持续变化；
- 狐仙福地回归、中洲宗门视线、仙蛊拍卖与宗门压力是第四卷的连续导演事件：旗标、市场情报、宗门关系和福地压力会跨区域保留；
- 中洲拍卖会支持重复竞拍、观察、出售情报、抬价、抵押借贷和核验情报：成交量、供给稀缺度、竞价热度、元石、债务、可信度、追踪压力和散修势力张力会共同改变后续市场；
- 面具与交易追踪会反向触发导演调查：玩家可以抹除痕迹、误导追查或带着面具反向设伏，摊牌只会把真名写入指定 NPC 的知识组件；
- 第五卷首批内容把影宗残脉、南疆、西漠、东海、天庭、长生天接入同一张跨域地图；影宗重建、五域战争、南疆家族、西漠房家和天庭决策会通过导演条件依次开启；
- 五域战争保存独立的 `worldWar` 状态：影宗是否重建、各域战线是否打开、战争热度和势力紧张会随 NPC 目标、日结算和玩家选择持续变化；
- 第六卷首批内容把神帝城、书山、蛮荒大世界、黄土大世界、逆流河、梦境战场和疯魔窟接入 `eternalWar` 状态；神帝城调度、两天重叠、元境线索、梦境潮汐和星宿安排形成终局级导演链；
- UI 现在直接显示势力盟约的成员、合法性、补给、凝聚力与倒戈次数，玩家能观察外交账本而不是只能从日志猜测世界变化；
- 梦境战场支持重复探索：每次 `dream_dive` 都根据修为、洞察、梦境压力和随机种子结算成功/反噬，并将深度、危险、伤势和势力张力写入世界状态；
- `identity / position / needs / cultivation / personality / schedule / goals / memory / inventory` 组件；
- 事件历史、导演事件、可订阅事件监听器和统一 `dispatch` 结算入口；
- 委托、演武、传承、北原巡逻和真阳楼闯层等高频动作通过 Action Registry 注册，规则验证与 UI 解耦；
- NPC 日程、目标选择、移动、饥饿/精力和同场遭遇记忆；
- 基于地点图的多区域导航；NPC 不会因为目的地不与当前位置直连而冻结；
- NPC 目标会实际改变资源、秘密事实、商路活动和势力压力；
- 人物关系中的信任、畏惧、人情和持久事实；
- 古月、白家、熊家、商队、魔道游修等动态势力；
- 地点资源、天气、危险度、访问量和基于人口表生成的环境居民；
- 商队进入、三寨联盟议事、狼潮逼近等会改变资源与势力关系的长期世界事件；
- 狼潮后的三族大比武，以及铁血冷/铁若男按条件延迟进入的调查线；
- 身体组件、随机部位伤害、伤口、死亡与连续冲突；
- 自由意图解析：自然语言只生成 command，不能直接改状态；
- 本地 JSON 存档与确定性恢复；
- 90 日长跑审计：世界状态保持有限、结构有效，存档可重新验证；
- 独立 HistoryKit 风格历史账本：重大事件、势力/区域日快照和可回放摘要；
- 基于小说原文的青茅山开局：开窍大典、方源、方正、学堂、竹林、月光蛊、酒虫与遗藏线索；第三卷内容已加入黑楼兰、太白云生、东方余亮、马英杰及北原战争导演事件。

## 运行

```powershell
cd 'D:\Caves of Qud\gu-rpg'
npm test
python -m http.server 4173
```

然后打开 `http://localhost:4173/`。

## 代码边界

`src/engine.js` 是可扩展运行时内核，`src/content.js` 是内容包，`src/simulation.js` 组合二者形成当前世界规则。`src/app.js` 只负责把状态投影成 UI，并把按钮/文本转换为 command。以后接入模型时，模型只能提出意图或叙述草稿，不能绕过 simulation kernel。

`reference/novel/` 是内容依据；新增角色、地点、蛊虫或事件前先从原文核对。游戏化数值和新系统会明确标为改编规则。

## Caves of Qud 逆向抽象边界

本项目参考 `D:\Caves of Qud` 本地安装中的公开可读数据结构和程序集元数据：势力 XML、对话 XML、命令定义、历史生成数据、区域/人口表，以及 `Parts / Events / GoalHandlers / Conversations / HistoryKit` 等模块边界。不会复制 Qud 的 DLL、文本、美术或资产。

具体审计见 [docs/QUD_LOCAL_AUDIT.md](docs/QUD_LOCAL_AUDIT.md)，架构说明见 [docs/SIMULATION_ARCHITECTURE.md](docs/SIMULATION_ARCHITECTURE.md)。

## 验证状态

```text
 npm test       67/67 passing
npm run check:canon  91/91 term/source checks
npm run check:content  content schema valid
npm run audit:long  365-day world audit
```

当前是可运行的多区域垂直切片，不声称已经完成 Qud 级别的格点物理、液体/温度、完整历史生成和全书内容。第六卷仍只是首批终局结构，后续会继续以可测试的组件/事件模块补齐小说内容密度和更深的系统交互。
