# 前端程序逻辑

本项目当前是纯前端 HTML5 Canvas 游戏，无构建步骤，使用 ES Modules。

## 入口与主循环

- `index.html` 是入口页面。
- `src/main.js` 负责模块组装与初始化。
- `src/core/game.js` 包含 `Game`、`World` 和 `Viewport`，负责游戏循环、世界状态和视口变换。
- 全局时间使用 `performance.now()`，各模块应共用同一时间基准。

## 世界与实体

- `World` 维护 `units`、`bullets` 和 `CanvasPrompts`。
- `src/entities/units.js` 定义 `Unit`、`Fighter`、`Turret`、`Monster`、`Base` 等单位。
- `src/entities/projectiles.js` 定义 `Bullet` 与 `BulletFactory`。
- `src/entities/bullet_behaviors.js` 存放子弹行为插件，例如爆炸、燃烧和中毒。

## 战斗系统

- `src/core/weapons.js` 提供 `GunBasic`、`InstaWeaponBasic`、`MeleeWeapon` 和 `GunFactory`。
- 武器数据来自 `src/data/weapons_data.js`。
- `src/core/logic.js` 负责直接伤害结算和击杀回调。
- 子弹行为采用组合模式，新增复杂弹药优先写成 Behavior，而不是继续扩展深层继承。

## 战役系统

- `src/core/wave.js` 提供 `WaveManager`。
- `WaveManager` 通过依赖注入持有 `game` 和 `world`，避免直接制造模块循环。
- 战役存档写入 `localStorage`，使用稳定检查点策略。

## UI 与输入

- `src/core/btn_event.js` 负责主菜单、放置单位、视角交互、统计面板和沙盒按钮。
- `src/core/rts_control.js` 负责 RTS 框选、移动指令和强制攻击指令。
- `src/core/database.js` 负责武器数据库 UI。
- `src/core/performance_counter.js` 负责性能统计，报告当前帧耗时和最近 5 秒平均/峰值耗时。

## 渲染与性能

- 渲染基于 Canvas 2D。
- `src/core/SpriteCache.js` 缓存圆形/符号精灵，避免每帧重复绘制复杂形状。
- 使用四叉树筛选单位和子弹碰撞候选。
- 高频距离比较优先使用距离平方。
- Debug 信息已迁移到 Canvas 内绘制，避免频繁 DOM 更新造成重排。

## 测试

- 使用 Vitest 和 jsdom。
- 测试重点包括伤害管线、工具函数、战役存档、UI 事件和性能计数器。
- 修改战斗、战役、输入或存档行为时，应补充对应回归测试。
