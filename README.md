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
- 独立实体/组件工厂 [src/entity.js](<D:\Caves of Qud\gu-rpg\src\entity.js>)：玩家、关键 NPC 和环境居民共用同一套组件默认值与校验入口；
- 内容驱动对话运行时 [src/conversation.js](<D:\Caves of Qud\gu-rpg\src\conversation.js>)：地点、旗标、信任门槛和对话选项后果统一写入关系、势力、记忆与历史；
- 领域事件账本与传闻传播 [src/rumor.js](<D:\Caves of Qud\gu-rpg\src\rumor.js>)：事件不再只存在于待处理队列，同地点 NPC 会根据交互、冲突、资源和战线事件形成带来源的二手记忆；
- 独立行动目录 [src/action-catalog.js](<D:\Caves of Qud\gu-rpg\src\action-catalog.js>)：可用 command 根据当前世界状态生成，UI、自由意图解析和未来 AI 代理共享同一行动入口；
- 内容包已覆盖第一卷青茅山后段、第二卷白骨山—商家城—三叉山—天梯山、第三卷北原草原—黑家军营—王庭福地—八十八角真阳楼，以及第四卷狐仙福地—中洲—仙鹤门—仙蛊拍卖会的首批区域链；
- 商家城演武与三王传承不是一次性剧情：可以反复行动，积累连胜、声望、轮次、难度、资源和伤势；
- 北原巡逻与真阳楼闯层是第三卷的重复系统：补给、战争压力、伤亡、楼层难度和探索记录会持续变化；
- 狐仙福地回归、中洲宗门视线、仙蛊拍卖与宗门压力是第四卷的连续导演事件：旗标、市场情报、宗门关系和福地压力会跨区域保留；
- 中洲拍卖会支持重复竞拍、观察和出售情报：成交量、竞价热度、元石、洞察和散修势力张力会共同改变后续市场；
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
npm test       25/25 passing
npm run check:canon  55/55 term/source checks
npm run check:content  content schema valid
```

当前是可运行的多区域垂直切片，不声称已经完成 Qud 级别的格点物理、液体/温度、完整历史生成和全书内容。后续系统会继续以可测试的组件/事件模块逐卷加入。
