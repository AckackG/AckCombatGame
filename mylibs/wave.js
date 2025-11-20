
import { world, game } from "./game.js";
import { Monster } from "../objects/units.js";
import { Battalion } from "../objects/battalion.js";
import { CanvasTextPrompt } from './CanvasTextPrompt.js';
import { Base } from "../objects/units.js";

class WaveManager {
    constructor() {
        this.waveNumber = 0;
        this.waveInProgress = false;
        this.timeToNextWave = 0;
        this.baseInterval = 30000; // 两波之间的基础间隔时间 (ms)
        this.spawnType = 'monster'; // 'monster' 或 'soldier'
    }

    start() {
        this.waveNumber = 0;
        this.waveInProgress = false;
        this.timeToNextWave = 10000; // 游戏开始后第一波的准备时间
        this.spawnType = 'monster';

        // 生成基地
        const baseX = world.pos_range.width / 5;
        const baseY = world.pos_range.height / 3;
        const playerBase = new Base({
            x: baseX,
            y: baseY,
            color: game.player_color,
            size: 40,
            hp: 20000,
        });
        world.units.push(playerBase);
        this.playerBase = playerBase;
    }

    update(dt) {
        if (this.playerBase && this.playerBase.dead) {
            if (!game.isGameOver) {
                game.isGameOver = true;
                game.paused = true;
                world.CanvasPrompts.push(new CanvasTextPrompt({
                    text: 'GAME OVER',
                    x: world.width / 2,
                    y: world.height / 2,
                    color: 'red',
                    size: 50,
                    lifetime: Infinity
                }));
            }
            return;
        }

        if (game.paused || game.isGameOver) return;

        if (!this.waveInProgress) {
            this.timeToNextWave -= dt;

            // 检查场上是否还有敌人
            const enemies = world.units.filter(u => u.color !== game.player_color && u.is_monster);
            if (enemies.length === 0 && this.waveNumber > 0) { // 第一波之前不加速
                if (this.timeToNextWave > 10000) {
                    this.timeToNextWave = 10000; // 快速开启下一波
                }
            }

            if (this.timeToNextWave <= 0) {
                this.spawnWave();
            }
        } else {
            // 检查波次是否结束
            const enemies = world.units.filter(u => u.color !== game.player_color && u.is_monster);
            if (enemies.length === 0) {
                this.waveInProgress = false;
                this.timeToNextWave = this.baseInterval;
            }
        }
    }

    spawnWave() {
        this.waveNumber++;
        this.waveInProgress = true;
        console.log(`Spawning Wave ${this.waveNumber}`);

        const spawn_pos = {
            x: world.width,
            y: Math.random() * world.height,
            dx: -1,
            dy: (Math.random() - 0.5) * 0.5,
        }

        if (this.spawnType === 'monster') {
            Monster.spawn_fast(5, spawn_pos);
            this.spawnType = 'soldier'; // 切换到下一种
        } else {
            Battalion.spawn_infantry(5, spawn_pos);
            this.spawnType = 'monster'; // 切换到下一种
        }
    }
}

export const waveManager = new WaveManager();
