# 蛊真人 · 青茅山 Simulation-First RPG

这是一个从《蛊真人》小说原文素材重建的持续世界 RPG 原型。它不把小说强行展开成固定分支树，而是让玩家、NPC、势力、资源、记忆和时间共同推进世界。

当前工作目录：`D:\Caves of Qud\gu-rpg`

远端仓库：[Liang-techh/gu](https://github.com/Liang-techh/gu)

## 已落地的世界内核

- 确定性世界时钟与小时级推进；
- 玩家/NPC 共用的组件式实体模型；
- 独立运行时内核：组件查询、领域事件流、GoalHandler 注册表和 Conversation/Interaction 注册表；
- `identity / position / needs / cultivation / personality / schedule / goals / memory / inventory` 组件；
- 事件历史、导演事件和统一 `dispatch` 结算入口；
- NPC 日程、目标选择、移动、饥饿/精力和同场遭遇记忆；
- NPC 目标会实际改变资源、秘密事实、商路活动和势力压力；
- 人物关系中的信任、畏惧、人情和持久事实；
- 古月、白家、熊家、商队、魔道游修等动态势力；
- 地点资源、天气、危险度、访问量和基于人口表生成的环境居民；
- 商队进入、三寨联盟议事、狼潮逼近等会改变资源与势力关系的长期世界事件；
- 身体组件、随机部位伤害、伤口、死亡与连续冲突；
- 自由意图解析：自然语言只生成 command，不能直接改状态；
- 本地 JSON 存档与确定性恢复；
- 基于小说原文的青茅山开局：开窍大典、方源、方正、学堂、竹林、月光蛊、酒虫与遗藏线索。

## 运行

```powershell
cd 'D:\Caves of Qud\gu-rpg'
npm test
python -m http.server 4173
```

然后打开 `http://localhost:4173/`。

## 代码边界

`src/simulation.js` 是唯一规则核心：时间、行动、NPC、记忆、势力、导演和存档验证都在这里。`src/app.js` 只负责把状态投影成 UI，并把按钮/文本转换为 command。以后接入模型时，模型只能提出意图或叙述草稿，不能绕过 simulation kernel。

`reference/novel/` 是内容依据；新增角色、地点、蛊虫或事件前先从原文核对。游戏化数值和新系统会明确标为改编规则。

## Caves of Qud 逆向抽象边界

本项目参考 `D:\Caves of Qud` 本地安装中的公开可读数据结构和程序集元数据：势力 XML、对话 XML、命令定义、历史生成数据、区域/人口表，以及 `Parts / Events / GoalHandlers / Conversations / HistoryKit` 等模块边界。不会复制 Qud 的 DLL、文本、美术或资产。

具体审计见 [docs/QUD_LOCAL_AUDIT.md](docs/QUD_LOCAL_AUDIT.md)，架构说明见 [docs/SIMULATION_ARCHITECTURE.md](docs/SIMULATION_ARCHITECTURE.md)。

## 验证状态

```text
npm test       15/15 passing
npm run check:canon  20/20 term/source checks
```

当前是可运行的青茅山垂直切片，不声称已经完成 Qud 级别的格点物理、身体部位、液体/温度、完整历史生成和全卷内容。后续系统会继续以可测试的组件/事件模块逐层加入。
