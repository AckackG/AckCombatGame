好的，这是一个针对“战役模式”功能的评估与分步开发文档。

本文档旨在提供一个清晰、低耦合、可分步实施和测试的开发路线图。

### 整体评估

“战役模式”的引入将游戏从一个简单的沙盘对战模拟器转变为一个有持续目标和挑战的生存游戏。核心是创建一个能够动态调整难度、管理敌人波次并提供玩家成长反馈的系统。

现有代码基础良好，提供了许多可以直接利用的模块：
*   **单位生成**: `Battalion.js` 和 `units.js` 中的 `spawn_*` 函数可以方便地创建不同类型的单位。
*   **武器系统**: `weapons.js` 中的 `GunFactory` 和武器属性是动态调整难度的关键。
*   **视觉反馈**: `CanvasTextPrompt.js` 可以用于显示波数、升级等关键信息。
*   **玩家金钱系统**: `game.js` 中的 `game.money` 机制可以直接复用。
*   **单位AI**: 现有的寻敌和战斗逻辑 (`_find_target`, `attack`) 足够支持战役模式。

关键的挑战在于设计一个优雅的波次管理和难度伸缩系统，并将其无缝集成到现有的游戏循环中。

---

### 开发步骤

我们将开发过程分为六个主要步骤。每个步骤都是在前一个步骤基础上的扩展，可以独立进行测试。

#### **第一步：基础框架搭建与游戏模式切换**

这是准备工作，目标是让游戏知道“战役模式”的存在，并为此准备好环境。

1.  **创建新文件**:
    *   在 `mylibs/` 目录下创建一个新文件 `wave.js`。这个文件将包含所有与波次生成、难度控制和战役状态管理相关的逻辑。

2.  **游戏状态管理**:
    *   在 `game.js` 的 `Game` 类中，引入一个游戏状态变量，例如 `this.currentMode = 'MENU';`（可选值：`'MENU'`, `'SANDBOX'`, `'CAMPAIGN'`)。
    *   修改 `index.html`，将主菜单的“战役模式”按钮取消禁用，并为其添加 `id="btn-campaign"`。
    *   修改 `index.html` 中的脚本和 `btn_event.js`，使得点击“沙盘模式”或“战役模式”按钮后，能设置正确的 `game.currentMode` 并启动游戏。

3.  **UI 调整**:
    *   在 `btn_event.js` 或 `game.js` 中，创建一个函数，根据 `game.currentMode` 来显示或隐藏特定的UI按钮。
    *   当 `game.currentMode === 'CAMPAIGN'` 时：
        *   隐藏 “测试步兵单位”, “测试怪物单位”, “显示DEBUG信息”, “性能测试” 以及所有 `debug_units` 相关的按钮。
        *   仅保留“暂停游戏”和 `units` (购买单位) 区域的按钮。

4.  **集成入口**:
    *   在 `main.js` 中引入新建的 `wave.js` 文件 (`import "./mylibs/wave.js";`)。
    *   修改 `game.js` 中的 `start_game()` 函数。让它在 `game.currentMode === 'CAMPAIGN'` 时，调用 `wave.js` 中的初始化函数（例如 `WaveManager.start()`)。

**测试点**:
*   点击主菜单的“战役模式”按钮后，游戏能正常开始。
*   进入战役模式后，沙盘和Debug相关的按钮被正确隐藏。
*   游戏的核心功能（暂停、购买单位、放置单位）仍然正常工作。

---

#### **第二步：实现玩家基地与胜负条件**

这个步骤为战役模式设立了最基本的目标：保护基地。

1.  **创建基地类 (Base)**:
    *   在 `objects/units.js` 中，可以参考 `Dummy` 类创建一个继承自 `Unit` 的新类 `Base`。
    *   `Base` 类的特性：
        *   极高的生命值 (20000 HP)。
        *   `speed` 为 0，不可移动。
        *   没有武器 (`weapon: null`)。
        *   重写 `update()` 方法，使其不执行任何移动或攻击逻辑，只检查生命状态。
        *   设置一个非常大的 `size` (例如 40) 和独特的颜色。
        *   会自动恢复血量

2.  **在战役开始时生成基地**:
    *   在 `wave.js` 的战役初始化函数 `WaveManager.start()` 中：
        *   计算基地位置：地图宽度 (`world.pos_range.width`) 的 1/5 处，高度1/3处。
        *   创建一个 `Base` 实例并将其添加到 `world.units` 数组中。

3.  **实现失败条件**:
    *   在 `wave.js` 的主更新循环中 (后面会创建)，每一帧检查基地的 `dead` 状态，可以用更省性能的 updateslow
    *   如果基地 `dead` 属性为 `true`，则战役失败。
    *   战役失败后：
        *   设置 `game.paused = true;` 来冻结游戏。
        *   在屏幕中央显示 "GAME OVER" 的信息（可以使用 `CanvasTextPrompt` 或者一个HTML覆盖层）。
        *   停止所有波次生成逻辑。

**测试点**:
*   战役开始时，一个大型基地单位会出现在地图左侧的正确位置。
*   使用Debug单位攻击基地，当基地HP归零后，游戏暂停并显示失败信息。

---

#### **第三步：核心波次系统 (间隔刷新)**

实现基础的敌人刷新机制，这是战役模式的核心玩法循环。

1.  **创建波次管理器 (WaveManager)**:
    *   在 `wave.js` 中，创建一个单例对象或类，如 `WaveManager`。
    *   添加状态属性：
        *   `waveNumber`: 当前波数。
        *   `waveInProgress`: 布尔值，标记当前是否处于一波敌人中。
        *   `timeToNextWave`: 下一波开始的倒计时 (ms)。
        *   `baseInterval`: 两波之间的基础间隔时间 (例如 60000ms)。
        *   `spawnType`: 'monster' 或 'soldier'，用于交替刷新。

2.  **时间驱动的刷新逻辑**:
    *   在 `WaveManager` 中创建一个 `update()` 函数，并在 `game.js` 的主游戏循环 `_gameloop` 中调用它。
    *   在 `update()` 函数中：
        *   如果 `waveInProgress` 为 `false`，则减少 `timeToNextWave` 计时。
        *   当 `timeToNextWave` 倒数到 0 时，触发新一波的生成。

3.  **实现加速刷新机制**:
    *   在 `update()` 函数的计时逻辑中，增加一个检查：场上是否存在非玩家单位。
    *   可以遍历 `world.units`，检查 `unit.color !== game.player_color`。
    *   如果不存在任何敌方单位，将 `timeToNextWave` 其设置为一个很小的值 (如 10000ms)，以快速开启下一波。

4.  **实现基础的生成逻辑**:
    *   创建一个 `spawnWave()` 函数。
    *   函数内，根据 `spawnType` 交替调用 `Battalion.js` 或 `Monster` 的 `spawn_*` 方法。
    *   在这一步，先使用固定的敌人数量和类型（例如，第一波刷5个 `Monster.spawn_fast`，第二波刷5个 `Battalion.spawn_infantry`）。
    *   生成敌人后，设置 `waveInProgress = true;`，并重置 `timeToNextWave`。
    *   切换 `spawnType` 为下一种类型。

**测试点**:
*   游戏开始后，经过设定的间隔时间，在地图右侧刷出第一波敌人。
*   当所有敌人被消灭后，下一波的倒计时显著加快。
*   第二波敌人与第一波的类型不同（怪物/士兵交替）。

---

<h4><strong>第四步：动态难度伸缩 (数量与强度)</strong></h4>

让敌人的威胁随游戏进程动态增长，增加挑战性。

1.  **定义“玩家在场单位强度”**:
    *   在 `WaveManager` 中创建一个函数 `calculatePlayerStrength()`。
    *   这个函数遍历 `world.units` 中所有颜色为 `game.player_color` 的单位。
    *   累加每个单位的 `unit.value` 属性。这个属性已经很好地综合了单位的HP、武器伤害、击杀数等，非常适合作为强度指标。返回总和。

2.  **实现数量伸缩**:
    *   修改 `spawnWave()` 函数。
    *   定义一个基础数量 `baseCount = 5 + waveNumber`。
    *   计算玩家强度 `playerStrength = calculatePlayerStrength()`。
    *   定义一个伸缩因子 `scalingFactor` (例如 0.001)。
    *   最终生成数量 `finalCount = baseCount + Math.floor(playerStrength * scalingFactor)`。

3.  **实现强度伸缩**:
    *   在 `spawnWave()` 中，根据 `waveNumber` 或游戏总时长 `game.time_now` 来增加敌人的强度。
    *   **对于怪物**:
        *   `Monster` 的构造函数和静态生成函数已经有一个 `monster_mul` 参数。我们可以利用它。
        *   `let monsterMultiplier = 1 + (waveNumber * 0.1);`
        *   在调用 `Monster.spawn_*` 时，将这个乘数传入，或者修改 `spawn_*` 函数使其能接受强度参数。
    *   **对于士兵**:
        *   在低波数时，使用 `Battalion.spawn_infantry`。
        *   随着波数增加 (例如 `waveNumber > 5`)，开始混合生成 `Battalion.spawn_veteran`。
        *   在更高波数时 (`waveNumber > 10`)，生成 `Battalion.spawn_specOps`，并赋予他们更好的武器 (`GunFactory.random_gun(0.3)`)。

**测试点**:
*   在场上放置大量我方单位后，下一波生成的敌人数量会明显增多。
*   随着波数的增加（可以手动修改 `waveNumber` 来测试），新生成的怪物HP更高、体型更大，新生成的敌方士兵种类更高级。

---

#### **第五步：玩家单位升级系统**

为玩家提供成长反馈，增加长期可玩性。

1.  **确认升级逻辑**:
    *   `Fighter` 类已经有了 `level` 和 `exp` 属性，`_onkill` 方法也能获得基于 `victim.value` 的经验值。这个基础非常好，直接沿用。

2.  **实现升级检测与奖励**:
    *   在 `Fighter` 类的 `_onkill` 方法中，增加经验后，添加一个升级检查。
    *   定义升级所需经验公式，例如 `expToNextLevel = 1000 + (this.level * 500)`。
    *   如果 `this.exp >= expToNextLevel`，则执行升级：
        *   `this.level++`。
        *   `this.exp = 0` (或者减去升级所需经验 `this.exp -= expToNextLevel`)。
        *   **应用属性奖励**:
            *   `this.maxhp *= 1.05;` (增加5%最大生命值)
            *   `this.hp = this.maxhp;` (升级时回满血)
            *   `this.speed += 0.1;` (微量增加移速)
            *   `this.hp_regen += 2;` (增加生命恢复)
            *   `this.weapon.ReloadTime = Math.max(1000, this.weapon.ReloadTime * 0.95);` (减少5%换弹时间，最低不少于1秒) - *评估：可行，`ReloadTime` 是实例属性，修改它不会影响其他单位，耦合度低。*
            *   `this.weapon.recoil = Math.max(0.5, this.weapon.recoil * 0.95);` (减少5%后坐力，最低不少于0.5) - *评估：可行，`recoil` 也是实例属性，修改它耦合度低。*

3.  **添加视觉反馈**:
    *   在升级逻辑触发时，使用 `CanvasTextPrompt` 给玩家一个清晰的视觉提示。
    *   `world.CanvasPrompts.push(new CanvasTextPrompt({ text: 'LVL UP!', unit: this, color: 'gold', size: 15, lifetime: 2000 }));`
    *   同时播放一个升级音效: `soundManager.play('levelup', { position: { x: this.x, y: this.y } });`。

**测试点**:
*   控制一个 `Fighter` 单位击杀敌人，观察其 `exp` 属性是否增加。
*   当经验值达到阈值时，单位属性（最大HP、速度等）是否正确提升。
*   升级时是否出现“LVL UP!”的文字提示和音效。
*   检查武器的换弹速度和射击散布（后坐力），确认是否得到了改善。

---

#### **第六步：UI完善与其他重要细节**

最后一步是整合所有功能，并提供给玩家必要的界面信息，让整个模式体验完整。

1.  **战役信息UI**:
    *   在 `index.html` 的 `.info` div 中，添加新的元素用于显示战役信息，例如 `<div id="wave-info"></div>`。
    *   在 `wave.js` 的 `update` 函数中，定期更新这些UI元素的内容：
        *   显示当前波数: `Wave: ${this.waveNumber}`。
        *   显示下一波倒计时: `Next wave in: ${Math.ceil(this.timeToNextWave / 1000)}s`。
        *   如果当前波次正在进行，可以显示剩余敌人数量。

2.  **完善游戏流程**:
    *   为“重置游戏”按钮在战役模式下的行为进行适配，确保它能正确调用 `WaveManager.start()` 来重置所有战役状态。
    *   当基地被摧毁，显示“Game Over”信息时，可以一并显示玩家坚持到的最终波数，给予玩家成就感。

3.  **平衡性调整**:
    *   这是一个持续的过程。在完成所有功能后，需要反复游玩和调整以下参数，以获得最佳的游戏体验：
        *   初始金钱 (`game.money`)。
        *   单位购买价格 (`placing.placing_cost`)。
        *   波次间隔 (`baseInterval`)。
        *   敌人数量和强度的增长曲线（调整公式中的常数和因子）。
        *   单位升级所需的经验和升级奖励的幅度。

**测试点**:
*   游戏界面左上角能正确显示当前波数和下一波倒计时。
*   信息会随着游戏进程实时更新。
*   游戏失败后，能看到最终成绩（波数）。
*   整体游戏难度曲线是否平滑，不会过难或过易。