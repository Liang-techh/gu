# Legacy prototype archive

本目录保存仓库重构前的选项 MUD、旧视觉小说、旧测试和旧样式，仅用于追溯历史与对照迁移。

它不参与当前入口、`npm test` 或 `npm run check:canon`。新的运行链只有：

- `src/simulation.js`
- `src/app.js`
- `assets/simulation.css`
- `reference/novel/`

如果旧原型中的某条内容要迁移，必须重新按 `docs/SIMULATION_ARCHITECTURE.md` 拆成状态、组件、事件、记忆或势力规则，而不是直接重新接回旧状态机。
