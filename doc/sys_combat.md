# 战斗与武器系统 (Combat & Weapons)

本系统负责处理武器开火、弹道计算、伤害结算及各种异常状态。

## 武器核心 (`src/core/weapons.js`)

- 包含射弹武器 (`GunBasic`) 和即时命中/近战武器 (`InstaWeapon` / `MeleeWeapon`)。
- 武器实例化采用 `GunFactory`，通过读取 `weapons_data.js` 中的 JSON 属性自动组装。
- **距离限制**: 设定两级距离机制。武器 `range` 决定最大开火距离，`range2` (默认 3.5 倍 range) 决定子弹强制消失的极限距离。
- **伤害衰减**: 子弹飞行距离超过 `range` 后伤害开始线性衰减，直到 `range2` 时降至最低 25%。
- **数据统计**: 每把武器实时记录发射数、命中数、击杀数，以此计算准度、击杀率和 TTK（击杀时间）。

## 子弹行为与重构 (Bullet Composition)

- 为了避免 `Bullet` 基类因为各种特效（燃烧、追踪、分裂）变得臃肿，计划/已采用 **组合模式 (Composition) / 行为组件化**。
- 将子弹视为一个容器，提供生命周期钩子 (`onInit`, `onUpdate`, `onHit`, `onDeath`)。特效逻辑封装为独立的 Behavior 插件（如 `ExplodeBehavior`, `BurnOnHitBehavior`, `HomingBehavior`）在 Factory 组装。
- 此架构避免了深层继承带来的类爆炸问题。

## 范围伤害与爆破 (Splash Damage)

- RPG 和榴弹炮等武器在子弹死亡 (`onDeath`) 时触发范围爆炸。
- 爆炸逻辑：在死亡帧标记 `exploding` 并临时放大碰撞体积供 QuadTree 筛选范围内单位，然后根据距离计算衰减的爆炸伤害，支持近炸引信和友伤。

## 视觉表现

- 子弹支持曳光属性，通过多条不同 alpha 值的直线模拟高速弹道。
- 命中和爆炸会调用 `CanvasTextPrompt.js` 生成飘字和粒子特效。相同的 DOT (持续伤害) 效果在视觉和逻辑上都会进行叠加。

## 未来规划 (TODO)

- **后坐力机制深化**: 连续开火时后坐力随时间/弹药消耗增加，停火后衰减。
- **新武器类型**: 跟踪导弹 (Homing)、闪电炮 (瞬间弹射)、光束炮 (直线贯穿)、地震炮 (AOE)、医疗枪 (加血)、引力炮 (给附近子弹施加随机加速向量干扰轨迹)。
- 统一 `InstaWeapon` 和 `Bullet` 的底层逻辑，使用相同的命中结算以简化代码。
