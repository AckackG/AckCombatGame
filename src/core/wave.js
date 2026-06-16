import { Monster, Unit, Base, Fighter, Turret, RangedMonster, ExplosiveMonster, SpawnerMonster } from "../entities/units.js";
import { Battalion } from "../entities/battalion.js";
import { CanvasTextPrompt } from "./CanvasTextPrompt.js";
import { GunFactory } from "./weapons.js";

class WaveManager {
  constructor() {
    this.waveNumber = 0;
    this.timeToNextWave = 0;
    this.waveInterval = 60000; // 两波之间的间隔时间 (ms)
    this.spawnType = "monster"; // 'monster' 或 'soldier'
    this.hasEnemies = false; // 缓存敌军状态
    this.maxSpawnsPerWave = 350;

    this.world = null;
    this.game = null;
  }

  init(world, game) {
    this.world = world;
    this.game = game;
  }

  start() {
    if (this.game.currentMode !== "CAMPAIGN") return;
    this.waveNumber = 0;
    this.timeToNextWave = 10000; // 游戏开始后第一波的准备时间
    this.spawnType = "monster";
    this.hasEnemies = false;

    // 生成基地
    const baseX = this.world.pos_range.width / 5;
    const baseY = this.world.pos_range.height / 3;
    const playerBase = new Base({
      x: baseX,
      y: baseY,
      color: this.game.player_color,
      size: 40,
      hp: 20000,
    });
    this.world.units.push(playerBase);
    this.playerBase = playerBase;
  }

  update(dt) {
    //
    if (this.game.currentMode !== "CAMPAIGN") return;

    // 检查基地是否被摧毁
    if (this.playerBase && this.playerBase.dead) {
      if (!this.game.isGameOver) {
        this.game.isGameOver = true;
        this.game.paused = true;
        this.world.CanvasPrompts.push(
          new CanvasTextPrompt({
            text: "GAME OVER",
            x: this.world.pos_range.width / 2,
            y: this.world.pos_range.height / 2,
            color: "red",
            size: 50,
            lifetime: Infinity,
          })
        );
      }
      return;
    }

    if (this.game.paused || this.game.isGameOver) return;

    // 倒计时
    this.timeToNextWave -= dt;

    // 每秒检查一次敌军状态
    if (this.game.is_full_second()) {
      this.hasEnemies = this.world.units.some((u) => u.color !== this.game.player_color);

      // --- 清场后自动换弹逻辑 ---
      if (!this.hasEnemies) {
        this.world.units.forEach((u) => {
          // 只对我军单位生效，且单位必须持有武器
          if (u.color === this.game.player_color && u.weapon) {
            u.weapon.manual_reload(u.x, u.y);
          }
        });
      }
      // 如果没有敌军且不是第一波前，加速下一波
      if (!this.hasEnemies && this.waveNumber > 0) {
        if (this.timeToNextWave > 5000) {
          this.timeToNextWave = 5000;
          console.log("No enemies left! Next wave in 5s.");
        }
      }
    }

    // 时间到了就刷怪
    if (this.timeToNextWave <= 0) {
      this.spawnWave();
      this.timeToNextWave = this.waveInterval;
    }

    // 每0.25秒更新UI
    if (this.game.is_quarter_second) {
      this.renderUI();
    }
  }

  renderUI() {
    const ui = document.getElementById("wave-info");
    if (ui) {
      ui.textContent = `WAVE: ${this.waveNumber} | NEXT: ${(this.timeToNextWave / 1000).toFixed(
        1
      )}s | ENEMIES: ${this.hasEnemies ? "ACTIVE" : "CLEARED"}`;
    }
  }

  _calculatePlayerStrength() {
    return this.world.units
      .filter((u) => u.color === this.game.player_color)
      .reduce((sum, u) => sum + (u.value ?? 0), 0);
  }

  // 获取三种类型怪物的权重池
  #get_pools() {
    // 随波次增加变种生成的权重
    const wave_bonus = this.waveNumber * 2;
    
    // 限制变异怪物的最大权重不超过初始权重的 2 倍
    const explosiveWeight = Math.min(15 + wave_bonus, 30); // 初始15，最大30
    const rangedWeight = Math.min(30 + wave_bonus, 60);    // 初始30，最大60
    
    // 母体怪第三波才开始出现，初始15
    const spawnerBase = this.waveNumber >= 3 ? 15 : 0;
    const spawnerWeight = spawnerBase > 0 ? Math.min(15 + (this.waveNumber - 3) * 2, 30) : 0;

    console.log(`[Wave ${this.waveNumber}] 怪物权重分配: Fast(自爆:${explosiveWeight}), Normal(远程:${rangedWeight}), Big(母体:${spawnerWeight})`);

    return {
      fast: [
        { type: Monster, weight: 80 },
        { type: ExplosiveMonster, weight: explosiveWeight }
      ],
      normal: [
        { type: Monster, weight: 70 },
        { type: RangedMonster, weight: rangedWeight }
      ],
      big: [
        { type: Monster, weight: 85 },
        { type: SpawnerMonster, weight: spawnerWeight }
      ]
    };
  }

  // 根据权重池抽取怪物类型
  #pick_from_pool(pool) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    for (let item of pool) {
      if (r < item.weight) return item.type;
      r -= item.weight;
    }
    return pool[pool.length - 1].type;
  }

  #spawn_monsters(count) {
    const intensity = 1 + this.waveNumber * 0.1;
    let num = count / 1.75 + 1;
    let width = this.world.pos_range.width;
    let height = this.world.pos_range.height;
    
    const pools = this.#get_pools();

    // 地图右侧疯狗 (Fast)
    for (let i = 0; i < num * 1.5; i++) {
      let { x, y } = this.world.randomPoint({ width, height, position: "right", narrow: true });
      const EnemyType = this.#pick_from_pool(pools.fast);
      this.world.units.push(EnemyType.spawn_fast(x, y, intensity));
    }

    // 地图右侧普通单位 (Normal)
    for (let i = 0; i < num; i++) {
      let { x, y } = this.world.randomPoint({ width, height, position: "right", narrow: true });
      const EnemyType = this.#pick_from_pool(pools.normal);
      this.world.units.push(EnemyType.spawn_normal(x, y, intensity));
    }

    // 地图右侧肉盾 (Big)
    for (let i = 0; i < num * 0.75; i++) {
      let { x, y } = this.world.randomPoint({ width, height, position: "right", narrow: true });
      const EnemyType = this.#pick_from_pool(pools.big);
      this.world.units.push(EnemyType.spawn_big(x, y, intensity));
    }
  }

  #spawn_enemy_soldiers(count) {
    let num = count / 3 + 1;
    let width = this.world.pos_range.width;
    let height = this.world.pos_range.height;

    // 敌军主力
    for (let i = 0; i < num; i++) {
      let { x, y } = this.world.randomPoint({
        width,
        height,
        position: "right",
        narrow: true,
      });

      if (this.waveNumber >= 12) {
        const soldier_type = Math.random();
        if (soldier_type < 0.4) {
          this.world.units.push(Battalion.spawn_infantry(x, y));
        } else if (soldier_type < 0.8) {
          this.world.units.push(Battalion.spawn_veteran(x, y));
        } else {
          this.world.units.push(Battalion.spawn_specOps(x, y));
        }
      } else if (this.waveNumber >= 6) {
        if (Math.random() < 0.5) {
          this.world.units.push(Battalion.spawn_infantry(x, y));
        } else {
          this.world.units.push(Battalion.spawn_veteran(x, y));
        }
      } else {
        this.world.units.push(Battalion.spawn_infantry(x, y));
      }
    }

    // 敌军特殊小队
    const weapon_quality = 0.75 + this.waveNumber * 0.02;
    for (let i = 0; i < num / 4; i++) {
      let { x, y } = this.world.randomPoint({
        width,
        height,
        position: "right",
      });
      let h = new Unit({
        x,
        y,
        color: "blue",
        weapon: GunFactory.random_gun(weapon_quality),
      });
      this.world.units.push(h);
    }
  }

  spawnWave() {
    this.waveNumber++;
    this.saveGame();

    const playerStrength = this._calculatePlayerStrength();
    let baseCount = 5 + this.waveNumber * 2;
    let dynamicCount = Math.floor(playerStrength * 0.001);
    const spawn_count = Math.min(baseCount + dynamicCount, this.maxSpawnsPerWave);

    console.log(`Spawning Wave ${this.waveNumber} | ${spawn_count} ${this.spawnType}s`);

    if (this.spawnType === "monster") {
      this.#spawn_monsters(spawn_count);
      this.spawnType = "soldier";
    } else {
      this.#spawn_enemy_soldiers(spawn_count);
      this.spawnType = "monster";
    }
  }

  saveGame() {
    if (this.game.currentMode !== "CAMPAIGN") return;
    const saveData = {
      waveNumber: this.waveNumber,
      money: this.game.money,
      weapon_stats: Array.from(this.game.weapon_stats.weapons.entries()),
      playerUnits: this.world.units
        .filter(u => u.color === this.game.player_color && !u.dead)
        .map(u => ({
          className: u.constructor.name,
          x: u.x,
          y: u.y,
          hp: u.hp,
          maxhp: u.maxhp,
          weapon_name: u.weapon ? u.weapon.wname : null,
        }))
    };
    localStorage.setItem("campaign_save", JSON.stringify(saveData));
  }

  loadGame() {
    const saveStr = localStorage.getItem("campaign_save");
    if (!saveStr) return false;
    try {
      const saveData = JSON.parse(saveStr);
      if (!saveData.waveNumber) return false;

      this.game.currentMode = "CAMPAIGN";
      this.waveNumber = saveData.waveNumber;
      this.game.money = saveData.money;
      this.timeToNextWave = 10000;
      this.spawnType = "monster";
      this.hasEnemies = false;

      if (saveData.weapon_stats) {
        this.game.weapon_stats.weapons = new Map(saveData.weapon_stats);
      }

      this.world.units.length = 0;
      this.world.bullets.length = 0;

      let hasBase = false;
      saveData.playerUnits.forEach(uData => {
        const weapon = uData.weapon_name ? GunFactory.get_gun(uData.weapon_name) : null;
        let unitObj;
        const params = {
          x: uData.x,
          y: uData.y,
          color: this.game.player_color,
          maxhp: uData.maxhp,
          weapon: weapon
        };
        
        if (uData.className === "Base") {
          unitObj = new Base({...params, size: 40});
          this.playerBase = unitObj;
          hasBase = true;
        } else if (uData.className === "Fighter") {
          unitObj = new Fighter(params);
        } else if (uData.className === "Turret") {
          unitObj = new Turret(params);
        } else {
          unitObj = new Unit(params);
        }
        
        if (uData.hp !== undefined) unitObj.hp = uData.hp;
        this.world.units.push(unitObj);
      });

      if (!hasBase) {
        // Fallback base
        this.playerBase = new Base({
          x: this.world.pos_range.width / 5,
          y: this.world.pos_range.height / 3,
          color: this.game.player_color,
          size: 40,
          hp: 20000,
        });
        this.world.units.push(this.playerBase);
      }

      return true;
    } catch (e) {
      console.error("Save load failed", e);
      return false;
    }
  }

  clearSave() {
    localStorage.removeItem("campaign_save");
  }
}

export const waveManager = new WaveManager();
