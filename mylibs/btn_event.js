import { CanvasTextPrompt } from "./CanvasTextPrompt.js";
import { Fighter, Unit, Turret, Monster, Dummy } from "../objects/units.js";
import { GunFactory, MeleeWeapon } from "./weapons.js";
import { game, world } from "./game.js";
import { Battalion } from "../objects/battalion.js";

const ctx = world.ctx;
const canvas = world.canvas;
const pos_center = world.pos_center;
const pos_range = world.pos_range;

const btn_StartGame = game.btn_StartGame;
const btn_testMonsters = game.btn_testMonsters;
const btn_testUnits = game.btn_testUnits;
const btn_showdebug = game.btn_showdebug;
const btn_units = game.btn_units;
const info_debug = game.info_debug;

const placing = {
  is_placing: false,
  placing_weapon_name: null,
  placing_classes: [],
  placing_cost: 0,
  placing_color: undefined,
  placing_hp: 500,

  reset_units_btn() {
    this.is_placing = false;
    this.placing_weapon_name = null;
    this.placing_cost = 0;
    this.placing_classes = [];
    this.placing_color = undefined;
    this.placing_hp = undefined;

    for (let btn of btn_units) {
      btn.style.backgroundColor = "rgb(37, 194, 160)";
    }

    for (let btn of game.debug_units_player.children) {
      btn.style.backgroundColor = "white";
    }
    for (let btn of game.debug_units_enemy.children) {
      btn.style.backgroundColor = "pink";
    }
  },
};

//重启游戏按钮注册
btn_StartGame.addEventListener("click", () => {
  game.start_game();
  placing.reset_units_btn();
});

//DEBUG信息按钮
btn_showdebug.addEventListener("click", () => {
  //反转按钮
  info_debug.style.display = game.is_DebugMode() ? "none" : "block";
  //改变颜色
  btn_showdebug.style.backgroundColor = info_debug.style.display = game.is_DebugMode()
    ? "green"
    : "blue";

  console.table(game.weapon_stats.get_report());
});

function drop_unit(x, y) {
  //金钱检测
  if (placing.placing_cost > game.money) {
    world.CanvasPrompts.push(
      new CanvasTextPrompt({
        text: "金钱不足",
        x,
        y,
        size: 15,
        color: "red",
        lifetime: 500,
      })
    );
    return;
  } else {
    game.money -= placing.placing_cost;
    world.CanvasPrompts.push(
      new CanvasTextPrompt({
        text: `-${placing.placing_cost.toFixed(0)}$`,
        x,
        y,
        vy: -1,
        size: 15,
        color: "purple",
        lifetime: 1500,
      })
    );
  }
  //摆放单位
  for (let unit_class of placing.placing_classes) {
    const weapon = placing.placing_weapon_name
      ? GunFactory.get_gun(placing.placing_weapon_name)
      : GunFactory.random_gun();
    let h = new unit_class({
      x,
      y,
      weapon,
      maxhp: placing.placing_hp,
      color: placing.placing_color,
    });
    h.setMoveTarget(x, y);
    world.units.push(h);
  }
}

// --- 注册滚轮缩放事件 ---
canvas.addEventListener(
  "wheel",
  (event) => {
    world.viewport.handleZoom(event);
  },
  { passive: false }
); // passive: false 允许我们使用 preventDefault()

canvas.addEventListener("contextmenu", function (event) {
  event.preventDefault();
  // 右键取消放置模式
  if (placing.is_placing) {
    placing.reset_units_btn();
  }

  // 使用 viewport 转换坐标
  const { x, y } = world.viewport.screenToWorld(event.clientX, event.clientY);

  ctx.beginPath();
  ctx.arc(x, y, 10, 0, 2 * Math.PI);
  ctx.fillStyle = "red";
  ctx.fill();
});

// 正常游戏单位
function register_playerunit() {
  //玩家单个单位 button event
  btn_units[0].addEventListener("click", (e) => {
    placing.reset_units_btn();
    placing.is_placing = true;
    e.target.style.backgroundColor = "red";
    placing.placing_classes = [Fighter];
    placing.placing_cost = 1000;
  });

  //玩家战斗小队 button event
  btn_units[1].addEventListener("click", (e) => {
    placing.reset_units_btn();
    placing.is_placing = true;
    e.target.style.backgroundColor = "red";
    placing.placing_classes = Array.from({ length: 5 }, () => Fighter);
    placing.placing_cost = 5000;
  });

  //玩家机枪炮塔 button event
  btn_units[2].addEventListener("click", (e) => {
    placing.reset_units_btn();
    placing.is_placing = true;
    e.target.style.backgroundColor = "red";
    placing.placing_classes = [Turret];
    placing.placing_cost = 8000;
  });

  //canvas左键放置
  canvas.addEventListener("click", (event) => {
    if (placing.is_placing) {
      // 使用 viewport 转换坐标，替代之前的 rect 计算
      const { x, y } = world.viewport.screenToWorld(event.clientX, event.clientY);
      drop_unit(x, y);
    }
  });
}

// 测试单位用于测试武器
function register_debugunit() {
  const container_player = game.debug_units_player;
  const guns = game.Guns_Names;

  // 使用 map 方法生成按钮并添加到容器中
  guns.map((text) => {
    // 创建按钮元素
    const button = document.createElement("button");
    button.textContent = text; // 设置按钮文本
    button.title = game.Guns_Data[text].desc;

    //添加click事件
    button.addEventListener("click", (e) => {
      placing.reset_units_btn();
      placing.is_placing = true;
      e.target.style.backgroundColor = "red";
      placing.placing_classes = [Fighter];
      placing.placing_weapon_name = text;
      placing.placing_hp = 500; //武器是围绕着500HP设计的
    });
    // 将生成的按钮添加到容器中
    container_player.appendChild(button);
  });

  const container_enemy = game.debug_units_enemy;

  // 使用 map 方法生成按钮并添加到容器中
  guns.map((text) => {
    // 创建按钮元素
    const button = document.createElement("button");
    button.textContent = text; // 设置按钮文本
    button.title = game.Guns_Data[text].desc;

    //添加click事件
    button.addEventListener("click", (e) => {
      placing.reset_units_btn();
      placing.is_placing = true;
      e.target.style.backgroundColor = "red";
      placing.placing_classes = [Fighter];
      placing.placing_weapon_name = text;
      placing.placing_color = "red";
      placing.placing_hp = 500; //武器是围绕着500HP设计的
    });
    // 将生成的按钮添加到容器中
    container_enemy.appendChild(button);
  });

  //敌军DUMMY单位 button event，测伤害用的
  game.btn_dummy.addEventListener("click", (e) => {
    placing.reset_units_btn();
    placing.is_placing = true;
    e.target.style.backgroundColor = "red";
    placing.placing_classes = [Dummy];
    placing.placing_cost = 0;
  });
}

// 随机摆放单位，用于测试战斗
function register_combattest() {
  // 摆放多个随机步兵单位
  btn_testUnits.addEventListener("click", () => {
    let num = 10;
    let width = world.pos_range.width;
    let height = world.pos_range.height;

    //我军
    for (let i = 0; i < num; i++) {
      let { x, y } = world.randomPoint({
        width,
        height,
        position: "left",
      });

      world.units.push(Battalion.spawn_infantry(x, y, game.player_color));
    }

    //敌军主力
    for (let i = 0; i < num; i++) {
      let { x, y } = world.randomPoint({
        width,
        height,
        position: "right",
        narrow: true,
      });
      world.units.push(Battalion.spawn_infantry(x, y));
    }

    //敌军特殊小队
    for (let i = 0; i < num / 2; i++) {
      let { x, y } = world.randomPoint({
        width,
        height,
        position: "right",
      });
      let h = new Unit({
        x,
        y,
        color: "blue",
        weapon: GunFactory.random_gun(1),
      });
      world.units.push(h);
    }
    //乱军
    for (let i = 0; i < num; i++) {
      let { x, y } = world.randomPoint({
        width,
        height,
        position: "bottom",
      });
      world.units.push(Battalion.spawn_infantry(x, y, "green"));
    }

    // BOSS级人物;
    world.units.push(
      new Unit({
        x: pos_center.x,
        y: pos_center.y,
        color: "grey",
        maxhp: 5000,
        size: 12,
        speed: 1.5,
        weapon: GunFactory.random_gun(1),
      })
    );
  });

  // 摆放多个怪物单位
  btn_testMonsters.addEventListener("click", () => {
    let num = 10;
    let width = world.pos_range.width;
    let height = world.pos_range.height;

    //地图右侧疯狗
    for (let i = 0; i < num * 1.5; i++) {
      let { x, y } = world.randomPoint({
        width,
        height,
        position: "right",
        narrow: true,
      });
      world.units.push(Monster.spawn_fast(x, y));
    }
    //地图上侧普通单位
    for (let i = 0; i < num; i++) {
      let { x, y } = world.randomPoint({
        width,
        height,
        position: "right",
        narrow: true,
      });
      world.units.push(Monster.spawn_normal(x, y));
    }

    //地图下册肉盾
    for (let i = 0; i < num; i++) {
      let { x, y } = world.randomPoint({
        width,
        height,
        position: "right",
        narrow: true,
      });
      world.units.push(Monster.spawn_big(x, y));
    }
  });
}

// 随机摆放大量单位，用于测试性能，结合 performance 使用
function register_benchmark() {
  // 摆放多个随机步兵单位
  game.btn_benchmark.addEventListener("click", () => {
    let num = 100;
    let width = world.pos_range.width;
    let height = world.pos_range.height;

    //我军
    for (let i = 0; i < num; i++) {
      let { x, y } = world.randomPoint({
        width,
        height,
        position: "left",
      });
      let h = new Unit({
        x,
        y,
        color: game.player_color,
        weapon: GunFactory.random_gun(),
      });
      world.units.push(h);
    }

    num = 200;
    width = world.pos_range.width;
    height = world.pos_range.height;

    for (let i = 0; i < num * 1.5; i++) {
      let { x, y } = world.randomPoint({
        width,
        height,
        position: "right",
        narrow: true,
      });
      world.units.push(Monster.spawn_fast(x, y));
    }

    for (let i = 0; i < num; i++) {
      let { x, y } = world.randomPoint({
        width,
        height,
        position: "right",
        narrow: true,
      });
      world.units.push(Monster.spawn_normal(x, y));
    }

    for (let i = 0; i < num; i++) {
      let { x, y } = world.randomPoint({
        width,
        height,
        position: "right",
        narrow: true,
      });
      world.units.push(Monster.spawn_big(x, y));
    }
  });
}

register_playerunit();
register_combattest();
register_debugunit();
register_benchmark();
