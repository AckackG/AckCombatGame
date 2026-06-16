# 核心引擎架构 (Core Engine)

本项目采用纯净的 ES Modules 和 Vanilla JS 构建，不依赖任何第三方引擎，基于 HTML5 Canvas 2D 渲染。

## 游戏主循环 (Game Loop)
- **`Game` 类 (`src/core/game.js`)**: 负责管理全局时间步进、FPS 计算、以及调度 `World` 和其他系统的 `update` 与 `render` 方法。
- 全局时间使用统一的 `performance.now()` 获取，确保不同模块的时间基准一致。

## 世界状态 (World)
- **`World` 类**: 维护当前游戏的所有实体状态，包括战斗单位 (`units`)、子弹 (`bullets`)、视觉特效 (`CanvasPrompts`)。
- 实体与子弹数组分离管理，以优化遍历性能。

## 空间划分与碰撞检测 (QuadTree)
- 使用四叉树 (`src/core/quadtree.js`) 管理和筛选“附近单位”，极大优化了 O(n^2) 的碰撞检测和索敌开销。
- 碰撞检测算法：使用圆和线段相交算法判定子弹击中，解决了高速子弹在一帧内“穿过”单位导致未命中判断的问题。
- 不再计算子弹与子弹之间的碰撞，仅计算子弹与单位、或单位与单位的碰撞。

## 未来规划 (TODO)
- 更新为支持圆形、线段、多边形的高级 QuadTree (quadtree2.0-ts)。
- 探索将单位间的物理碰撞排斥逻辑从全局 Game Loop 移动到 Unit 自身的 update 中。
