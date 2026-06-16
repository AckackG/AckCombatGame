# Project: Ballistics

一款基于 HTML5 Canvas 的 2D 战术射击/塔防游戏。赛博朋克风格 UI，使用原生 JavaScript ES Modules 构建。

## 🎮 游戏模式

- **战役模式 (Campaign)** — 波次防御，逐渐升级的敌人浪潮
- **沙盘模式 (Sandbox)** — 自由放置单位，测试武器与阵型
- **数据展示 (Database)** — 查看全部武器的详细属性数据

## 🚀 运行方式

本项目是纯前端应用，无需构建工具、无需 Node.js。

### 本地运行

由于使用了 ES Modules (`type="module"`)，需要通过 HTTP 服务器打开，不能直接双击 `index.html`。

```bash
# 方式一：Python
python -m http.server 8080

# 方式二：Node.js
npx serve .

# 方式三：VS Code 插件 Live Server
```

然后访问 `http://localhost:8080`。

### GitHub Pages 部署

本项目可直接部署到 GitHub Pages（作为子页面）：

1. 在仓库 Settings → Pages 中选择分支和根目录
2. 访问 `https://<username>.github.io/<repo-name>/`

无需额外配置，所有资源路径均为相对路径。

## 📁 项目结构

```
├── index.html              入口页面
├── style.css               全局样式（赛博朋克/战术终端风格）
├── src/                    源代码
│   ├── main.js             JS 入口，模块组装
│   ├── core/               引擎核心与系统
│   │   ├── game.js         游戏循环、世界状态、视口管理
│   │   ├── config.js       全局常量配置
│   │   ├── utils.js        数学工具函数
│   │   ├── quadtree.js     四叉树空间索引
│   │   ├── logic.js        伤害与击杀结算
│   │   ├── weapons.js      武器系统（射弹/即时命中/近战）
│   │   ├── effects.js      状态效果（DOT 等）
│   │   ├── wave.js         战役波次管理
│   │   ├── btn_event.js    输入事件处理
│   │   ├── database.js     武器数据展示 UI
│   │   ├── sound_manager.js 音效管理
│   │   ├── rts_control.js  RTS 框选控制
│   │   ├── performance_counter.js 性能计数器
│   │   ├── CanvasTextPrompt.js    飘字与粒子效果
│   │   └── SpriteCache.js  精灵缓存
│   ├── entities/           游戏实体
│   │   ├── obj_basic.js    实体基类
│   │   ├── units.js        单位（步兵/炮塔/怪物等）
│   │   ├── projectiles.js  投射物与子弹
│   │   └── battalion.js    单位生成工厂
│   └── data/               数据配置
│       └── weapons_data.js 武器属性数据表
├── assets/                 静态资源
│   └── sounds/             音效文件
├── doc/                    开发文档
│   ├── dev.md              开发计划与 TODO
│   ├── new_features.md     功能开发指令
│   ├── bullet_refactor.md  子弹系统重构设计
│   └── recoil_reference.md 后坐力数据参考表
└── README.md               本文件
```

## 🎯 核心特性

- **物理弹道系统** — 子弹有真实运动轨迹，支持穿透、爆炸、曳光效果
- **四叉树碰撞优化** — 高效处理大量单位/子弹的碰撞检测
- **单位升级系统** — 击杀获取经验，提升属性
- **RTS 控制** — 框选单位、手动移动与攻击指令
- **武器数据统计** — 实时统计准度、击杀率等数据
- **状态效果** — DOT（持续伤害）等可叠加效果

## 🛠️ 技术栈

- **HTML5 Canvas** — 2D 渲染
- **Vanilla JavaScript (ES Modules)** — 零依赖
- **Web Audio API** — 音效播放
- **无构建工具** — 无 Webpack/Vite，直接运行

## 📜 License

Private project.
