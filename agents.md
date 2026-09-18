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
    ├── game_design/    游戏设计文档
    └── program_logic/  程序逻辑文档
```

## 代码规范

- 请你以资深软件开发者和架构师的水平，根据我的修改要求进行更新。
- 除了我的要求，不要修复、优化其他无关的部分
- 不要删减修改任何我的代码里的旧注释
- 你的注释应简洁精炼。不要注释说增删改了哪里，注释应仅仅解释当前代码
- 如果你需要更多信息，请告诉我怎么做，不要假设和瞎猜
- 修改完后，你不需要运行，我自己去运行
- 每次更新代码后，必须同步更新主界面（如 `index.html`）中的版本号和后缀。
  - 需要将 `VER 0.1.x ALPHA` 里的 `x` 进行自增（版本号更新）。
  - 需要将 `// SYSTEM READY` 或旧的日期，改为当天的更新日期（例如 `// 2026-06-16`，不带时间）。

## Doc Routing

- 长期设计原则与约束以 `docs/` 为准；`README.md` 只给人类看，不作规范来源。
- 不要默认通读 `docs/`；但也不要只读「我改的那个模块」那一篇——见检索协议。
- 改完代码后同步检查对应文档。判据变了而文档没变，下一个 Agent 会按旧判据改错。
- 涉及对应模块的代码修改时，应同步检查并更新相关文档
- 如果一个文件在大多数改动里都被反复查阅，说明它还拆得不够细。

### 检索协议（先做这个，再进代码）

1. **全量 grep `docs/`，不要猜代码里的搜索词。** docs 通常只有几百到一两千行，
   `grep -rn <关键词> docs/` 的代价远低于在代码里试三次搜索词。找阈值、常数、
   判据、开关名时尤其如此。
2. **读两篇，不是一篇**：你要改的模块那篇，加上「决定这个模块的输出会不会被采纳」
   的那篇。Bug 常常不在模块内部，而在两篇文档的交界处——那里通常无人认领。
3. 文档给的是**为什么和边界**，**当前长什么样去读代码**。两者冲突以代码为准，
   并当场修文档。

### 每篇 doc 的骨架

开头一行入口锚点，正文写决策，结尾两小节：

    入口：`path/to/entry_module.ext`

    ...（决策、取舍、边界、被排除的方案及原因）...

    ## 依赖别处的判据
    - <标识符> 的含义与取值 → docs/<other>.md
    - <标识符> 的限频/配额行为 → docs/<other>.md

    ## 怎么离线复核
    用哪份数据、和什么对比、什么算通过。

- **写标识符，不写函数名。** 常数名、开关名、字段名值得写进正
  的锚点，且比路径更抗重构；函数名和行号腐烂最快，省下的也就一次 grep。
- **不要维护中央模块清单。** 中央清单必然腐烂，而且腐烂时没有
  入口锚点跟着拥有它的那篇 doc 走。

### 索引写法

索引条目回答「**什么时候需要翻开它**」，不是「里面有什么」。

- ✅ `docs/x.md`：改推送/筛选逻辑前必读——谁能进池子、门槛为什么是这个值
- ❌ `docs/x.md`：筛选、指标与样本留存的决策边界

条目多于 ~8 条时按子系统分组，不要平铺。

### 写什么 / 不写什么

**核心原则 1（解耦）**：Agent 应该只看少数几篇就能理解本次改动的模块。按子系统／
链路切分（`前端.md` `后端.md`），绝不按时序切分（`第一步.md` `第二步.md`）。

**核心原则 2（只写代码表达不了的）**：判断标准只有一句——**未来 Agent 只看代码，
是否仍然无法知道这件事？** 能从代码看出来的就不要写。

值得写：为什么选 A 不选 A2；A 依赖什么前提；边界在哪；什么情况下不能再用；
哪些方案被排除、为什么；踩过的坑和它的代价。

不要写：项目现状、模块／字段／按钮清单、目录结构、普通执行流程、路线图和
「下一步」。**状态类断言会静默过期，而过期的断言比缺失更危险*
相信「尚未引入测试框架」这种句子，然后不跑测试就交付。流程和状态只能作为极简
背景出现。

**实测结论必须带样本量和日期。** 只写「实测 X」而不写「N 个样本 / YYYY-MM-DD」，
三个月后它会被当成定论。用两三个样本凑出来的阈值，要显式标注它尚未被证明不是
过拟合。

### docs index

- 游戏设计
  - `doc/game_design/weapon_design.md` — 武器设计：武器分类、战斗定位、距离/命中与后坐力参考。
  - `doc/game_design/recoil_reference.md` — 后坐力参考：不同后坐力下命中 SIZE=9 人类目标的射程数据表。
  - `doc/game_design/unit_design.md` — 单位设计：玩家单位、炮塔、敌军士兵、怪物与测试单位。
  - `doc/game_design/world_logic_design.md` — 世界逻辑设计：世界状态、索敌、移动、碰撞与空间划分规则。
  - `doc/game_design/campaign_design.md` — 战役设计：波次推进、稳定检查点、动态难度与敌人渐进。
  - `doc/game_design/other_design.md` — 其他设计：UI体验、沙盒体验与音效反馈。
  - `doc/game_design/update_plan.md` — 更新计划：武器、单位、战役、世界逻辑、性能和平台能力的未来更新方向。
- 程序逻辑
  - `doc/program_logic/frontend.md` — 前端程序逻辑：入口、主循环、世界实体、战斗、战役、UI输入、渲染性能与测试。
  - `doc/program_logic/backend.md` — 后端程序逻辑：当前无后端；记录本地存储约束和引入后端前的文档要求。
