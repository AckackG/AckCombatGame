# Project: Ballistics - 战役模式功能开发指令 (GEMINI CLI 版)

请按照以下顺序依次执行指令。

## 指令 1：实现动态难度伸缩 (WaveManager)

**目标**：修改波次管理器，根据玩家场上单位的强度动态增加敌人的数量，并根据波数增加怪物的强度和士兵的等级。

**Input Context:**
文件: `mylibs/wave.js`

**Prompt:**
```text
请编辑 mylibs/wave.js 文件，对 WaveManager 类进行以下修改以实现动态难度：

1.  **新增私有方法 `_calculatePlayerStrength()`**:
    *   遍历 `this.world.units`。
    *   筛选出 `color` 等于 `this.game.player_color` 的单位。
    *   累加它们的 `.value` 属性并返回总和。

2.  **修改 `spawnWave()` 方法**:
    *   保留原有的 `this.waveNumber++`。
    *   计算玩家强度: `const playerStrength = this._calculatePlayerStrength();`。
    *   计算生成数量: `let baseCount = 5 + this.waveNumber * 2;`
    *   加入动态伸缩: `let dynamicCount = Math.floor(playerStrength * 0.001);` (系数可微调)。
    *   `const spawn_count = Math.min(baseCount + dynamicCount, this.maxSpawnsPerWave);`。
    *   保留原有的 `spawnType` 切换逻辑。

3.  **修改 `#spawn_monsters(count)` 方法**:
    *   计算强度乘数: `const intensity = 1 + (this.waveNumber * 0.1);`。
    *   在调用 `Monster.spawn_fast`, `spawn_normal`, `spawn_big` 时，将 `intensity` 作为 `monster_mul` 参数传入 (注意：目前的 Monster spawn 函数已经支持接受对象参数，如 `{ monster_mul: intensity }`，请确保参数传递正确)。

4.  **修改 `#spawn_enemy_soldiers(count)` 方法**:
    *   根据 `this.waveNumber` 决定生成的单位类型：
    *   如果是前 3 波，只生成 `Battalion.spawn_infantry`。
    *   第 4-8 波，混合生成 `Battalion.spawn_veteran`。
    *   第 9 波以后，混合生成 `Battalion.spawn_specOps`。
    *   特殊小队逻辑保持不变，但可以根据波数略微提升其武器随机强度。
```

---

## 指令 2：实现单位升级系统 (Fighter Class)

**目标**：让玩家的 `Fighter` 单位在击杀敌人后获得经验并升级，提升属性。

**Input Context:**
文件: `objects/units.js`

**Prompt:**
```text
请编辑 objects/units.js 文件，修改 Fighter 类以实现升级系统：

1.  **修改 `_onkill(victim)` 方法**:
    *   保留原有的 `super._onkill(victim)` 和 `this.exp += victim.value`。
    *   保留原有的 `this.weapon.boost_reload(...)`。
    *   **添加升级检测逻辑**:
        *   计算升级所需经验: `const expNeeded = 1000 + (this.level * 500);`。
        *   如果 `this.exp >= expNeeded`，执行升级：
            *   `this.level++`。
            *   `this.exp -= expNeeded`。
            *   **提升属性**:
                *   `this.maxhp *= 1.1;` (提升10%最大生命)。
                *   `this.hp = this.maxhp;` (回满血)。
                *   `this.speed = Math.min(this.speed + 0.1, 5);` (微量提升移速)。
                *   `this.hp_regen += 2;`。
                *   `this.weapon.ReloadTime = Math.max(500, this.weapon.ReloadTime * 0.9);` (减少10%换弹时间)。
                *   `this.weapon.recoil = Math.max(0.1, this.weapon.recoil * 0.9);` (减少10%后坐力)。
            *   **视觉与听觉反馈**:
                *   播放音效: `soundManager.play('levelup', { position: { x: this.x, y: this.y } });`。
                *   显示提示: 
                    ```javascript
                    world.CanvasPrompts.push(
                      new CanvasTextPrompt({
                        text: "LVL UP!",
                        unit: this,
                        color: "gold",
                        size: 15,
                        lifetime: 2000,
                        vy: -1,
                      })
                    );
                    ```
```

---

## 指令 3：完善 UI 显示 (Index & WaveManager)

**目标**：在游戏界面上显示当前的波次信息和倒计时。

**Input Context:**
文件: `index.html`, `mylibs/wave.js`

**Prompt:**
```text
请分两步修改文件以完善战役模式 UI：

**Step 1: 修改 index.html**
在 `<div class="info">` 内部，`<div id="stat"></div>` 的下方，添加一个新的 div 用于显示波次信息：
`<div id="wave-info" style="color: #ff4444; font-weight: bold; margin-top: 5px;"></div>`

**Step 2: 修改 mylibs/wave.js**
在 `WaveManager` 类中：
1.  添加一个 helper 方法 `renderUI()`：
    *   获取 DOM 元素 `const ui = document.getElementById("wave-info");`。
    *   如果 `ui` 存在，更新其 `textContent`：
        *   显示格式: `WAVE: ${this.waveNumber} | NEXT: ${(this.timeToNextWave / 1000).toFixed(1)}s | ENEMIES: ${this.hasEnemies ? "ACTIVE" : "CLEARED"}`。
2.  在 `update(dt)` 方法的末尾调用 `this.renderUI()`。
```