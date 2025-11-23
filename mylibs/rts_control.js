import { unit_distance, point_distance } from "./utils.js";

class RTSControl {
  constructor() {
    this.selectedUnits = [];

    // 框选相关
    this.isSelecting = false;
    this.selectionStart = { x: 0, y: 0 }; // 屏幕坐标
    this.selectionRect = { x: 0, y: 0, w: 0, h: 0 }; // 世界坐标矩形

    // 右键判定相关
    this.rightClickStartPos = { x: 0, y: 0 }; // 屏幕坐标
    this.clickThreshold = 10; // 判定为点击的最大位移像素
  }

  // 初始化方法，由 main.js 调用
  init(game, world) {
    this.game = game;
    this.world = world;
    this.initEvents();
  }

  initEvents() {
    const canvas = this.world.canvas;

    // --- 左键框选逻辑 ---
    canvas.addEventListener("mousedown", (e) => {
      // 排除放置模式，且必须是左键(0)
      if (e.button !== 0) return;
      // 这里虽然没法直接访问 placing 变量，但可以通过判断当前是否正在放置来决定(通常放置逻辑会阻止默认行为或抢占)
      // 为简化，假设放置模式下不进行框选，需在外部协调，或者这里简单判断
      // 实际项目中可以在 mousedown 里检查 global placing state

      this.isSelecting = true;
      this.selectionStart = { x: e.clientX, y: e.clientY };
      this.selectionRect = { x: 0, y: 0, w: 0, h: 0 };
    });

    canvas.addEventListener("mousemove", (e) => {
      if (this.isSelecting) {
        // 计算世界坐标的选框
        const startWorld = this.world.viewport.screenToWorld(
          this.selectionStart.x,
          this.selectionStart.y
        );
        const currentWorld = this.world.viewport.screenToWorld(e.clientX, e.clientY);

        const x = Math.min(startWorld.x, currentWorld.x);
        const y = Math.min(startWorld.y, currentWorld.y);
        const w = Math.abs(currentWorld.x - startWorld.x);
        const h = Math.abs(currentWorld.y - startWorld.y);

        this.selectionRect = { x, y, w, h };
      }
    });

    canvas.addEventListener("mouseup", (e) => {
      if (e.button === 0 && this.isSelecting) {
        this.isSelecting = false;
        this.selectUnitsInRect(this.selectionRect);
        this.selectionRect = { x: 0, y: 0, w: 0, h: 0 }; // 清理视觉
      }
    });

    // --- 右键指令逻辑 ---
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 2) {
        // 右键
        this.rightClickStartPos = { x: e.clientX, y: e.clientY };
      }
    });

    canvas.addEventListener("mouseup", (e) => {
      if (e.button === 2) {
        // 右键
        const dist = point_distance(
          this.rightClickStartPos.x,
          this.rightClickStartPos.y,
          e.clientX,
          e.clientY
        );
        // 只有位移很小时才算点击，避免和平移视口冲突
        if (dist < this.clickThreshold) {
          const worldPos = this.world.viewport.screenToWorld(e.clientX, e.clientY);
          this.handleRightClick(worldPos.x, worldPos.y);
        }
      }
    });

    // --- 键盘快捷键 ---
    window.addEventListener("keydown", (e) => {
      if (this.selectedUnits.length === 0) return;

      if (e.key.toLowerCase() === "s") {
        // S: 停止移动，保持攻击
        this.selectedUnits.forEach((u) => {
          if (!u.dead) u.commandStopMove();
        });
      } else if (e.key.toLowerCase() === "x") {
        // X: 恢复AI (取消选中，清除指令)
        this.clearSelectionAndResumeAI();
      }
    });
  }

  selectUnitsInRect(rect) {
    // 先清除旧选中
    this.selectedUnits.forEach((u) => (u.isSelected = false));
    this.selectedUnits = [];

    // 容错：如果只是点击，rect可能很小，给个最小范围
    const checkW = Math.max(rect.w, 1);
    const checkH = Math.max(rect.h, 1);

    // 利用 Quadtree 检索区域内的单位
    const candidates = this.world.UnitsQT.retrieve({
      x: rect.x,
      y: rect.y,
      width: checkW,
      height: checkH,
    });

    candidates.forEach((unit) => {
      // 1. 属于玩家
      // 2. 在矩形内 (简单AABB)
      // 3. 不是子弹或特效等非Unit物体 (根据类型判断)
      if (unit.color === this.game.player_color && !unit.dead && unit.maxhp) {
        // 简单判断是不是单位
        if (
          unit.x >= rect.x &&
          unit.x <= rect.x + checkW &&
          unit.y >= rect.y &&
          unit.y <= rect.y + checkH
        ) {
          unit.isSelected = true;
          // 选中时刷新30秒手动时间
          unit.refreshManualControl();
          this.selectedUnits.push(unit);
        }
      }
    });
  }

  handleRightClick(wx, wy) {
    if (this.selectedUnits.length === 0) return;

    // 1. 检测点击了什么：使用 Quadtree 查找鼠标附近的小区域
    const clickRadius = 20;
    const candidates = this.world.UnitsQT.retrieve({
      x: wx - clickRadius,
      y: wy - clickRadius,
      width: clickRadius * 2,
      height: clickRadius * 2,
    });

    let targetEnemy = null;
    // 寻找被点击的敌军，优先找最近的
    let minE_Dist = clickRadius;

    for (let u of candidates) {
      if (u.color !== this.game.player_color && !u.dead && u.maxhp) {
        const d = point_distance(u.x, u.y, wx, wy);
        if (d < u.size + 10 && d < minE_Dist) {
          // 稍微宽容一点的点击判定
          minE_Dist = d;
          targetEnemy = u;
        }
      }
    }

    if (targetEnemy) {
      // --- 攻击指令 ---
      this.selectedUnits.forEach((u) => {
        if (!u.dead) u.commandAttack(targetEnemy);
      });
      // 视觉反馈 (可选)
      // console.log("Attack Command Issued");
    } else {
      // --- 移动指令 ---
      const count = this.selectedUnits.length;
      this.selectedUnits.forEach((u) => {
        if (!u.dead) {
          // 多单位移动增加微小随机偏移，防止重叠
          let offsetX = 0;
          let offsetY = 0;
          if (count > 1) {
            offsetX = (Math.random() - 0.5) * count * 2;
            offsetY = (Math.random() - 0.5) * count * 2;
          }
          u.commandMove(wx + offsetX, wy + offsetY);
        }
      });
    }
  }

  clearSelectionAndResumeAI() {
    this.selectedUnits.forEach((u) => {
      u.isSelected = false;
      u.resumeAI();
    });
    this.selectedUnits = [];
  }

  // 必须在 World.render 中调用
  render(ctx) {
    if (this.isSelecting) {
      ctx.save();
      ctx.strokeStyle = "#0f0";
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(0, 255, 0, 0.2)";

      const { x, y, w, h } = this.selectionRect;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  }
}

export const rtsControl = new RTSControl();
