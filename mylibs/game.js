import { targetFPS, MapSize } from "./config.js";
import { fpsqueue as fps_queue, Weaponstat } from "./utils.js";
import { EntityBasic, BulletBasic } from "../objects/obj_basic.js";
import Guns_Data from "../data/weapons_data.js";
import { Quadtree } from "./quadtree.js";
import { performanceCounter } from "./performance_counter.js";

// 新增：视口管理类，处理缩放和坐标转换
class Viewport {
  constructor(canvas) {
    this.canvas = canvas;
    this.zoom = 1; // 缩放比例
    this.offsetX = 0; // X轴偏移
    this.offsetY = 0; // Y轴偏移

    // 限制缩放范围
    this.minZoom = 0.1;
    this.maxZoom = 5.0;
  }

  平移视口;
  pan(dx, dy) {
    this.offsetX += dx;
    this.offsetY += dy;
  }

  重置视口到地图中心;
  reset(mapWidth, mapHeight) {
    // console.log("Viewport reset called");
    // this.zoom = 1;
    // 计算偏移量，使地图中心对齐画布中心
    // 公式：CanvasCenter - MapCenter * Zoom
    // const rect = this.canvas.getBoundingClientRect();

    // 注意：这里使用 canvas.width (分辨率) 而不是 rect.width (显示大小)，因为 offsetX 是作用于 Context 的
    this.offsetX = (this.canvas.width - mapWidth * this.zoom) / 2;
    this.offsetY = (this.canvas.height - mapHeight * this.zoom) / 2;
  }

  // 核心功能：将屏幕坐标（鼠标点击）转换为游戏世界坐标
  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();

    // 1. 计算鼠标在 Canvas 元素内的相对位置
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    // 2. 计算 CSS 缩放比例 (显示大小 / 实际分辨率)
    // 这一步修复了“位置不一致”的 BUG
    const cssScaleX = this.canvas.width / rect.width;
    const cssScaleY = this.canvas.height / rect.height;

    // 3. 应用视口的平移和缩放
    // 公式：(输入坐标 * CSS缩放 - 平移) / 缩放倍率
    const worldX = (canvasX * cssScaleX - this.offsetX) / this.zoom;
    const worldY = (canvasY * cssScaleY - this.offsetY) / this.zoom;

    return { x: worldX, y: worldY };
  }

  // 处理滚轮缩放
  handleZoom(event) {
    event.preventDefault();

    const zoomIntensity = 0.1;
    const direction = event.deltaY < 0 ? 1 : -1;
    const factor = 1 + zoomIntensity * direction;

    // 计算缩放前的世界坐标（以鼠标为中心）
    const mouseWorld = this.screenToWorld(event.clientX, event.clientY);

    // 应用缩放
    let newZoom = this.zoom * factor;
    newZoom = Math.max(this.minZoom, Math.min(newZoom, this.maxZoom));

    // 计算新的偏移量，使鼠标指向的世界坐标保持不变
    // 数学推导：MouseWorld = (CanvasMouse - NewOffset) / NewZoom
    // => NewOffset = CanvasMouse - MouseWorld * NewZoom

    const rect = this.canvas.getBoundingClientRect();
    const cssScaleX = this.canvas.width / rect.width;
    const cssScaleY = this.canvas.height / rect.height;
    const canvasMouseX = (event.clientX - rect.left) * cssScaleX;
    const canvasMouseY = (event.clientY - rect.top) * cssScaleY;

    this.offsetX = canvasMouseX - mouseWorld.x * newZoom;
    this.offsetY = canvasMouseY - mouseWorld.y * newZoom;

    this.zoom = newZoom;
  }

  // 应用变换到 Context
  apply(ctx) {
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.zoom, this.zoom);
  }

  // 恢复 Context
  restore(ctx) {
    ctx.restore();
  }
}

class World {
  //地图相关
  /** @type {HTMLCanvasElement} */
  canvas = document.getElementById("gameCanvas");
  /** @type {CanvasRenderingContext2D} */
  ctx = this.canvas.getContext("2d");

  // 初始化视口
  viewport = new Viewport(this.canvas);

  // 如果 config 中配置了 MapSize，则使用配置值；否则回退到 Canvas 大小
  pos_range = {
    width: MapSize?.width || this.canvas.width,
    height: MapSize?.height || this.canvas.height,
  };

  pos_center = {
    x: this.pos_range.width / 2,
    y: this.pos_range.height / 2,
  };

  //   实体相关
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
    const units_start = performance.now();
    this.units.forEach((obj) => {
      obj.update();
      if (this.game.is_full_second()) {
        obj.update_slow();
      }
    });
    const units_end = performance.now();
    const bullets_start = performance.now();
    this.bullets.forEach((obj) => {
      obj.update();
      if (this.game.is_full_second()) {
        obj.update_slow();
      }
    });
    const bullets_end = performance.now();

    //再次遍历，对于每一个unit，使用 quadtree 获取筛选过的可能的碰撞obj候选列表

    const collisions_start = performance.now();
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
    const collisions_end = performance.now();

    // 记录性能数据（分开记录单位和子弹）
    const units_time = units_end - units_start;
    const bullets_time = bullets_end - bullets_start; // 简化：碰撞检测算入子弹

    performanceCounter.recordUnits(units_time, this.units.length);
    performanceCounter.recordBullets(bullets_time, this.bullets.length);
    performanceCounter.recordCollisions(collisions_end - collisions_start);

    //剔除死亡单位 / 子弹
    this.units = this.units.filter((x) => !x.dead);
    this.bullets = this.bullets.filter((x) => !x.dead);
  }

  render() {
    // 清空画布 (使用 setTransform 确保清空整个区域，不受当前缩放影响)
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 应用视口变换 (缩放/平移)
    this.viewport.apply(this.ctx);

    // 绘制地图边界
    this.ctx.strokeStyle = "#666"; // 深灰色边界
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(0, 0, this.pos_range.width, this.pos_range.height);

    // 渲染 units
    const render_units_start = performance.now();
    this.units.forEach((unit) => {
      unit.render(this.ctx);
    });
    const render_units_end = performance.now();

    // 渲染 bullets
    const render_bullets_start = performance.now();
    this.bullets.forEach((bullet) => {
      bullet.render(this.ctx);
    });
    const render_bullets_end = performance.now();

    // 渲染 Prompts
    const render_canvas_start = performance.now();
    this.CanvasPrompts.forEach((prompt) => {
      prompt.render(this.ctx);
    });
    const render_canvas_end = performance.now();
    performanceCounter.recordRendertime(
      render_units_end - render_units_start,
      render_bullets_end - render_bullets_start,
      render_canvas_end - render_canvas_start,
      this.CanvasPrompts.length
    );

    // 恢复 Context (虽然下一帧会重置，但保持好习惯)
    this.viewport.restore(this.ctx);

    //剔除过期 prompt
    this.CanvasPrompts = this.CanvasPrompts.filter((x) => !x.dead);
  }
}

// ... (Game 类保持不变) ...
class Game {
  //游戏设置
  targetFPS = targetFPS;
  frameTime = 1000 / targetFPS;
  constructor(/** @type {World} */ world) {
    this.world = world;
    this.currentMode = "MENU"; // 'MENU', 'SANDBOX', 'CAMPAIGN'
    this.isGameOver = false;
    this.update_callbacks = [];
  }

  paused = false;

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
  player_color = "grey";

  //GUI相关
  btn_StartGame = document.getElementById("button1");
  btn_pause = document.getElementById("btn-pause");
  btn_testUnits = document.getElementById("button2");
  btn_showdebug = document.getElementById("button3");
  btn_testMonsters = document.getElementById("button4");
  btn_benchmark = document.getElementById("button5");

  btn_units = document.getElementById("units").children;

  btn_dummy = document.getElementById("unitdummy");
  debug_units_player = document.getElementById("debug_units_player");
  debug_units_enemy = document.getElementById("debug_units_enemy");

  info_fps = document.getElementById("fps");
  info_perf = document.getElementById("perf");
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
    if (!this.paused) {
      this.#update_game();
      this.#update_units();
    }
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
      const text = `${Math.round(unit.x)},${Math.round(unit.y)} |threat: ${unit.threat.toFixed(
        1
      )} | value: ${unit.value.toFixed(1)} | damage_dealt ${unit.weapon.stat_damage_total.toFixed(
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
      }) | Zoom: ${this.world.viewport.zoom.toFixed(2)}x`;
      this.info_stat.innerHTML = `Money: ${this.money.toFixed(0)}$`;
    }

    // 性能计数器（仅沙盘模式，每1/4秒更新）
    if (this.currentMode === "SANDBOX" && this.is_quarter_second()) {
      this.info_perf.innerHTML = performanceCounter.getReport();
    } else if (this.currentMode !== "SANDBOX") {
      this.info_perf.innerHTML = ""; // 非沙盘模式清空
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
        this.update_callbacks.forEach((cb) => cb(deltaTime));
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
    this.isGameOver = false;

    performanceCounter.reset();

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
