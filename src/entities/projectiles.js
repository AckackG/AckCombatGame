import { getRandomSign, unit_distance, point_distance } from "../core/utils.js";
import { CanvasTextPrompt, CanvasCircle } from "../core/CanvasTextPrompt.js";
import { deal_damage, target_killed } from "../core/logic.js";
import { DOT } from "../core/effects.js";
import { BulletBasic, EntityBasic } from "./obj_basic.js";
import { ExplodeBehavior, BurnOnHitBehavior, PoisonOnHitBehavior } from "./bullet_behaviors.js";
import { game, world } from "../core/game.js";
import { getCachedCircle, spriteScale } from "../core/SpriteCache.js";
import {
  DefaultAttenuationRangeMul,
  DefaultMaxRangeMul,
  MaxBulletDamageDropPer,
} from "../core/config.js";

const pos_range = world.pos_range;

export class Bullet extends BulletBasic {
  _dead = false;
  MapBorderMargin = world.pos_range.width / 8;

  //战斗相关
  pierce = 1; // 能穿透几个单位
  damaged_units = new WeakSet(); //伤害过的单位。只影响碰撞检测，不影响爆炸

  //信息相关
  name = "Bullet";
  damage_text_always = false; //无论是否DEBUG模式，都显示伤害
  damage_text_affix = "";
  EndLife_warning = false; // 武器普遍限制距离 之后，默认关闭
  first_frame = true; //第一帧

  /**
   * 弹丸类的构造函数
   *
   * @param {number} x - 弹丸的初始x坐标。
   * @param {number} y - 弹丸的初始y坐标。
   * @param {number} angle - 弹丸的发射角度，单位为弧度。
   * @param {Object} source_weapon - 弹丸的来源武器对象，用于继承武器的伤害属性。
   * @param {Object} source_unit - 弹丸的来源单位对象，用于继承单位的颜色属性。
   * @param {number} [speed=20] - 弹丸的初始速度，默认为20。
   * @param {number} [size=1] - 弹丸的大小，默认为1。
   * @param {number} [lifetime=null] - 弹丸的生命周期，默认为null，自动根据 range_max 计算。
   * @param {number} [acceleration=0] - 弹丸在"默认angle"上的加速度，默认为0。
   * @param {number} [ax=0] - 弹丸在x轴上的加速度，默认为0。设置此值将导致 acceleration 失效
   * @param {number} [ay=0] - 弹丸在y轴上的加速度，默认为0。设置此值将导致 acceleration 失效
   * @param {bool} [exploding=false] - 弹丸是否会爆炸。默认为false。
   * @param {number} [threat_level=1] - 弹丸发射造成的单位threat增加倍率，和damage有关
   * @param {number|null} [tracer=null] - 曳光效果，纯渲染。数字越大效果越好，默认 null
   */
  constructor({
    x,
    y,
    angle,
    source_weapon,
    source_unit,
    speed = 20,
    size = 1,
    lifetime = null,
    acceleration = 0,
    ax = 0,
    ay = 0,
    threat_level = 1,
    tracer_count = null,
    behaviors = null,
  } = {}) {
    super({ x, y, speed });

    // 记录初始坐标，用于伤害衰减计算
    this.startX = x;
    this.startY = y;

    //运动相关
    this.angle = angle;
    this.dx = Math.cos(this.angle) * this.speed;
    this.dy = Math.sin(this.angle) * this.speed;
    if (ax || ay) {
      this.ax = ax;
      this.ay = ay;
    } else {
      this.ax = Math.cos(this.angle) * acceleration;
      this.ay = Math.sin(this.angle) * acceleration;
    }

    //溯源
    this.source_unit = source_unit;
    this.source_weapon = source_weapon;

    //伤害相关
    this.damage = this.source_weapon.damage;
    this.color = this.source_unit.color;
    this.size = size;
    this.tracer_count = tracer_count;

    //存活相关
    // 如果没有手动指定 lifetime，则根据 source_weapon.Range_Max 和 speed 计算
    // 算法: 时间 = (距离 / 速度) * 帧时间
    if (lifetime !== null) {
      this.lifetime = lifetime;
    } else if (this.source_weapon && this.source_weapon.Range_Max) {
      this.lifetime = (this.source_weapon.Range_Max / this.speed) * (1000 / game.targetFPS);
    } else {
      this.lifetime = 10000;
    }

    this.DeadTimeStamp = game.time_now + this.lifetime;

    // 碰撞检测体积
    this.width = size * 2.1;
    this.height = size * 2.1;

    //子弹发射时增加单位威胁值
    this.threat_level = threat_level;
    this.source_unit.threat += this.damage * this.threat_level;

    // 行为组件 (Behaviors)
    this.behaviors = [];
    if (behaviors) {
      behaviors.forEach(b => this.addBehavior(b));
    }
  }

  addBehavior(behavior) {
    this.behaviors.push(behavior);
    if (behavior.onInit) behavior.onInit(this);
  }

  get dead() {
    return this._dead;
  }

  set dead(value) {
    if (!this.dead && value && !this._dying) {
      //dead只能发生一次
      this._dying = true;
      this._on_death();
    }
    this._dead = value;
  }

  /**
   * 对象第一次 dead=true 时触发的逻辑。
   *
   * @function _on_death
   * @private
   */
  _on_death() {
    this.behaviors.forEach(b => b.onDeath?.(this));
  }

  /**
   * 处理命中效果的函数
   * @param {Object} target - 被命中的目标对象
   */
  onHit_ApplyEffect(target) {
    this.behaviors.forEach(b => b.onHit?.(this, target));
  }

  /**
   * 检查对象是否位于地图边界内。
   *
   * @returns {boolean}  如果对象在地图边界内，则返回true；否则返回false，并标记对象为死亡状态。
   */
  #is_InMap() {
    if (
      this.x < -this.MapBorderMargin ||
      this.x > pos_range.width + this.MapBorderMargin ||
      this.y < -this.MapBorderMargin ||
      this.y > pos_range.height + this.MapBorderMargin
    ) {
      // 如果物体移动出了范围，标记为死亡状态
      this.dead = true;
      return false;
    }
    return true;
  }

  #move_UpdateVector() {
    if (this.ax || this.ay) {
      this.dx += this.ax;
      this.dy += this.ay;
    }
  }

  _move() {
    this.#move_UpdateVector();
    this.moveForward();
    this.behaviors.forEach(b => b.onUpdate?.(this));
    this.#is_InMap();
  }

  /**
   * 检查指定单位是否被此子弹伤害过
   *
   * @param {Object} unit - 要检查的单位对象
   * @returns {boolean} - 如果单位受损返回true，否则返回false
   */
  has_damaged(unit) {
    return this.damaged_units.has(unit);
  }

  /**
   * 当击中目标时的处理函数。
   *
   * 此函数负责在击中目标后执行一系列的后续动作，包括计算伤害、应用效果和更新子弹状态。
   * @param {Object} target - 被击中的目标对象。
   * @param {number} [damage] - 伤害值。如果不传，则自动计算当前衰减后的伤害。
   * @param {string} [damage_type] - 伤害类型，默认为 "kinetic"
   */
  onHit(target, damage, damage_type = "kinetic") {
    // 如果没有传入具体伤害值(子弹碰撞伤害)，则计算衰减后的伤害
    // 注意：这里 damage 如果是 undefined 则计算，如果是 0 则使用 0
    const is_auto_calc = damage === undefined;
    const final_damage = is_auto_calc ? this._calculate_attenuated_damage() : damage;

    // --- DEBUG LOG: 只有在自动计算衰减且开启DEBUG模式时输出 ---
    if (game.is_DebugMode() && is_auto_calc) {
      const dist = Math.hypot(this.x - this.startX, this.y - this.startY);
      const percent = ((final_damage / this.damage) * 100).toFixed(1);
      console.log(
        `[ATTENUATION] ${this.name}(${this.source_weapon.wname}) ` +
          `| Dist: ${dist.toFixed(0)} / ${this.source_weapon.range} ` +
          `| Dmg: ${this.damage} -> ${final_damage.toFixed(1)} (${percent}%)`
      );
    }
    this._onHit_damage(target, final_damage, damage_type);
    this.onHit_ApplyEffect(target); //空函数，自定义效果
    this._onHit_UpdateBullet(target);
  }

  /**
   * 处理子弹击中目标后的更新逻辑。
   * @param {Object} target - 被子弹击中的目标对象。
   */
  _onHit_UpdateBullet(target) {
    //将伤害的对象添加到子弹的 damaged_units Set中
    this.damaged_units.add(target);

    // 如果子弹还有穿透能力，则减少穿透能力的计数
    if (this.pierce > 0) {
      this.pierce--;
    } else {
      // 如果子弹不再具有穿透能力，标记子弹为死亡
      this.dead = true;
    }
  }

  /**
   * 计算当前距离下的伤害值 (含衰减逻辑)
   * 1.5倍 range 开始衰减，Range_Max (或3.5倍range) 处衰减至 25%
   *
   * @returns {number} 最终伤害值
   */
  _calculate_attenuated_damage() {
    // 0 衰减系数直接返回原伤害 (如 RPG、狙击枪可能不需要衰减)
    if (this.source_weapon.attenuation_factor === 0) {
      return this.damage;
    }

    const dist = point_distance(this.startX, this.startY, this.x, this.y);
    const range = this.source_weapon.range;
    const start_drop = range * DefaultAttenuationRangeMul;
    // 如果 Range_Max 未定义，兜底用 3.5 倍 range
    const end_drop = this.source_weapon.Range_Max || range * DefaultMaxRangeMul;

    // 尚未达到衰减距离
    if (dist <= start_drop) {
      return this.damage;
    }

    // 计算衰减比例 (0.0 ~ 1.0)
    // 限制 dist 不超过 end_drop，防止伤害变成负数
    const clamp_dist = Math.min(dist, end_drop);
    const progress = (clamp_dist - start_drop) / (end_drop - start_drop);

    // 最大衰减量：75% (即只剩 25%)
    const max_drop_percent = MaxBulletDamageDropPer;

    // 最终伤害比例 = 100% - (进度 * 最大衰减 * 衰减系数)
    const current_damage_percent =
      1 - progress * max_drop_percent * this.source_weapon.attenuation_factor;

    return this.damage * current_damage_percent;
  }

  /**
   * 对目标进行伤害处理的函数。
   *
   * 该函数首先尝试对目标造成伤害，然后检查目标是否被击毙。
   * 如果目标被击毙，将调用相应的处理函数。
   *
   * @param {Object} target - 受伤的目标对象，必须提供。
   * @param {number} damage - 伤害值，可选，默认为 this.damage，表示子弹伤害
   */
  _onHit_damage(target, damage, damage_type = "kinetic") {
    if (!target) {
      console.error("Invalid target provided to damage_target.");
      return;
    }
    //造成伤害
    deal_damage({
      damage,
      damage_type,
      target,
      source_bullet: this,
      source_unit: this.source_unit,
      source_weapon: this.source_weapon,
    });
    this._DamageInfo_Debug(target.x + getRandomSign() * 5, target.y - 8, damage);

    //判断击杀
    if (!target._update_hp()) {
      target_killed(target, this, this.source_unit, this.source_weapon);
    }
  }
  _DamageInfo_Debug(x, y, damage) {
    //debug模式显示伤害信息
    if (game.is_DebugMode() || this.damage_text_always) {
      CanvasTextPrompt.damage_prompt({
        x,
        y,
        color: this.color,
        damage,
        affix: this.damage_text_affix,
      });
    }
  }

  _update_lifetime() {
    if (game.time_now > this.DeadTimeStamp) {
      this.dead = true;
      if (this.EndLife_warning)
        console.warn("A bullet from:", this.source_weapon.wname, "has exceeded its lifetime");
    }
  }

  update() {
    this._move();
    this._update_lifetime();
  }

  #render_bullet(ctx) {
    // 策略分流
    if (this.size < 2) {
      // 极小物体：直接画方块，性能最强
      ctx.fillStyle = this.color;
      // 稍微画大一点点以补偿圆形面积，或者直接用 size
      const s = this.size * 2;
      ctx.fillRect(this.x - this.size, this.y - this.size, s, s);
    } else {
      // 较大物体（如火箭弹、榴弹）：使用缓存图片以保持圆形平滑
      const sprite = getCachedCircle(this.color, this.size);
      const drawWidth = sprite.width / spriteScale;
      const drawHeight = sprite.height / spriteScale;
      const offset = drawWidth / 2;

      // 坐标取整，减少子像素渲染开销
      ctx.drawImage(sprite, (this.x - offset) | 0, (this.y - offset) | 0, drawWidth, drawHeight);
    }
  }

  #render_tracer(ctx) {
    if (this.tracer_count && !this.first_frame) {
      const angle = this.angle + Math.PI;
      const max_length = this.speed;
      const tracer_count = this.tracer_count;

      for (let i = 1; i <= tracer_count; i++) {
        //可能的优化，tracer_count是在初始化时就建立的，所以 length , wid ,alpha 不用即时计算。一次性算好了放在变量里
        const length = max_length * (i / tracer_count);
        const lineWidth = this.size * 1.1 - i / tracer_count;
        let x = this.x + length * Math.cos(angle);
        let y = this.y + length * Math.sin(angle);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = lineWidth;

        const originalAlpha = ctx.globalAlpha;
        ctx.globalAlpha = 1.0 - (i / tracer_count) * 0.6;

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.globalAlpha = originalAlpha;
      }
    }
  }

  render(ctx) {
    this.#render_bullet(ctx);
    this.#render_tracer(ctx);
    this.first_frame = false;
  }
}

export class BulletFactory {
  static RifleBullet({ x, y, angle, source_unit, source_weapon }) {
    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed: 40,
      size: 1,
    });
    b.pierce = 1;
    b.name = "RifleBullet";
    return b;
  }

  static PistolBullet({ x, y, angle, source_unit, source_weapon }) {
    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed: 34,
      size: 0.9,
    });
    b.pierce = 0;
    b.name = "PistolBullet";
    return b;
  }

  static Buckshot({ x, y, angle, source_unit, source_weapon }) {
    let sp = 24 + Math.random() * 2 - 1;
    let range_limit = source_weapon.range * 3.5;
    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed: sp, //霰弹子弹速度随机变化
      size: 0.65,
      lifetime: (range_limit / 24) * (1000 / game.targetFPS),
    });
    b.pierce = 0;
    b.name = "Buckshot";
    b.EndLife_warning = false;
    return b;
  }

  static DragonBreath({ x, y, angle, source_unit, source_weapon }) {
    let sp = 20 + Math.random() * 4;
    let range_limit = source_weapon.range * 3.5;
    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed: sp, //DragonBreath速度随机变化
      size: 0.9,
      lifetime: (range_limit / 24) * (1000 / game.targetFPS),
      behaviors: [BurnOnHitBehavior()]
    });
    b.pierce = 0;
    b.name = "DragonBreath";
    b.EndLife_warning = false;
    return b;
  }

  static High_Caliber({ x, y, angle, source_unit, source_weapon }) {
    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed: 50,
      size: 2,
    });
    b.pierce = 2;
    b.name = "High_Caliber";
    return b;
  }

  static Grenade({ x, y, angle, source_unit, source_weapon, target_dist }) {
    // 榴弹逻辑修改：不再使用 PreFireRange 随机，而是精确计算目标距离的飞行时间
    // 稍微加一点点随机波动 (±30像素)，模拟抛射物的散布，看起来更自然
    const dist = target_dist + (Math.random() - 0.5) * 60;

    let speed = 15;
    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed,
      size: 4,
      // 动态计算 lifetime: (距离/速度) * 每帧时间(ms)
      lifetime: (dist / speed) * (1000 / game.targetFPS),
      behaviors: [ExplodeBehavior(75, 75, true)] // 伤害75, 范围75, 开启友伤
    });
    // 强制放大碰撞体积充当近炸引信
    b.width = 75 * 2.1;
    b.height = 75 * 2.1;
    b.pierce = 0;
    b.name = "Grenade";
    b.EndLife_warning = false;
    b.damage_text_always = false; //卡顿
    b.damage_text_affix = "💥";
    return b;
  }

  static Rocket({ x, y, angle, source_unit, source_weapon, target_dist }) {
    let speed = 3; // 初始速度 v0
    let acceleration = 0.5; // 加速度 a

    // 运动学公式求解时间 T (帧数)
    // S = v0*t + 0.5*a*t^2 => 0.5*a*t^2 + v0*t - S = 0
    // 解一元二次方程: t = (-b + sqrt(b^2 - 4ac)) / 2a
    // A = 0.5 * a, B = speed, C = -target_dist

    const A = 0.5 * acceleration;
    const B = speed;
    const C = -target_dist;

    const delta = B * B - 4 * A * C;
    let t_frames = 0;

    if (delta >= 0) {
      // 取正根
      t_frames = (-B + Math.sqrt(delta)) / (2 * A);
    } else {
      // 理论上不可能发生(距离为负才可能)，兜底逻辑
      t_frames = target_dist / speed;
    }

    const lifetime = t_frames * (1000 / game.targetFPS);

    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed,
      size: 5,
      acceleration,
      lifetime: lifetime,
      behaviors: [ExplodeBehavior(300, 150, true)] // 伤害300, 范围150, 开启友伤
    });
    // 强制放大碰撞体积充当近炸引信
    b.width = 150 * 2.1;
    b.height = 150 * 2.1;
    b.pierce = 0;
    b.name = "Rocket";
    b.EndLife_warning = false;
    b.damage_text_always = false;
    b.damage_text_affix = "💥";
    return b;
  }

  static MagneticAmmo({ x, y, angle, source_unit, source_weapon }) {
    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed: 120,
      size: 0.9,
      tracer_count: 4,
      // acceleration: -0.3,
    });
    b.pierce = 0;
    b.name = "MagneticAmmo";
    return b;
  }

  static SubsonicBullet({ x, y, angle, source_unit, source_weapon }) {
    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed: 25,
      size: 0.95,
      threat_level: 0.15,
      behaviors: [PoisonOnHitBehavior()]
    });
    b.pierce = 0;
    b.name = "SubsonicBullet";
    return b;
  }

  static MonsterSpit({ x, y, angle, source_unit, source_weapon }) {
    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed: 15,
      size: 10,
      threat_level: 1.0,
      behaviors: [PoisonOnHitBehavior()]
    });
    b.pierce = 0;
    b.color = "rgb(120, 200, 50)"; // 毒液颜色
    b.name = "MonsterSpit";
    return b;
  }
}
