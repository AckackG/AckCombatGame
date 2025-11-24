# 我要解决什么问题？
随着子弹特效增多，Bullet 属性会越来越多，但实际用上的属性却不多。急需一个解决方法

# 解决
最适合你当前架构且易于扩展的方案是：**组合模式 (Composition) / 行为组件化 (Behavior Components)**。

其实你的方案2（回调函数）是正确的方向，但需要更规范化，防止 Factory 里的代码变成面条代码。

### 为什么方案 1 (子类) 不行？
如果你有“燃烧弹”和“追踪弹”。当你想要一个“追踪燃烧弹”时，你无法通过继承同时拥有这两个类的特性（JS不支持多继承），会导致类的爆炸（`HomingBullet`, `FireBullet`, `HomingFireBullet`...）。

### 为什么方案 3 (堆属性) 不行？
你现在的 `Bullet` 类里已经有了 `exploding_radius`, `exploding_damage`, `exploding_ff`。如果以后加入冰冻、吸血、分裂，`Bullet` 类会变成几千行的“上帝类”，每个子弹实例都背负着不需要的属性，内存浪费且难以维护。

---

### 推荐架构：轻量级组件/行为系统

将子弹视为一个**容器**，特效视为**插件**。

#### 1. 修改 `Bullet` 基类 (在 `objects/projectiles.js`)
把具体的业务逻辑（如爆炸）剥离，改为提供**生命周期钩子 (Hooks)**。

```javascript
// 修改后的 Bullet 类结构思路
export class Bullet extends BulletBasic {
  constructor(config) {
    super(config);
    // ... 基础物理属性 (x, y, speed, dx, dy) 保持不变 ...
    
    // 核心改变：不再写死 exploding 等属性，而是使用行为列表
    this.behaviors = []; 
    
    // 允许 Factory 直接传入 behavior
    if (config.behaviors) {
      config.behaviors.forEach(b => this.addBehavior(b));
    }
  }

  addBehavior(behavior) {
    this.behaviors.push(behavior);
    // 如果行为需要初始化（比如修改子弹颜色，或者增加初始速度）
    if (behavior.onInit) behavior.onInit(this);
  }

  update() {
    this._move();
    
    // 钩子：每帧更新 (用于追踪导弹、变加速等)
    this.behaviors.forEach(b => b.onUpdate?.(this));
    
    this._update_lifetime();
  }

  onHit(target, damage) {
    // ... 基础伤害计算 ...

    // 钩子：命中后 (用于燃烧、冰冻、吸血)
    this.behaviors.forEach(b => b.onHit?.(this, target));

    this._onHit_UpdateBullet(target); // 穿透计数等逻辑
  }

  _on_death() {
    // 钩子：死亡/销毁时 (用于爆炸、分裂)
    this.behaviors.forEach(b => b.onDeath?.(this));
  }
}
```

#### 2. 定义行为模块 (新建 `objects/bullet_behaviors.js`)
将特效逻辑封装成独立的简单对象或类。

```javascript
import { CanvasCircle } from "../mylibs/CanvasTextPrompt.js";
import { DOT } from "../mylibs/effects.js";
import { unit_distance } from "../mylibs/utils.js";
import { world } from "../mylibs/game.js";

// 爆炸行为
export const ExplodeBehavior = (damage, radius, is_ff = false) => ({
  onDeath: (bullet) => {
    // 移植原本 Bullet._explode 的逻辑
    let units = world.UnitsQT.retrieve(bullet);
    units.forEach((unit) => {
      if ((unit.color !== bullet.color && !is_ff) || is_ff) {
        let dis = unit_distance(unit, bullet) - unit.size;
        if (dis <= radius && !unit.dead) {
          // 简单的线性衰减计算
          bullet.onHit(unit, damage); 
        }
      }
    });
    CanvasCircle.explosion(bullet.x, bullet.y, radius, bullet.color, 2000);
  }
});

// 燃烧行为 (DOT)
export const BurnOnHitBehavior = () => ({
  onHit: (bullet, target) => {
    target.add_effect(DOT.burning(target, bullet.source_weapon));
  }
});

// 追踪行为
export const HomingBehavior = (turnRate = 0.1) => ({
  onUpdate: (bullet) => {
    // 这里写追踪最近敌人的逻辑，修改 bullet.dx/dy 或 angle
    // 如果没有目标，寻找目标...
  }
});
```

#### 3. 在 Factory 中组装 (在 `objects/projectiles.js`)
现在 `BulletFactory` 变成了真正的组装工厂。

```javascript
import { ExplodeBehavior, BurnOnHitBehavior } from "./bullet_behaviors.js";

export class BulletFactory {
  // ...

  // 比如我们要造一个“高爆燃烧榴弹”
  static HighExplosiveIncendiary({ x, y, angle, source_unit, source_weapon }) {
    let b = new Bullet({
      x, y, angle, source_unit, source_weapon,
      speed: 15,
      size: 4,
      // 直接不需要 exploding=true 这种 flag 了
    });

    // 组合特效：既爆炸，又点燃
    b.addBehavior(ExplodeBehavior(75, 75, true)); // 伤害75，范围75，友伤开启
    b.addBehavior(BurnOnHitBehavior()); // 命中(或爆炸波及)会点燃

    return b;
  }
}
```

### 总结建议

1.  **架构选择**：**组合模式**。
2.  **具体操作**：
    *   不要删减 `Bullet` 现有的 `_move` 等基础物理逻辑，那是通用的。
    *   将 `Bullet` 中特定业务逻辑（`exploding` 相关属性、`tracer` 相关逻辑）逐步剥离。
    *   在 `Bullet` 中预留 `onInit`, `onUpdate`, `onHit`, `onDeath` 四个钩子数组。
    *   利用 JS 对象的灵活性，Behavior 不需要是复杂的类，简单的 Object 包含函数即可。

**这样做的好处：**
*   **解耦**：`Bullet` 类变回纯粹的物理实体，不再关心业务。
*   **复用**：`ExplodeBehavior` 可以给榴弹用，也可以给火箭筒用，甚至可以给死亡的自爆怪物用。
*   **无限扩展**：未来想加“击中回血”，只需写一个 5 行的 Behavior，不需要改动 Bullet 核心代码，风险极低。