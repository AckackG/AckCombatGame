import { unit_distance, unit_angle, isBulletIntersect } from "../mylibs/utils.js";
import { CanvasTextPrompt } from "../mylibs/CanvasTextPrompt.js";
import { DOT } from "../mylibs/effects.js";
import { GunFactory, MeleeWeapon } from "../mylibs/weapons.js";
import { EntityBasic } from "./obj_basic.js";
import { game, world } from "../mylibs/game.js";
import soundManager from "../mylibs/sound_manager.js";
import { getCachedCircle, spriteScale } from "../mylibs/SpriteCache.js";
import { ManualControlTime } from "../mylibs/config.js";

const pos_range = world.pos_range;

export class Unit extends EntityBasic {
  // 新增 RTS 状态属性
  isSelected = false;
  manualControlEndTime = 0; // 手动模式结束时间戳
  commandMoveDest = null; // {x, y} 手动移动目标
  forcedTarget = null; // Unit 手动强制攻击目标

  target_x = 0; //移动目标坐标x
  target_y = 0; //移动目标坐标y
  angle = 0;

  effect_list = [];
  effect_map = new Map(); // 用于按类型索引DOT效果

  dead = false;

  // 用于被预瞄计算
  can_preaim = false; // 是否可以预瞄(Heavy Math)
  moved_x = 0;
  moved_y = 0;

  border_color = "black";

  combat_dodge_chance = 0.1; //战术平移概率
  combat_dodge_moving = false; //战术平移状态
  combat_dodge_to_left = true; //战术平移方向

  combat_threat_chance = 0.25; //选择危险目标而不是就近的概率
  combat_threat_range_mul = 3; //Threat寻敌在 3倍武器range 之内

  threat = 0; // 开火就有threat

  fixed_value = null; // 固定单位价值

  target = null; //攻击目标
  _is_rendergun = true;

  constructor({ x, y, size = 9, color, speed = 2, maxhp = 500, weapon } = {}) {
    super({ x, y, speed });
    this.size = size;
    this.color = color;

    this.hp = maxhp;
    this.maxhp = maxhp;

    this.width = size * 2.2;
    this.height = size * 2.2;

    this.weapon = weapon;
    this.combat_threat_range = weapon.range * this.combat_threat_range_mul;
    soundManager.play("spawn", { position: { x: this.x, y: this.y } });
  }

  get x() {
    return this._x;
  }

  get y() {
    return this._y;
  }

  set x(value) {
    // 限制x在0和pos_range.width之间
    this._x = Math.min(Math.max(value, 0), pos_range.width);
  }

  set y(value) {
    // 限制y在0和pos_range.height之间
    this._y = Math.min(Math.max(value, 0), pos_range.height);
  }

  /**
   * 获取矩形的重量，用于碰撞检测
   * 假设矩形的重量与其面积成正比，这里使用面积作为重量的代理。
   *
   * @returns {number} 返回矩形的面积，即size属性的平方。
   */
  get weight() {
    return this.size * this.size;
  }

  /**
   * 获取单位价格，用于击杀奖励
   *
   * @returns {number} 计算得到的单位价格。
   */
  get value() {
    if (this.fixed_value !== null) {
      return this.fixed_value;
    }
    const att_value =
      this.threat / 100 + this.weapon.stat_damage_total / 10 + this.weapon.stat_kills * 20;
    const unit_value = this.maxhp / 10 + this.speed * 10 + this.size * 5;
    const total = att_value + unit_value;
    // console.log(
    //   `+money ${total} | att_value ${att_value} | def_value ${super.value}`
    // );
    return total;
  }

  /**
   * 移动对象到目标 x,y。默认为靠近 target
   *
   * 此方法用于计算对象从当前位置到目标位置的移动。如果对象离目标位置足够近（小于速度值），
   * 则直接移动到目标位置；否则，根据目标位置和当前位置的向量进行移动。
   *
   * @param {Number} toX 目标位置的X坐标。如果不提供，则使用预设的目标X坐标。
   * @param {Number} toY 目标位置的Y坐标。如果不提供，则使用预设的目标Y坐标。
   */
  _moveToTarget(toX = this.target_x, toY = this.target_y) {
    this.moveToXY(toX, toY);
  }

  setMoveTarget(x, y) {
    // 假设pos_range.width和pos_range.height是x和y坐标的最大限制
    // 假设x和y坐标的最小限制是0

    // 限制x在0和pos_range.width之间
    this.target_x = Math.min(Math.max(x, 0), pos_range.width);

    // 限制y在0和pos_range.height之间
    this.target_y = Math.min(Math.max(y, 0), pos_range.height);
  }

  setTarget(target) {
    this.target = target;
    this.setMoveTarget(target.x, target.y);
  }

  /**
   * 检测当前对象是否与传入的子弹发生碰撞。
   * 如果发生碰撞，根据子弹的伤害减少当前对象的生命值，并处理子弹的状态。
   * @param {Object} bullet - 待检测的子弹对象，包含子弹的位置、大小、伤害等信息。
   */
  bullet_collision(bullet) {
    // 防止子弹已死亡或已处理过碰撞
    if (bullet.dead || bullet.has_damaged(this)) {
      return;
    }

    // 如果当前对象与子弹将已经相交，则处理碰撞。本算法比起距离算法，解决了高弹速下的伤害判定问题
    if (!this.dead && isBulletIntersect(bullet, this)) {
      bullet.onHit(this);
    }
  }

  /**
   * 检测并处理两个单位之间的碰撞。
   * 当两个单位发生碰撞时，此函数将调整它们的位置，以避免进一步的重叠。
   * @param {Object} unit - 要检测碰撞的另一个单位对象。
   */
  unit_collision(unit) {
    let combinedSize = this.size + unit.size;
    if (unit.x === this.x && unit.y === this.y) {
      unit.x = unit.x + combinedSize / 2;
      unit.y = unit.y + combinedSize / 2;
      this.x = this.x - combinedSize / 2;
      this.y = this.y - combinedSize / 2;
      return;
    }

    let dis = unit_distance(unit, this);

    if (dis >= combinedSize) {
      return;
    }

    let [unit_big, unit_small] = this.size > unit.size ? [this, unit] : [unit, this];

    // 计算方向向量
    let dx = unit_small.x - unit_big.x;
    let dy = unit_small.y - unit_big.y;
    let norm = Math.sqrt(dx * dx + dy * dy);

    // 归一化方向向量
    dx /= norm;
    dy /= norm;

    // 计算调整后的距离以避免重叠
    let overlap = (combinedSize - dis) / 2 + 1;

    // 按重量比例分配移动距离
    let combinedWeight = unit_big.weight + unit_small.weight;
    let moveSmall = overlap * (unit_big.weight / combinedWeight);
    let moveBig = overlap * (unit_small.weight / combinedWeight);

    // 更新位置，按比例移动
    unit_small.x += dx * moveSmall;
    unit_small.y += dy * moveSmall;
    unit_big.x -= dx * moveBig;
    unit_big.y -= dy * moveBig;

    // console.log(`after collision ${unit_small.x},${unit_small.y}`);
  }

  /**
   * 添加效果到效果列表中（优化版）
   * @param {DOT} effect - 要添加的效果对象
   */
  add_effect(effect) {
    // 如果不是DOT效果或没有name，直接添加
    if (!(effect instanceof DOT) || !effect.name) {
      this.effect_list.push(effect);
      return;
    }

    // 检查是否已存在相同名称的DOT
    const existingDOT = this.effect_map.get(effect.name);

    if (existingDOT && !existingDOT.dead) {
      // 合并到现有的DOT
      existingDOT.merge(effect);

      // 显示合并提示
      // world.CanvasPrompts.push(
      //   new CanvasTextPrompt({
      //     text: `${effect.render_affix} STACKED`,
      //     unit: this,
      //     color: effect.color,
      //     size: 12,
      //     lifetime: 800,
      //     vy: -0.5,
      //     fade: true,
      //   })
      // );
    } else {
      // 添加新的DOT
      this.effect_list.push(effect);
      this.effect_map.set(effect.name, effect);

      // 显示初次应用提示
      // world.CanvasPrompts.push(
      //   new CanvasTextPrompt({
      //     text: `${effect.render_affix} APPLIED`,
      //     unit: this,
      //     color: effect.color,
      //     size: 12,
      //     lifetime: 800,
      //     vy: -0.5,
      //     fade: true,
      //   })
      // );
    }
  }

  /**
   * 本单位击杀敌军后触发
   */
  _onkill(victim) {
    // console.log(`${this} unit kills ${victim}`);
  }

  // --- RTS 指令接口 ---

  // 刷新手动控制计时器 (30秒)
  refreshManualControl() {
    this.manualControlEndTime = game.time_now + ManualControlTime;
  }

  // 是否处于手动控制模式 (被选中 或 选中后30秒内)
  isManualMode() {
    // 只要被选中，就不断刷新计时器，永远保持 ManualMode
    if (this.isSelected) {
      this.refreshManualControl();
      return true;
    }
    return game.time_now < this.manualControlEndTime;
  }

  commandMove(x, y) {
    this.commandMoveDest = { x, y };
    this.refreshManualControl();
    // 注意：不清除 forcedTarget，允许边走边打
  }

  commandAttack(target) {
    this.forcedTarget = target;
    // 注意：不清除 commandMoveDest，允许保持之前的移动指令，同时转火
    this.refreshManualControl();
  }

  commandStopMove() {
    this.commandMoveDest = null;
    this.refreshManualControl();
  }

  resumeAI() {
    this.commandMoveDest = null;
    this.forcedTarget = null;
    this.manualControlEndTime = 0; // 立即结束手动模式
    this.target = null; // 清除当前目标重新寻找
  }

  // --- 逻辑重写 ---

  attack() {
    // 1. 优先处理强攻目标
    if (this.forcedTarget) {
      if (this.forcedTarget.dead) {
        // 强攻目标死亡，回退到普通状态
        this.forcedTarget = null;
        this.target = null; // 清除 target 以便 _find_target 重新运行
      } else {
        this.target = this.forcedTarget; // 锁定目标
      }
    }

    // 2. 原有的自动攻击逻辑
    // 即时检测目标是否死亡
    if (this.target && this.target.dead) {
      this.target = null;
      this._find_target();
    }

    if (this.target) {
      this.weapon.attack(this, this.target);
    } else {
      this._slow_findTarget();
    }
  }

  /**
   * 慢速寻找目标的函数，主要用于在战斗中决定攻击目标。
   * 本函数首先检查是否满足寻找目标的时机条件，然后根据威胁几率决定是寻找最近目标还是危险目标。
   *
   * @returns {boolean} 如果成功找到并设置了目标，则返回true；否则返回false。
   */
  _slow_findTarget() {
    if (game.is_half_second()) {
      this._find_target();
    }
  }

  /**
   * 根据武器范围或全图搜索，寻找目标单位。
   * @param {number} range_mul - 武器范围的倍数，用于近战单位扩大搜索范围。
   * @returns {boolean|Unit} - 如果找到目标返回目标单位，否则返回false。
   */
  _find_target(range_mul = 1) {
    let UnitList;

    //临时建一个大范围单位，用于筛选武器范围内的单位
    let UnitsInRange = world.UnitsQT.retrieve({
      x: this.x,
      y: this.y,
      width: this.weapon.range * range_mul,
      height: this.weapon.range * range_mul,
    });
    //只选敌军单位
    UnitsInRange = UnitsInRange.filter((unit) => {
      return unit.color !== this.color;
    });
    // 如果范围内有敌军单位
    if (UnitsInRange?.length) {
      UnitList = UnitsInRange;
      // console.log(`附近有 ${UnitsInRange?.length}个单位`);
    }
    //Monster 附近没有敌军，保持原有目标
    else if (range_mul !== 1) {
      // console.log("Monster 附近没有敌军，保持原有目标");
      return false;
    }

    // 如果范围内没有敌军单位，则选取地图上的所有敌军单位
    else {
      UnitList = world.units;
      UnitList = UnitList.filter((unit) => unit.color !== this.color);
      // console.log("附近没有单位，全图搜索！");
    }

    this.target = null;
    this.combat_dodge_moving = false;

    //先根据概率选择寻敌策略，如果threat寻敌失败则再次就近寻敌
    if (Math.random() > this.combat_threat_chance) {
      //可能的优化：先从 quadtree 里找最近单位，找不到再遍历所有
      //可能的优化：比较距离的平方而不是距离，反正是比大小不用开平方了
      return this._slow_findNearestTarget(UnitList);
    } else {
      if (this._slow_findDangerousTarget(UnitList)) {
        return true;
      } else {
        return this._slow_findNearestTarget(UnitList);
      }
    }
  }

  /**
   * 查找最近的目标单位，如果找到则设置为 Target。
   * 此方法通过遍历单位列表，计算当前单位与每个单位的距离，来找到距离最近且颜色不同的单位作为目标。
   * @param {Array} UnitList - 单位列表，用于遍历查找潜在的目标单位。
   * @param {number} MaxDistance - 距离限制，超出这个距离的单位不会被选择。默认为无穷大 Infinity
   * @returns {boolean} - 返回是否成功找到了并设置了目标单位，如果找到目标则返回true，否则返回false。
   */
  _slow_findNearestTarget(UnitList, MaxDistance = Infinity) {
    let closestUnit = null;
    let minDistance = MaxDistance;

    UnitList.forEach((unit) => {
      const dis = unit_distance(this, unit);
      if (dis < minDistance) {
        minDistance = dis;
        closestUnit = unit;
      }
    });

    if (closestUnit) {
      this.setTarget(closestUnit);
      return true;
    }
    return false;
  }

  /**
   * 查找潜在的危险目标。
   * 该方法在给定的单位列表中，寻找威胁最大的非友军单位作为目标。
   * 如果找到威胁足够的目标，将设置这个Target 并返回true；否则返回false。
   *
   * @param UnitList 单位列表，用于遍历查找目标。
   * @param MaxDistance 最大搜索距离，默认为this.combat_threat_range。
   * @returns 如果设置了目标则返回true，否则返回false。
   */
  _slow_findDangerousTarget(UnitList, MaxDistance = this.combat_threat_range) {
    let highestThreat = 0;
    let mostDangerousUnit = null;

    UnitList.forEach((unit) => {
      if (unit_distance(this, unit) < MaxDistance) {
        const threatLevel = unit.threat;
        if (threatLevel > highestThreat) {
          highestThreat = threatLevel;
          mostDangerousUnit = unit;
        }
      }
    });
    if (mostDangerousUnit) {
      this.setTarget(mostDangerousUnit);
      return true;
    }
    return false;
  }

  _move() {
    // 用于PREAIM,记录帧开始时的位置
    const startX = this.x;
    const startY = this.y;

    this.__move();

    // 用于PREAIM,计算本帧的实际位移速度 (Actual Velocity)
    // 用于PREAIM,这解决了“单位停下但 dx/dy 仍不为0”导致预瞄打偏的问题
    this.moved_x = this.x - startX;
    this.moved_y = this.y - startY;
  }

  __move() {
    // *** RTS 逻辑核心 ***

    // 优先级 1: 手动移动指令
    if (this.commandMoveDest) {
      const dist = Math.sqrt(
        Math.pow(this.commandMoveDest.x - this.x, 2) + Math.pow(this.commandMoveDest.y - this.y, 2)
      );
      // 如果距离很近，认为到达，清除指令
      if (dist < this.speed) {
        this.commandMoveDest = null;
      } else {
        // 直接走向目标点，忽略其他逻辑
        this.moveToXY(this.commandMoveDest.x, this.commandMoveDest.y);
        return;
      }
    }

    // 优先级 2: 手动模式下的行为抑制
    if (this.isManualMode()) {
      // 在手动模式下，如果没有移动指令：
      // 如果有强攻目标 -> 尝试靠近到射程内，如果在射程内则原地不动(不进行战术平移)
      if (this.forcedTarget && !this.forcedTarget.dead) {
        let dis = unit_distance(this, this.forcedTarget);
        if (this.weapon.range < dis) {
          this._moveToTarget(this.forcedTarget.x, this.forcedTarget.y);
        }
        // 射程内什么都不做 = 站桩输出
      }
      // 如果没有目标，或者普通自动寻敌的目标 -> 原地不动，禁止AI乱跑
      return;
    }

    // 优先级 3: 原始全自动 AI (30秒后恢复)
    // ... 原有的 _move 代码 ...
    // 没有目标就不动
    if (!this.target) {
      return;
    }

    // 如果超出攻击距离，则向目标移动
    let dis = unit_distance(this, this.target);
    if (this.weapon.range < dis) {
      this._moveToTarget();
    }
    // 怪物后退逻辑
    // 可能的优化，避免循环引用
    // 在 Unit 类或 Base 类中，添加一个属性 is_monster = false。
    // 在 Monster 类中，将 is_monster 设为 true。
    // 在 _move 中判断：
    else if (this.target instanceof Monster && this.weapon.range * 0.85 > dis) {
      this.moveAwayFromUnit(this.target);
    }
    // 战术平移逻辑
    else {
      if (this.combat_dodge_moving) {
        this.moveStrafe(this.target, this.combat_dodge_to_left);
      }
      if (game.is_half_second() && this.combat_dodge_chance > Math.random()) {
        // ... 原有的平移随机切换逻辑 ...
        if (this.combat_dodge_moving && this.combat_dodge_chance / 2 > Math.random()) {
          this.combat_dodge_moving = false;
        } else {
          this.combat_dodge_moving = true;
          this.combat_dodge_to_left = this.combat_dodge_moving
            ? !this.combat_dodge_to_left
            : this.combat_dodge_to_left;
        }
      }
    }
  }

  // --- 渲染更新 ---
  render(ctx) {
    // 调用原有的渲染
    this.#render_circle(ctx);

    //Show HP
    this.#render_hpbar(ctx);

    //Show GunDirection
    this.#render_gun(ctx);

    // Show RTS Control
    this.#render_RTSControl(ctx);

    //Show weapon
    let weapon_stat = this.weapon.get_mag_info();
    ctx.fillStyle = "black";
    ctx.fillText(weapon_stat, this.x - 25, this.y + 8 + this.size);

    //show debug
    this.#render_debuginfo(ctx);
  }

  #render_RTSControl(ctx) {
    // 绘制选中光环
    if (this.isSelected) {
      ctx.save();
      ctx.strokeStyle = "rgba(9, 181, 9, 1)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      // 画一个椭圆或者圆在脚下
      ctx.arc(this.x, this.y, this.size + 6, 0, Math.PI * 2);
      ctx.stroke();

      // 如果有强制目标，画一条连接线表示锁定
      if (this.forcedTarget && !this.forcedTarget.dead) {
        ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.forcedTarget.x, this.forcedTarget.y);
        ctx.stroke();
      }

      // 如果有移动指令，画一条线到目标点
      if (this.commandMoveDest) {
        ctx.strokeStyle = "rgba(17, 182, 17, 0.5)";
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.commandMoveDest.x, this.commandMoveDest.y);
        ctx.stroke();
      }

      ctx.restore();
    }

    // I关闭状态指示 (内切正方形) ---
    // 仅在手动模式下绘制
    if (this.isManualMode()) {
      ctx.save();
      ctx.strokeStyle = "rgba(0, 255, 255, 0.6)"; // 青色，代表"指令接收中"
      ctx.lineWidth = 1;

      // 计算内切正方形的半边长 (r / √2)
      // Math.SQRT1_2 是 1/√2 的常量，约等于 0.707，乘法比除法快
      const offset = this.size * Math.SQRT1_2;
      const side = offset * 2;

      // 绘制正方形
      ctx.strokeRect(this.x - offset, this.y - offset, side, side);

      ctx.restore();
    }
  }

  #render_hpbar(ctx) {
    // Calculate HP percentage
    let hpPercent = this.hp / this.maxhp;

    // Determine the color of the HP bar
    if (hpPercent > 0.5) {
      ctx.fillStyle = "green";
    } else if (hpPercent > 0.25) {
      ctx.fillStyle = "orange";
    } else {
      ctx.fillStyle = "red";
    }

    // Draw the HP bar
    const barWidth = this.size * 3; // Width of the HP bar
    const barHeight = 8; // Height of the HP bar
    const barX = this.x - barWidth / 2; // Center the bar above the unit
    const barY = this.y - 12 - this.size; // Position the bar a little above the unit

    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

    // Draw the border of the HP bar
    ctx.lineWidth = 1;
    ctx.strokeStyle = this.can_preaim ? "gold" : "black"; // 预瞄精英单位金边
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Show HP text
    ctx.fillStyle = "white";
    let hp_text = parseInt(this.hp);
    ctx.fillText(hp_text, this.x - this.size, this.y - 3 - this.size);
  }

  /**
   * 绘制枪支的函数
   *
   * @param {CanvasRenderingContext2D} ctx - HTML5 canvas的绘图上下文对象
   *
   * 如果没有目标，则不进行绘制。
   */
  #render_gun(/** @type {CanvasRenderingContext2D} */ ctx) {
    if (!this._is_rendergun || !this.target) {
      return;
    }
    const angle = unit_angle(this, this.target);
    // 设置线条宽度
    ctx.lineWidth = this.size / 5;

    // 设置线条颜色
    ctx.strokeStyle = "black"; // 线条颜色为红色

    // 开始绘制路径
    ctx.beginPath();

    // 移动到起点
    ctx.moveTo(this.x, this.y); // 起点坐标为(50, 50)

    // 绘制线条
    ctx.lineTo(
      this.x + this.size * 1.3 * Math.cos(angle),
      this.y + this.size * 1.3 * Math.sin(angle)
    );

    // 绘制线条
    ctx.stroke();
  }

  #render_debuginfo(ctx) {
    if (!this.target || !game.is_DebugMode()) return;

    // -------target 指示线--------
    const fromX = this.x;
    const fromY = this.y;
    const toX = this.target.x;
    const toY = this.target.y;

    ctx.strokeStyle = this.color; // 设置线条颜色
    ctx.fillStyle = this.color; // 设置填充颜色（用于箭头头部）
    const headLength = 20; // 箭头头部的长度
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // 绘制箭头头部
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();

    // -------combat_dodge 指示线--------
    if (this.combat_dodge_moving) {
      // 设置虚线样式
      ctx.setLineDash([3, 2]); // [5, 15] 表示线段长度为 5，空隙长度为 15
      ctx.strokeStyle = this.color;
      ctx.fillStyle = this.color;

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      const angle_dir = this.combat_dodge_to_left ? 1 : -1;
      ctx.lineTo(
        fromX + this.speed * 30 * Math.cos(angle + (angle_dir * Math.PI) / 2),
        fromY + this.speed * 30 * Math.sin(angle + (angle_dir * Math.PI) / 2)
      );
      ctx.stroke();

      // 关闭虚线样式，恢复为实线（如果需要绘制其他图形）
      ctx.setLineDash([]);
    }
  }

  #render_circle(ctx) {
    const sprite = getCachedCircle(this.color, this.size, this.border_color);

    // 原始图片是放大了 spriteScale 倍的
    // 所以我们在画的时候，要把宽高除以 spriteScale
    const drawWidth = sprite.width / spriteScale;
    const drawHeight = sprite.height / spriteScale;

    const offset = drawWidth / 2;

    // drawImage 支持 5 个参数或 9 个参数
    // drawImage(img, x, y, width, height) -> 这里指定宽和高，浏览器会自动缩放
    ctx.drawImage(sprite, this.x - offset, this.y - offset, drawWidth, drawHeight);
  }

  _update_effect() {
    this.effect_list.forEach((effect) => {
      effect.update();
    });

    // 清理死亡的效果
    this.effect_list = this.effect_list.filter((effect) => {
      if (effect.dead && effect instanceof DOT && effect.name) {
        // 从映射中移除
        this.effect_map.delete(effect.name);
      }
      return !effect.dead;
    });
  }
  /**
   * 更新角色的健康点数（HP）。
   * 该方法主要用于检查角色的HP是否小于等于0，如果是，则标记角色为死亡。
   *
   * @returns {boolean} 如果角色的HP大于0，则返回true；如果角色的HP小于等于0，标记角色为死亡并返回false。
   */
  _update_hp() {
    if (this.hp <= 0) {
      this.dead = true;

      return false;
    }

    return true;
  }

  /**
   * 慢速更新函数，主要用于处理非实时更新的逻辑。
   *
   * 该方法避免在每一帧都执行耗时的操作，只在特定条件下执行。
   *
   * @function _update_slow
   */
  update_slow() {
    // 清除死亡的 target
    if (this.target && this.target.dead) {
      this.target = null;
    }

    // 随着时间减少 threat，每帧减少1
    if (this.threat > 0) {
      this.threat -= game.targetFPS;
    }
  }

  update() {
    this._move();
    this._update_hp();
    this._update_effect();
    this.attack();
  }
}

export class Fighter extends Unit {
  combat_dodge_chance = 0.3; //增强的闪避概率
  border_color = "gold";

  //玩家属性
  level = 0;
  exp = 0;
  hp_regen = 5;
  /**
   * 属于玩家的步兵单位，可以升级
   *
   * @param {number} x 对象的x坐标。
   * @param {number} y 对象的y坐标。
   * @param {number} size 对象的大小。
   * @param {string} color 对象的颜色。
   * @param {number} speed 对象的速度。
   * @param {number} maxhp 对象的最大生命值。
   * @param {string} weapon 对象的武器类型。
   */
  constructor({ x, y, weapon, size = 8, color = game.player_color, speed = 3, maxhp = 1500 } = {}) {
    super({ x, y, size, color, speed, maxhp, weapon });
  }

  update_slow() {
    super.update_slow();
    this.hp = Math.min(this.hp + this.hp_regen, this.maxhp);
  }

  _onkill(victim) {
    super._onkill(victim);

    this.exp += victim.value;
    //击杀加速下一次换弹!
    this.weapon.boost_reload(this.x, this.y);

    const expNeeded = 1000 + this.level * 350;
    if (this.exp >= expNeeded) {
      this.level++;
      this.exp -= expNeeded;

      // 提升属性
      this.maxhp += 100;
      this.hp = Math.min(this.hp + this.maxhp * 0.25, this.maxhp); // 回血25%
      this.speed = Math.min(this.speed + 0.2, 5); // 微量提升移速
      this.hp_regen += 2;
      this.weapon.ReloadTime = Math.max(500, this.weapon.ReloadTime * 0.95); // 减少5%换弹时间
      this.weapon.recoil = Math.max(0.1, this.weapon.recoil * 0.9); // 减少10%后坐力

      if (this.level > 6) {
        this.can_preaim = true;
      }

      // 视觉与听觉反馈
      soundManager.play("levelup", { position: { x: this.x, y: this.y } });
      world.CanvasPrompts.push(
        new CanvasTextPrompt({
          text: "LVL UP!",
          unit: this,
          color: "gold",
          size: 18,
          lifetime: 4000,
          vy: -1,
        })
      );
    }
  }
}

export class Turret extends Fighter {
  combat_dodge_chance = 0;
  constructor({ x, y, weapon, size = 25, color = game.player_color, maxhp = 8000 } = {}) {
    //炮塔用任何武器都加强
    let TurretGun = GunFactory.random_gun(0.5);
    TurretGun.recoil /= 1.2;
    TurretGun.ReloadTime /= 1.2;
    TurretGun.burst *= 2;
    TurretGun.magsize *= 2;

    if (TurretGun.PreFireRange) {
      TurretGun.PreFireRange *= 3;
    }
    super({
      x,
      y,
      size,
      color,
      speed: 0.01,
      maxhp,
      weapon: TurretGun,
    });
  }

  _move() {
    //防御塔不能移动
  }

  get weight() {
    //防御塔比较重
    return this.size * this.size * this.size;
  }
}

export class Monster extends Unit {
  combat_dodge_chance = 0; //近战攻击者，不闪避

  combat_threat_chance = 0.1;
  combat_threat_range_mul = 10; //近战攻击Threat寻敌距离加长

  _is_rendergun = false; //不渲染武器

  constructor({
    x,
    y,
    weapon,
    size = 8,
    color = "rgb(174, 0, 213)",
    speed = 2.5,
    maxhp = 300,
    monster_mul = 1, //怪物强度乘数
    speed_up_factor = 0.07,
  } = {}) {
    super({
      x,
      y,
      size: size * monster_mul,
      color,
      speed, //速度不应该有加成，不好控制游戏节奏
      maxhp: maxhp * monster_mul,
      weapon,
    });
    this.speed_up_factor = speed_up_factor;
    this.last_position = { x: this.x, y: this.y };
    this.stuck_counter = 0;
    this.random_offset_angle = 0;
    this.min_move_threshold = this.speed * this.speed * 0.01; // 预计算
  }

  _move() {
    // 没有目标就不动
    if (!this.target) {
      return;
    }

    // 每3帧检测一次卡住
    if (game.time_now % 3 === 0) {
      const dx = this.x - this.last_position.x;
      const dy = this.y - this.last_position.y;
      const moved_distance_sq = dx * dx + dy * dy;

      if (moved_distance_sq < this.min_move_threshold) {
        this.stuck_counter++;
      } else {
        this.stuck_counter = 0;
      }

      this.last_position.x = this.x;
      this.last_position.y = this.y;
    }

    // 卡住超过10次检测(≈1秒)，添加随机偏移
    if (this.stuck_counter > 10) {
      this.random_offset_angle = (Math.random() - 0.5) * Math.PI;
      this.stuck_counter = 0;
    }

    // 正常移动逻辑
    if (this.weapon.range < unit_distance(this, this.target)) {
      const base_angle = unit_angle(this, this.target);
      const actual_angle = base_angle + this.random_offset_angle;
      this.moveTowards(actual_angle);
      this.random_offset_angle *= 0.95;
    }

    //===没有平移逻辑===
  }

  /**
   * 慢速重新定位目标函数。
   *
   * 此函数用于在当前目标过于远离自身，超出武器攻击范围三倍时，寻找新目标。
   *
   * 避免近战单位追逐过远的目标
   */
  _slow_ReTarget() {
    if (this.target && unit_distance(this, this.target) > this.weapon.range * 3) {
      this._find_target(5);
    }
  }

  update_slow() {
    super.update_slow();
    this._slow_ReTarget();
    this.speed += this.speed_up_factor;

    // 每秒重置卡住计数器(防止累积)
    if (this.stuck_counter > 0) {
      this.stuck_counter = Math.max(0, this.stuck_counter - 2);
    }
  }

  _onkill(victim) {
    super._onkill(victim);
    //怪物强化s
    this.weapon.damage += 50;
    this.speed += 0.5;
    this.maxhp *= 1.1;
    this.hp = Math.min(this.hp * 1.5 + this.maxhp * 0.1, this.maxhp);
  }

  static spawn_fast(x, y, monster_mul) {
    // 如果没有指定 monster_mul，则生成随机数
    monster_mul = monster_mul ?? Math.random() + 0.75;
    return new this({
      x,
      y,
      speed: 4,
      size: 6,
      maxhp: 120,
      weapon: new MeleeWeapon({ monster_mul, damage: 25 }),
      monster_mul,
    });
  }

  static spawn_normal(x, y, monster_mul) {
    monster_mul = monster_mul ?? Math.random() + 0.75;
    return new this({
      x,
      y,
      speed: 2.5,
      size: 9,
      maxhp: 350,
      weapon: new MeleeWeapon({ monster_mul, damage: 50 }),
      monster_mul,
    });
  }

  static spawn_big(x, y, monster_mul) {
    monster_mul = monster_mul ?? Math.random() + 0.75;
    return new this({
      x,
      y,
      speed: 0.5,
      size: 13,
      maxhp: 700,
      weapon: new MeleeWeapon({ monster_mul, damage: 100 }),
      monster_mul,
    });
  }
}

export class Dummy extends Unit {
  constructor({ x, y, weapon, size = 15, color = "red", speed = 3, maxhp = 10000 } = {}) {
    super({ x, y, size, color, speed, maxhp, weapon });
    this.fixed_value = 5000; //假人固定价值，利于升级
  }
  update() {
    //不会动
    this._update_hp();
    this._update_effect();
  }
}

export class Base extends Unit {
  constructor({
    x,
    y,
    size = 40,
    color = game.player_color,
    speed = 0,
    hp = 20000,
    weapon = GunFactory.random_gun(0.5),
  } = {}) {
    super({ x, y, size, color, speed, maxhp: hp, weapon });
    this.hp_regen = 20; // 基地回血速度
    this.is_monster = false; //基地不算做敌人
  }

  // 重写 update 方法，使其不执行任何移动或攻击逻辑
  update() {
    this._update_hp();
    this._update_effect();
  }

  update_slow() {
    super.update_slow();
    this.hp = Math.min(this.hp + this.hp_regen, this.maxhp);
  }
}
