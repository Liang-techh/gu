# Caves of Qud 架构逆向笔记

本笔记来自本机 `D:\Caves of Qud\CoQ_Data\Managed\Assembly-CSharp.dll` 的反射检查，而不是凭印象模仿。该安装包的 Assembly-CSharp 版本为 `2.0.209.29`。目标是提炼可迁移的 simulation-first 结构，不复制 Qud 的具体内容或实现代码。

## 观察到的核心边界

### 1. 实体是组合对象，不是继承树

`XRL.World.GameObject` 直接持有 `Brain`、`Body`、`Inventory`、`ActivatedAbilities`、`Statistics`、`PartRack` 和 `EffectRack` 等可替换部件，并通过 `HasPart`/同类查询访问能力。实体的物理、行为、装备、效果和统计可以独立增删。

蛊真人项目对应到：`engine.js` 的 component registry、`entity.js` 的组件化实体，以及 `brain`、`body`、`effects` 组件。`src/effect.js` 已落地独立的 EffectRack 风格效果实例、叠加和生命周期；下一步的蛊虫、装备覆盖和身份面具都应继续保持可组合，而不是为每种 NPC 建立专用类。

### 2. Part 同时拥有生命周期和事件订阅

`XRL.World.IPart` 的公开契约包含 `Attach`、`Initialize`、`AddedAfterCreation`、`Remove`、`ObjectLoaded`、`Save/Load`、`DeepCopy`，并支持 `RegisterEvent` / `UnregisterEvent`。这说明部件不仅是数据字段，也是可以在实体生命周期中注册行为的运行时模块。

当前项目的 `attach/detach/patchComponent` 已提供数据层入口，`registerEventListener` 提供全局事件入口。本轮先把 NPC 的 `brain` 做成独立模块；后续应为组件增加 `onAttach/onDetach/onEvent/serialize` 生命周期，令蛊虫、伤势、身份和装备可以自注册规则。

### 3. 事件是参数化领域消息，不是字符串日志

`XRL.World.Event` 保存 ID、对象参数、字符串参数、整数参数和 flags；`XRL.Collections.EventRegistry` 按事件 ID 管理监听器，并支持有序注册、派发、序列化和清理。Qud 的事件既能阻止动作，也能让多个部件修改同一事件。

本项目的 `Engine.emit` 已有有序监听、pending/recent 事件流和领域事件，并已加入 `before -> resolve -> after -> settled` 阶段、阶段过滤、优先级、取消与消费状态。现在每个事件还拥有可序列化 provenance（来源、行动者、目标、地点、父事件），并在导演事件结算期间自动形成父子来源链；`consequence.js` 另行保存失败/忽略的持久后果，供 NPC 记忆、势力和导演读取。对象参数类型化和更细粒度的部件订阅仍可继续增强，但动作结算已经有统一的阶段边界和可追溯因果链。

### 4. Brain 是目标栈，不是一次性目标字符串

`XRL.World.Parts.Brain` 持有 `Goals`、`Allegiance`、`FactionFeelings`、`Opinions`、`PartyMembers`、`LastThought`、移动/战斗半径和状态 flags。`XRL.World.AI.GoalHandler` 支持 `PushGoal`、子目标、插入父目标、`Pop`、`Finished`、`TakeAction` 和 `MoveTowards`。`MoveTo`、`Kill`、`Wait` 等目标处理器可以组成层级计划。

本项目此前的 `npc-ai.js` 只是在每四小时从目标字符串中选一个并立即执行。当前 `src/brain.js` 与 `src/goal-handler.js` 已将它改为可恢复流水线：NPC 先形成感知快照，再保存候选评分、当前决策、父子目标栈和下一步计划；移动、等待和目标动作分别消耗 handler 步骤，子目标结束后恢复父目标。`npc-ai.js` 仍兼容原有目标处理器，但已通过 Brain 运行 perception → decision → plan → step 的流水线。

### 5. Zone 是可挂起、可恢复的世界容器

`XRL.World.Zone` 保存 `Suspended`、`Stale`、`LastActive`、`LastCached`、地图、对象列表、队列事件、可见性/可达性和声音/导航图，并提供按 blueprint、tag、part 和距离查询对象的方法。区域不是一次性场景；离开后可以挂起，重新进入时恢复和结算。

当前项目的 `src/zone-runtime.js` 已增加区域激活/挂起、区域事件队列、离线结算和实体驻留：非活跃区域的环境实体会进入 `state.entityCache`，重新进入时按地点水合；命名 NPC、玩家和追捕/委托代理保持跨区域持久。长时间世界因此已经具备“活跃区域精算 + 非活跃区域实体缓存与摘要结算”的边界，后续仍可把更多持久 NPC 转成按需加载的区域对象。

### 6. Faction 是关系、声誉和兴趣的组合

`XRL.World.Faction` 不只是名称：它拥有玩家声誉、对其他势力的 feeling、rank、兴趣列表、秘密买卖偏好、圣地和可继承的父势力关系。Faction 可以决定交易、情报购买、敬拜、敌对和任务反应。

当前项目已经有势力 influence/attitude/tension、关系网络、情报案件和市场；`src/content.js` 的 `FACTION_INTERESTS` 现在声明各势力的买入品、卖出品、动机、资源偏置和战争动员/后勤压力。`market.js` 只负责通用 quote/trade 结算，并把交易量、金库与持仓倾向写回 `faction.market`；Zone 离线居民也读取同一份兴趣，形成 faction → economy → region → AI 的反馈链。

## 已迁移与未迁移

已迁移：组合式实体、组件生命周期注册表、可排序且按阶段取消/消费的领域事件、区域资源与活动、记忆/知识、身份面具、追捕代理人、动态委托、共享市场，以及带父子 GoalHandler 的 Brain 感知—决策—计划—执行轨迹。

尚未完成：装备覆盖对身体部位的动态约束、更多命名 NPC 的按需区域加载，以及更完整的效果定义内容包。事件阶段、可恢复的多层 GoalHandler、Body 的部位失能与蛊术约束、EffectRack 风格效果实例、环境实体缓存、区域挂起与离线结算的第一版都已落地；仍需把离线摘要扩展为区域级 NPC 经济、迁徙和战斗模拟，并将更多蛊虫/药效/环境危害迁入效果定义。这些是继续完全重构时的明确工程清单。
