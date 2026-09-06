# Caves of Qud 本地结构审计

本审计只记录对 `D:\Caves of Qud` 本地安装文件的结构观察，不复制原始 DLL、文本或游戏资产到本项目。`gu-rpg` 的内容仍以本仓库 `reference/novel` 为唯一世界观素材来源。

## 已看到的本地证据

目标目录是 Unity/Mono 构建产物，不是公开源码仓库：

- `CoQ_Data/Managed/Assembly-CSharp.dll`：主程序集。
- `CoQ_Data/StreamingAssets/Base/Factions.xml`：势力初始声望、相互态度、兴趣标签、交易方向和仪式奖励。
- `CoQ_Data/StreamingAssets/Base/Conversations.xml`、`HiddenConversations.xml`：对话节点、条件、选择、对话部件和后果。
- `CoQ_Data/StreamingAssets/Base/Commands.xml`：输入命令分类、层、键位和导航动作。
- `CoQ_Data/StreamingAssets/Base/HistorySpice.json`：历史生成的语义槽位、材料、行为、毁灭原因和叙述模板。
- `CoQ_Data/StreamingAssets/Base/PopulationTables.xml`、`Worlds.xml`、`ZoneTemplates.xml`、大量 `.rpm`：人口、世界区域、区域模板和房间数据。
- `CoQ_Data/StreamingAssets/Base/Genotypes.xml`、`Mutations.xml`、`Bodies.xml`：角色构成、属性、技能、变异和身体结构数据。

程序集字符串元数据暴露出的命名边界包括：

- `XRL.World.Parts.*`：实体组件/部件，如资源、物理、AI 辅助、状态和能力。
- `XRL.World.Events.*`：动作前后、伤害、对话、区域、导航和通用通知事件。
- `XRL.World.AI.GoalHandlers.*`：`MoveTo`、`Wander`、`GoOnAShoppingSpree`、`DropOffStolenGoods` 等目标处理器。
- `XRL.World.Conversations.Parts.*`：对话条件和社会交互的可组合部件。
- `XRL.World.ZoneBuilders.*` 与 `Population*`：区域生成和人口表，而非只在剧情脚本里列出地点。
- `HistoryKit.*`：把历史实体快照、事件和叙述扩展分开。

## 抽象到《蛊真人》的对应关系

| Qud 观察 | `gu-rpg` 对应层 | 目的 |
| --- | --- | --- |
| Game Object + Parts | `src/entity.js` 工厂 + `entities[id]` + `identity/position/needs/cultivation/memory/inventory/conditions`，以及 `Engine.attach/detach/patchComponent` | 同一实体可拥有不同能力，运行时状态效果可以附着/过期，玩家和 NPC 走同一条规则路径 |
| Event types / before-after events | `dispatch → action/resolve_event → action hooks + event queue + recent ledger/listeners → log/events.history` | 所有状态变化可追踪、可回放、可保存，动作前后钩子与派生区域后果/传闻记忆由监听器组合 |
| GoalHandlers | `src/npc-ai.js` + NPC `goals.active/queue/history` + `schedule` | 日程只是默认偏好，效用评分会读取记忆、恐惧、需求、性格和世界压力；目标执行仍由运行时注册 |
| Factions.xml | `factions` + `relationships` | 势力拥有影响力、紧张度、态度，玩家行为会改变关系图 |
| Conversations + Parts | `src/conversation.js` + `CONVERSATION_DEFS` + `src/contracts.js` + NPC memory | 对话/委托条件、选项和后果可组合，交互结果不是唯一的剧情分支入口 |
| HistoryKit / HistorySpice | `SOURCE_NOTES` + `history` 账本 + 导演历史 | 小说因果作为可追溯素材，不能直接变成固定结局；导演和世界事件保留有限可回放依据 |
| Zone / Population / RPM | `locations` + `src/zone-builder.js` + 人口表 | 地点提供标签和邻接关系，区域资源与环境居民可由内容状态重建 |

## 不会直接照搬的部分

`Assembly-CSharp.dll` 是第三方闭源构建产物。本项目不反编译并复制其实现，不把 Qud 的原始名称、文本、图片或资产提交进 GitHub；只使用上面的结构抽象。小说内容也不从 Qud 的数据中补写，全部回到 `reference/novel` 核对。

## 当前实现边界

当前已落地：确定性世界时钟、组件式实体、运行时状态效果、动作前后钩子、事件队列与持久账本、按小时/按日系统管线、可注册动作和事件监听器、效用驱动 NPC 目标、通用目标处理器、组件化蛊虫能力、地点传闻与长期记忆、动态势力网络、候选评分与冷却式 AI 导演、身体部位/伤口/冲突、内容包结构校验、六卷首批区域内容、自由意图解析和 JSON 存档。尚未声称完成 Qud 级别的格点物理、液体/温度模拟、完整历史生成器或全书内容；这些会作为后续独立系统加入，而不是假装已经实现。
