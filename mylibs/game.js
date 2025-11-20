import { targetFPS } from "./config.js";
import { fpsqueue as fps_queue, Weaponstat } from "./utils.js";
import { EntityBasic, BulletBasic } from "../objects/obj_basic.js";
import Guns_Data from "../data/weapons_data.js";
import { Quadtree } from "./quadtree.js";

class World {
  //地图相关
  /** @type {HTMLCanvasElement} */
  canvas = document.getElementById("gameCanvas");
  /** @type {CanvasRenderingContext2D} */
  ctx = this.canvas.getContext("2d");

  pos_range = {
    width: this.canvas.width,
    height: this.canvas.height,
  };

  pos_center = {
    x: this.pos_range.width / 2,
    y: this.pos_range.height / 2,
  };

  //   实体相关
  #objs = []; //暂时用不到，取值是临时的数组
  #units = new UnitsArray();
  #bullets = new BulletsArray();
  CanvasPrompts = [];
  // 主单位不需要进入 tree，意味着用临时单位retrive，与其他在QT内单位的碰撞、武器范围是可行的
  UnitsQT = new Quadtree({
    x: 0,
    y: 0,
    width: this.pos_range.width,
    height: this.pos_range.height,
  });

  BulletsQT = new Quadtree({
    x: 0,
    y: 0,
    width: this.pos_range.width,
    height: this.pos_range.height,
  });

  /**
   * 获取所有对象的集合。
   *
   * 合并并返回`units`和`bullets`两个属性的值。
   *
   * @returns {Array} 返回一个数组，包含`units`和`bullets`数组中的所有元素。
   */
  get objs() {
    return [...this.units, ...this.bullets];
  }

  get units() {
    return this.#units;
  }

  set units(value) {
    if (value instanceof UnitsArray) {
      this.#units = value;
    } else {
      throw new Error("units list must be class UnitsArray");
    }
  }

  get bullets() {
    return this.#bullets;
  }

  set bullets(value) {
    if (value instanceof BulletsArray) {
      this.#bullets = value;
    } else {
      throw new Error("bullets list must be class BulletsArray");
    }
  }

  /**
   * 生成一个在指定区域内的随机点。
   *
   * @param {number} config.width - 区域的宽度，默认为1920像素
   * @param {number} config.height - 区域的高度，默认为1080像素
   * @param {string} config.position - 点的位置限定，默认为"left"。可选值有："left"、"right"、"top"、"bottom"
   * @param {bool} config.narrow - 拥挤模式，范围限制在1/4 而不是 1/3
   * @returns {Object} - 返回一个包含x和y坐标的对象
   * @throws {Error} - 如果传入的position值无效，将抛出错误
   */
  randomPoint({
    width = this.pos_range.width,
    height = this.pos_range.height,
    position = "left",
    narrow = false,
  } = {}) {
    let x_range = narrow ? width / 4 : width / 3;
    let y_range = narrow ? height / 4 : height / 3;
    switch (position) {
      case "left":
        return { x: Math.random() * x_range, y: Math.random() * height };
      case "right":
        return {
          x: width - Math.random() * x_range,
          y: Math.random() * height,
        };
      case "top":
        return { x: Math.random() * width, y: Math.random() * y_range };
      case "bottom":
        return {
          x: Math.random() * width,
          y: height - Math.random() * y_range,
        };
      default:
        throw new Error("Invalid position value");
    }
  }

  update() {
    this.UnitsQT.clear();
    this.BulletsQT.clear();

    // 添加到 quadtree
    this.#units.forEach((unit) => {
      this.UnitsQT.insert(unit);
    });

    this.#bullets.forEach((bullet) => {
      this.BulletsQT.insert(bullet);
    });

    // 更新快慢逻辑
    this.objs.forEach((obj) => {
      obj.update();
      if (this.game.is_full_second()) {
        obj.update_slow();
      }
    });

    //再次遍历，对于每一个unit，使用 quadtree 获取筛选过的可能的碰撞obj候选列表
    this.units.forEach((unit) => {
      // 单位 X 单位
      const unit_candidates = this.UnitsQT.retrieve(unit);
      unit_candidates.forEach((unit_candidate) => {
        if (unit === unit_candidate) return; //排除掉单位自己
        unit.unit_collision(unit_candidate);
      });

      // 单位 X 子弹
      const bullet_candidates = this.BulletsQT.retrieve(unit);
      bullet_candidates.forEach((bullet_candidate) => {
        if (unit.color !== bullet_candidate.color) {
          unit.bullet_collision(bullet_candidate);
        }
      });
    });

    //剔除死亡单位 / 子弹
    this.units = this.units.filter((x) => !x.dead);
    this.bullets = this.bullets.filter((x) => !x.dead);
  }

  render() {
    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 渲染objs
    this.objs.forEach((unit) => {
      unit.render(this.ctx);
    });

    // 渲染游戏信息
    this.CanvasPrompts.forEach((prompt) => {
      prompt.render(this.ctx);
    });

    //剔除过期 prompt
    this.CanvasPrompts = this.CanvasPrompts.filter((x) => !x.dead);
  }
}

class Game {
  //游戏设置
  targetFPS = targetFPS;
  frameTime = 1000 / targetFPS;
  constructor(/** @type {World} */ world) {
    this.world = world;
  }

  //游戏tick相关
  #GameLoopID = null;
  time_now = 0; //全游戏的时间判断都依赖这个变量
  #startTime = performance.now();
  #lastTime = this.#startTime;

  //慢计时器相关
  #slow_counter = 1; //每一帧+1,循环
  #half_fps = parseInt(targetFPS / 2);
  #quarter_fps = parseInt(targetFPS / 4);
  #incrementCounter() {
    if (this.#slow_counter > targetFPS) {
      this.#slow_counter = 1;
    } else {
      this.#slow_counter++;
    }
  }
  /**
   *
   * @returns {boolean} 每秒中只有 1 次返回true，大多数都是false
   */
  is_full_second() {
    return this.#slow_counter === targetFPS;
  }

  /**
   *
   * @returns {boolean} 每秒中只有 2 次返回true，大多数都是false
   */
  is_half_second() {
    return this.#slow_counter % this.#half_fps === 0;
  }

  /**
   *
   * @returns {boolean} 每秒中只有 4 次返回true，大多数都是false
   */
  is_quarter_second() {
    return this.#slow_counter % this.#quarter_fps === 0;
  }

  //玩家相关
  money = 0;
  player_color = "black";

  //GUI相关
  btn_StartGame = document.getElementById("button1");
  btn_testUnits = document.getElementById("button2");
  btn_showdebug = document.getElementById("button3");
  btn_testMonsters = document.getElementById("button4");
  btn_benchmark = document.getElementById("button5");

  btn_units = document.getElementById("units").children;

  btn_dummy = document.getElementById("unitdummy");
  debug_units_player = document.getElementById("debug_units_player");
  debug_units_enemy = document.getElementById("debug_units_enemy");

  info_fps = document.getElementById("fps");
  info_stat = document.getElementById("stat");
  info_debug = document.getElementById("debufinfo");

  is_DebugMode() {
    return this.info_debug.style.display === "none" ? false : true;
  }

  //武器数据相关
  weapon_stats = Weaponstat;

  Guns_SpecialNames = Object.values(Guns_Data)
    .filter((gun) => gun.special)
    .map((gun) => gun.wname);
  Guns_NormalNames = Object.values(Guns_Data)
    .filter((gun) => !gun.special)
    .map((gun) => gun.wname);
  Guns_Data = Guns_Data;
  Guns_Names = [...this.Guns_NormalNames, ...this.Guns_SpecialNames];

  #update_game() {
    this.#incrementCounter();
  }

  #update_units() {
    this.world.update();
  }
  #update() {
    this.#update_game();
    this.#update_units();
  }

  #render_GUI_DebugInfo() {
    if (!this.is_DebugMode() || !this.is_quarter_second()) return;
    //快速信息，每帧更新
    const bullets_count = this.world.bullets.length;

    const container = this.info_debug;
    container.innerHTML = ""; // 清空子元素

    //添加bullet信息
    const bullet_div = document.createElement("div");
    bullet_div.textContent = `BulletBasic counts:${bullets_count}`;
    container.appendChild(bullet_div);

    // 添加unit div到容器中
    this.world.units.map((unit) => {
      // 创建div元素
      const unit_div = document.createElement("div");
      const text = `${Math.round(unit.x)},${Math.round(
        unit.y
      )} |threat: ${unit.threat.toFixed(1)} | value: ${unit.value.toFixed(
        1
      )} | damage_dealt ${unit.weapon.stat_damage_total.toFixed(
        1
      )} |Target dead?: ${unit.target ? unit.target.dead : null} | Dead?: ${
        unit ? unit.dead : null
      }`;

      unit_div.textContent = text; // 设置按钮文本
      unit_div.style.color = unit.color;

      container.appendChild(unit_div);
    });
  }

  #render_GUI() {
    //慢速信息
    if (this.is_half_second()) {
      this.info_fps.innerHTML = `FPS: ${fps_queue.getAverageFps()} (${
        this.targetFPS
      })`;
      this.info_stat.innerHTML = `Money: ${this.money.toFixed(0)}$`;
    }

    this.#render_GUI_DebugInfo();
  }

  #render_canvas() {
    this.world.render();
  }

  #render() {
    this.#render_GUI();
    this.#render_canvas();
  }

  _gameloop = () => {
    this.time_now = performance.now();
    // 计算自上次调用以来的时间差
    let deltaTime = this.time_now - this.#lastTime;

    // 如果时间差大于等于目标帧时间，则更新游戏逻辑
    if (deltaTime > this.frameTime) {
      this.#lastTime = this.time_now - (deltaTime % this.frameTime);
      fps_queue.push(this.time_now);
      try {
        this.#update();
        this.#render();
      } catch (error) {
        console.error("Error in game loop:", error);
      }
    }
    this.#GameLoopID = requestAnimationFrame(this._gameloop); //箭头函数避免丢失this
  };

  start_game() {
    this.world.bullets = new BulletsArray();
    this.world.units = new UnitsArray();
    this.money = 6000;
    if (this.#GameLoopID) {
      cancelAnimationFrame(this.#GameLoopID);
    }
    this.#GameLoopID = requestAnimationFrame(this._gameloop);
  }
}

class UnitsArray extends Array {
  type = EntityBasic;

  push(...items) {
    for (const item of items) {
      if (!(item instanceof this.type)) {
        throw new TypeError(`All items must be of type ${this.type}`);
      }
    }
    return super.push(...items);
  }
}

class BulletsArray extends Array {
  type = BulletBasic;

  push(...items) {
    for (const item of items) {
      if (!(item instanceof this.type)) {
        throw new TypeError(`All items must be of type ${this.type}`);
      }
    }
    return super.push(...items);
  }
}

export const world = new World();
export const game = new Game(world);
world.game = game;
