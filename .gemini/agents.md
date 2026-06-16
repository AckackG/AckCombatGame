# Project: Ballistics — AI Agent 指令

本文档简要介绍项目架构，供 AI Agent 快速理解代码库。实际以具体代码为准。

## 项目概述

一款基于 HTML5 Canvas 的 2D 战术射击/塔防游戏。纯前端，无构建工具，使用 ES Modules。
部署目标为 GitHub Pages 子页面。

## 目录结构

```
├── index.html          入口 HTML
├── style.css           全局样式
├── src/                源代码
│   ├── main.js         JS 入口，模块组装与初始化
│   ├── core/           引擎核心
│   │   ├── game.js     Game（游戏循环）、World（世界状态）、Viewport（视口变换）
│   │   ├── config.js   全局常量
│   │   ├── utils.js    数学工具函数、FPS 队列、WeaponStat
│   │   ├── quadtree.js 四叉树空间索引
│   │   ├── logic.js    deal_damage / target_killed
│   │   ├── weapons.js  GunBasic / InstaWeapon / GunFactory
│   │   ├── effects.js  Effect / DOT
│   │   ├── wave.js     WaveManager（战役波次）
│   │   ├── btn_event.js 输入事件绑定
│   │   ├── database.js  武器数据展示 UI
│   │   ├── sound_manager.js 音效管理（对象池）
│   │   ├── rts_control.js   RTS 框选控制
│   │   ├── performance_counter.js 性能计数器
│   │   ├── CanvasTextPrompt.js    飘字/粒子/爆炸渲染
│   │   └── SpriteCache.js  精灵缓存
│   ├── entities/       游戏实体
│   │   ├── obj_basic.js    MoveableObject / EntityBasic / BulletBasic
│   │   ├── units.js        Unit / Fighter / Turret / Monster / Dummy
│   │   ├── projectiles.js  Bullet / BulletFactory
│   │   └── battalion.js    Battalion（单位预设工厂）
│   └── data/           数据配置
│       └── weapons_data.js  武器属性表（JSON 对象）
├── assets/sounds/      音效资源
└── doc/                开发文档
```

## 代码规范

- 请你以资深软件开发者和架构师的水平，根据我的修改要求进行更新。
- 除了我的要求，不要修复、优化其他无关的部分
- 不要删减修改任何我的代码里的旧注释
- 你的注释应简洁精炼。不要注释说增删改了哪里，注释应仅仅解释当前代码
- 如果你需要更多信息，请告诉我怎么做，不要假设和瞎猜
- 修改完后，你不需要运行，我自己去运行
