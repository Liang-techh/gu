# 蛊真人 · 青茅山沉浸叙事沙盒

0.4 版把主界面彻底改成 **角色立绘 + 全屏场景 + 对话/行动为主交互 + 极简 HUD**。底层 `content.js`、`engine.js`、存档 schema 和延迟后果系统保持不变，因此 0.2 / 0.3 的当前版本存档可以继续使用。

> 专有名词以仓库 `reference/novel/` 原文核对；新增剧情、数值、UI、关系变化与时间表属于同人游戏设计，不冒充原著正文。

## 在线试玩

GitHub Pages：

`https://liang-techh.github.io/gu/`

每次 `main` 更新后 Pages 会重新部署。若刚部署完成仍看到旧画面，可强制刷新浏览器缓存。

本地也可以直接打开根目录 `index.html`，或在仓库目录运行：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 0.4 Immersive UI

### 1. 玩家首先看到“世界和角色”，而不是状态表

默认行止界面现在是全屏场景。画面持续显示你的原创玩家立绘、当前地点、时间、境界、真元和少量必要信息；详细变量被收进菜单。

自由行动时，右侧只出现当前地点真正能做的行为和相邻路线。遇到事件后，界面自动切换成视觉小说式对话舞台：

```text
场景背景
├─ 你的角色立绘
├─ 当前 NPC 立绘位
├─ 地点 / 时间极简 HUD
└─ 对话框
   ├─ 事件正文
   └─ 条件选择
```

战斗也进入独立舞台，而不是和普通操作混在一张卡片里。

### 2. 开局先让玩家进入青茅山

新局创建窗口现在带有完整开场画面和玩家立绘，并先交代：

- 南疆、十万大山、青茅山
- 今天是开窍大典
- 资质会影响家族投入和修行压力
- 元石既是货币，也是修行资源
- 选择会留下后果

玩家在看到大量属性数字之前，先知道“自己是谁、这里是什么地方、为什么当前选择重要”。

### 3. 原创玩家立绘已进入仓库

新增：

`assets/portraits/player.svg`

这是本项目自己的本地矢量角色立绘，没有外部图片请求，也不依赖 CDN。以后可以直接替换为更高质量 PNG / WebP / 动态 Live2D 风格资产，而无需修改 `engine.js`。

### 4. 数值退到第二层

主画面只保留：

- 地点 / 时间 / 天气
- 当前境界
- 真元
- 元石
- 粗略身体状态

精确的疲劳、伤势、怀疑、家族评价、债务等信息在右下“菜单”中查看。这样游戏默认不再像电子表格或后台管理系统。

### 5. 固定底部游戏导航

底部 Dock 提供：

- 行止
- 地图
- 蛊虫
- 人物
- 买卖
- 往事
- 因果图
- 菜单

切页仍然调用旧 `app.js` 的真实页面逻辑，不创建第二套状态机。

### 6. 试玩反馈更方便

菜单新增“复制试玩状态”。它只复制当前版本、游戏日、地点、境界、事件、元石、真元、伤势、疲劳、怀疑、未了事项和世界种子。

你可以直接把这段文字粘贴到 ChatGPT，例如：

```text
我在这个状态下觉得“私吞钱袋”之后的追问来得太快：
[粘贴试玩状态]
```

这样可以精确定位问题，不必每次手动解释整局进度。

## 保留的核心系统

- 青茅山 10 个相邻地点与线索入口
- 23 个剧情节点、68 个选择、延迟后果
- 7 位原著人物的信任 / 敌意 / 人情 / 资源 / 修行 / 记忆
- 甲乙丙丁资质，一至五转与四个小境界
- 月光蛊、酒虫：炼化、食料、生机、饥饿、本命蛊反噬
- 真元、元石、资源库存、借债、偿债、商队订单
- 回合制战斗、逃离、月刃、伤势与中毒
- 自动存档、3 个手动存档、JSON 导入导出
- 人物话题层与剧情因果图

## 架构

```text
0.4 沉浸表现层
assets/immersive-v4.css
src/visual-ui.js
assets/portraits/player.svg
        ↓
叙事表现元数据
src/narrative.js
        ↓
剧情 / 原文术语数据
src/content.js
        ↓
世界规则与唯一状态裁判
src/engine.js
        ↓
RNG / queue / history / save validation
```

`visual-ui.js` 不调用 `engine.dispatch()` 直接改状态，也不写 `s.v`。它只生成现有 `data-cmd` 指令，由原来的 `app.js → engine.dispatch()` 统一结算。

## 文件结构

```text
index.html
src/
  content.js          原文术语、地点、人物、事件与选择数据
  engine.js           确定性规则、时间、战斗、经济、存档验证
  app.js              浏览器交互与存档
  narrative.js        场景、人物、话题、剧情分组
  visual-ui.js        0.4 沉浸式表现适配器
assets/
  game.css
  visual-v3.css
  visual-bridge.css
  immersive-v4.css
  portraits/
    player.svg        原创玩家角色立绘
tests/
  engine.test.cjs
  narrative.test.cjs
  immersive-ui.test.cjs
docs/
  DESIGN.md
  NARRATIVE_ARCHITECTURE.md
reference/novel/      用户放入仓库的原文资料
```

## 测试

需要 Node.js 18+：

```bash
npm test
npm run check:canon
```

`npm test` 现在会先运行 `node --check src/visual-ui.js` 和 `src/app.js`，再执行全部规则与叙事回归测试。`immersive-ui.test.cjs` 额外检查本地立绘、入口资源顺序、沉浸式关键组件，以及视觉层没有绕过规则引擎直接写核心状态。

## 当前边界

0.4 已经解决“像网页后台、不像在操控角色”的主要表现问题，但美术仍属于第一版原创矢量资产：玩家有正式本地立绘，NPC 暂时仍使用风格化立绘位。下一阶段可以继续加入原创 NPC 立绘、地点背景、蛊虫卡面、环境音和 BGM。

AI 实时剧情还没有接入。未来如果接 OpenAI API，会经过独立服务器代理；AI 负责场景文字、NPC 对话和候选事件，现有 `engine.js` 继续决定哪些状态改动真正合法。
