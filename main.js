// import "./style.css"; //webpack打包时去掉注释

import { game, world } from "./mylibs/game.js";
import { waveManager } from "./mylibs/wave.js";
import { rtsControl } from "./mylibs/rts_control.js";

import "./objects/projectiles.js";
import "./mylibs/weapons.js";
import "./objects/units.js";
import "./mylibs/btn_event.js";
import "./mylibs/database.js";
import soundManager from "./mylibs/sound_manager.js";

// ---------------- 模块组装 ----------------
// 通过依赖注入，将 game 和 world 实例传入 waveManager，打破循环依赖
// 注册 waveManager.update 到 game 的回调列表
// 注意：需要 .bind(waveManager) 来确保 update 函数内部的 this 指向 waveManager 实例
waveManager.init(world, game);
game.update_callbacks.push(waveManager.update.bind(waveManager));

// 新增：初始化 RTS 控制，并挂载渲染回调
rtsControl.init(game, world);
world.render_callbacks.push(rtsControl.render.bind(rtsControl));

// 重置游戏，重启战役
const btnStartCampaign = document.getElementById("button1");
btnStartCampaign.addEventListener("click", () => {
  // game.start_game();
  waveManager.start(); // 在游戏开始时，手动启动波次管理器
});

// ---------------- 初始化 ----------------
soundManager.preload();
