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
| Game Object + Parts | `src/entity.js` 工厂 + `entities[id]` + `identity/position/needs/cultivation/memory/inventory` | 同一实体可拥有不同能力，玩家和 NPC 走同一条规则路径 |
| Event types / before-after events | `dispatch → action/resolve_event → event queue/listeners → log/events.history` | 所有状态变化可追踪、可回放、可保存，派生区域后果由监听器组合 |
| GoalHandlers | `src/npc-ai.js` + NPC `goals.active/queue` + `schedule` | 日程只是默认偏好，记忆、恐惧和世界压力可覆盖它；目标执行仍由运行时注册 |
| Factions.xml | `factions` + `relationships` | 势力拥有影响力、紧张度、态度，玩家行为会改变关系图 |
| Conversations + Parts | `src/conversation.js` + `CONVERSATION_DEFS` + `talk` 兼容模式 + NPC memory | 对话条件、选项和后果可组合，对话是交互结果，不是唯一的剧情分支入口 |
| HistoryKit / HistorySpice | `SOURCE_NOTES` + 后续历史系统接口 | 小说因果作为可追溯素材，不能直接变成固定结局 |
| Zone / Population / RPM | `locations` + `src/zone-builder.js` + 人口表 | 地点提供标签和邻接关系，区域资源与环境居民可由内容状态重建 |

## 不会直接照搬的部分

`Assembly-CSharp.dll` 是第三方闭源构建产物。本项目不反编译并复制其实现，不把 Qud 的原始名称、文本、图片或资产提交进 GitHub；只使用上面的结构抽象。小说内容也不从 Qud 的数据中补写，全部回到 `reference/novel` 核对。

## 当前实现边界

当前已落地：确定性世界时钟、组件式实体、事件历史式结算、按小时/按日系统管线、可注册动作和事件监听器、NPC 日程与目标行动、记忆与关系、动态势力网络、导演事件、身体部位/伤口/冲突、三卷首批区域内容、自由意图解析和 JSON 存档。尚未声称完成 Qud 级别的格点物理、液体/温度模拟、完整历史生成器或全书内容；这些会作为后续独立系统加入，而不是假装已经实现。
