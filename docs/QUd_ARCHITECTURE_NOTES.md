# Caves of Qud 架构逆向笔记

本笔记来自本机 `D:\Caves of Qud\CoQ_Data\Managed\Assembly-CSharp.dll` 的反射检查，而不是凭印象模仿。该安装包的 Assembly-CSharp 版本为 `2.0.209.29`。目标是提炼可迁移的 simulation-first 结构，不复制 Qud 的具体内容或实现代码。

## 观察到的核心边界

### 1. 实体是组合对象，不是继承树

`XRL.World.GameObject` 直接持有 `Brain`、`Body`、`Inventory`、`ActivatedAbilities`、`Statistics`、`PartRack` 和 `EffectRack` 等可替换部件，并通过 `HasPart`/同类查询访问能力。实体的物理、行为、装备、效果和统计可以独立增删。

蛊真人项目对应到：`engine.js` 的 component registry、`entity.js` 的组件化实体，以及新加入的 `brain` 组件。下一步的身体部位、蛊虫、状态效果和身份面具都应继续保持可组合，而不是为每种 NPC 建立专用类。

### 2. Part 同时拥有生命周期和事件订阅

`XRL.World.IPart` 的公开契约包含 `Attach`、`Initialize`、`AddedAfterCreation`、`Remove`、`ObjectLoaded`、`Save/Load`、`DeepCopy`，并支持 `RegisterEvent` / `UnregisterEvent`。这说明部件不仅是数据字段，也是可以在实体生命周期中注册行为的运行时模块。

当前项目的 `attach/detach/patchComponent` 已提供数据层入口，`registerEventListener` 提供全局事件入口。本轮先把 NPC 的 `brain` 做成独立模块；后续应为组件增加 `onAttach/onDetach/onEvent/serialize` 生命周期，令蛊虫、伤势、身份和装备可以自注册规则。

### 3. 事件是参数化领域消息，不是字符串日志

`XRL.World.Event` 保存 ID、对象参数、字符串参数、整数参数和 flags；`XRL.Collections.EventRegistry` 按事件 ID 管理监听器，并支持有序注册、派发、序列化和清理。Qud 的事件既能阻止动作，也能让多个部件修改同一事件。

本项目的 `Engine.emit` 已有有序监听、pending/recent 事件流和领域事件；与 Qud 的差距是事件目前主要是普通 JSON payload，尚未有取消、消费、阶段和来源链。以后动作结算应统一经过 `before -> resolve -> after` 事件阶段，而不是直接写状态。

### 4. Brain 是目标栈，不是一次性目标字符串

`XRL.World.Parts.Brain` 持有 `Goals`、`Allegiance`、`FactionFeelings`、`Opinions`、`PartyMembers`、`LastThought`、移动/战斗半径和状态 flags。`XRL.World.AI.GoalHandler` 支持 `PushGoal`、子目标、插入父目标、`Pop`、`Finished`、`TakeAction` 和 `MoveTowards`。`MoveTo`、`Kill`、`Wait` 等目标处理器可以组成层级计划。

本项目此前的 `npc-ai.js` 只是在每四小时从目标字符串中选一个并立即执行。本轮新增 `src/brain.js`：NPC 先形成感知快照，再保存候选评分、当前决策、目标栈和下一步计划；`npc-ai.js` 仍兼容原有目标处理器，但已通过 Brain 运行 perception → decision → plan → step 的流水线。这样后续可以把“发现敌人→追踪→接近→战斗/撤退”改成真正的子目标栈。

### 5. Zone 是可挂起、可恢复的世界容器

`XRL.World.Zone` 保存 `Suspended`、`Stale`、`LastActive`、`LastCached`、地图、对象列表、队列事件、可见性/可达性和声音/导航图，并提供按 blueprint、tag、part 和距离查询对象的方法。区域不是一次性场景；离开后可以挂起，重新进入时恢复和结算。

当前项目的 `src/zone-runtime.js` 已增加区域激活/挂起、区域事件队列和离线结算：玩家所在区域走前台每日规则，非活跃区域按离线小时做资源、活动度、危险度和冲突摘要推进，重新进入时恢复并补结算。NPC 实体暂时仍保存在统一实体表，下一步可以在这个生命周期边界上增加逐区域实体流式加载/卸载，把长时间世界审计进一步推进为“活跃区域精算 + 非活跃区域摘要结算”。

### 6. Faction 是关系、声誉和兴趣的组合

`XRL.World.Faction` 不只是名称：它拥有玩家声誉、对其他势力的 feeling、rank、兴趣列表、秘密买卖偏好、圣地和可继承的父势力关系。Faction 可以决定交易、情报购买、敬拜、敌对和任务反应。

当前项目已经有势力 influence/attitude/tension、关系网络、情报案件和市场；`market.js` 已将部分势力兴趣抽象成可配置的买入品、卖出品和动机，并把交易量、金库与持仓倾向写回 `faction.market`。后续应把这组政策继续迁入内容包，避免长期依赖代码内默认表。

## 已迁移与未迁移

已迁移：组合式实体、组件生命周期注册表、可排序且可取消/消费的领域事件、区域资源与活动、记忆/知识、身份面具、追捕代理人、动态委托、共享市场，以及 Brain 的感知—决策—计划审计轨迹。

尚未完成：完整的组件生命周期、事件可取消/分阶段结算、可配置 faction interests、真正的多层 GoalHandler 子目标执行、身体部位对能力和装备的动态约束，以及区域实体的真正流式加载/卸载。区域挂起与离线结算的第一版已落地，但仍需把离线摘要逐步扩展为区域级 NPC 经济、迁徙和战斗模拟。这些是继续完全重构时的明确工程清单。
