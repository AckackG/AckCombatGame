import { Monster, Unit, Base } from "../objects/units.js";
import { Battalion } from "../objects/battalion.js";
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

  #spawn_monsters(count) {
    const intensity = 1 + this.waveNumber * 0.1;
    let num = count / 1.75 + 1;
    let width = this.world.pos_range.width;
    let height = this.world.pos_range.height;

    // 地图右侧疯狗
    for (let i = 0; i < num * 1.5; i++) {
      let { x, y } = this.world.randomPoint({
        width,
        height,
        position: "right",
        narrow: true,
      });
      this.world.units.push(Monster.spawn_fast(x, y, intensity));
    }

    // 地图右侧普通单位
    for (let i = 0; i < num; i++) {
      let { x, y } = this.world.randomPoint({
        width,
        height,
        position: "right",
        narrow: true,
      });
      this.world.units.push(Monster.spawn_normal(x, y, intensity));
    }

    // 地图右侧肉盾
    for (let i = 0; i < num * 0.75; i++) {
      let { x, y } = this.world.randomPoint({
        width,
        height,
        position: "right",
        narrow: true,
      });
      this.world.units.push(Monster.spawn_big(x, y, intensity));
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
}

export const waveManager = new WaveManager();
