import { getRandomSign, unit_distance } from "../mylibs/utils.js";
import { CanvasTextPrompt, CanvasCircle } from "../mylibs/CanvasTextPrompt.js";
import { deal_damage, target_killed } from "../mylibs/logic.js";
import { DOT } from "../mylibs/effects.js";
import { BulletBasic, EntityBasic } from "./obj_basic.js";
import { game, world } from "../mylibs/game.js";

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
  EndLife_warning = true;
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
   * @param {number} [lifetime=10000] - 弹丸的生命周期，默认为10000毫秒。
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
    lifetime = 10000,
    acceleration = 0,
    ax = 0,
    ay = 0,
    exploding = false,
    threat_level = 1,
    tracer_count = null,
  } = {}) {
    super({ x, y, speed });
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
    this.lifetime = lifetime; //10s
    this.DeadTimeStamp = game.time_now + lifetime;

    //爆炸相关
    this.exploding = exploding;
    this.exploding_ff = true; //友军伤害
    this.exploding_radius = 20; //爆炸半径
    this.exploding_damage = 100; //爆炸伤害
    this.exploding_minimum_percent = 0.5; //爆炸边缘伤害百分比

    // 碰撞检测相关
    if (this.exploding) {
      this.width = this.exploding_radius * 2.1;
      this.height = this.exploding_radius * 2.1;
    } else {
      this.width = size * 2.1;
      this.height = size * 2.1;
    }

    //子弹发射时增加单位威胁值
    this.threat_level = threat_level;
    this.source_unit.threat += this.damage * this.threat_level;
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
   * 计算爆炸伤害的最终值。
   * 根据爆炸物与目标的距离，计算出伤害百分比，然后乘以爆炸伤害的基数，得出最终伤害值。
   *
   * @param {number} distance 爆炸物与目标之间的距离。
   * @returns {number} 返回计算出的最终爆炸伤害值。
   */
  #explosion_dmg_final(distance) {
    const damage_percent =
      this.exploding_minimum_percent +
      (1 - this.exploding_minimum_percent) * (1 - distance / this.exploding_radius);
    return this.exploding_damage * damage_percent;
  }

  _explode() {
    //选取单位造成伤害
    let units = world.UnitsQT.retrieve(this);
    units.forEach((unit) => {
      //(友伤关闭的敌军单位 || 友伤开启的全部单位)
      if ((unit.color !== this.color && !this.exploding_ff) || this.exploding_ff) {
        let dis = unit_distance(unit, this) - unit.size;
        if (dis <= this.exploding_radius && !unit.dead) {
          let dmg = this.#explosion_dmg_final(dis);
          this.onHit(unit, dmg);
          //爆炸额外增加单位威胁值
          this.source_unit.threat += dmg * this.threat_level;
        }
      }
    });

    //添加爆炸特效
    CanvasCircle.explosion(this.x, this.y, this.exploding_radius, this.color, 2000);
  }

  /**
   * 对象第一次 dead=true 时触发的逻辑。
   *
   * @function _ondeath
   * @private
   */
  _on_death() {
    if (this.exploding) {
      this._explode();
    }
  }

  /**
   * 处理命中效果的函数
   * @param {Object} target - 被命中的目标对象
   */
  onHit_ApplyEffect(target) {}

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
   */
  onHit(target, damage = this.damage) {
    this._onHit_damage(target, damage);
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
   * 对目标进行伤害处理的函数。
   *
   * 该函数首先尝试对目标造成伤害，然后检查目标是否被击毙。
   * 如果目标被击毙，将调用相应的处理函数。
   *
   * @param {Object} target - 受伤的目标对象，必须提供。
   * @param {number} damage - 伤害值，可选，默认为 this.damage，表示子弹伤害
   */
  _onHit_damage(target, damage) {
    if (!target) {
      console.error("Invalid target provided to damage_target.");
      return;
    }
    //造成伤害
    deal_damage({
      damage,
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
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
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
    let range_limit = source_weapon.PreFireRange - 50; //霰弹枪只能射800距离
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
    let range_limit = source_weapon.PreFireRange - 50; //DragonBreath只能射650距离
    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed: sp, //DragonBreath速度随机变化
      size: 0.9,
      lifetime: (range_limit / 24) * (1000 / game.targetFPS),
    });
    b.pierce = 0;
    b.name = "DragonBreath";
    b.EndLife_warning = false;
    b.onHit_ApplyEffect = function (target) {
      CanvasCircle.explosion(this.x, this.y, 6, "red");
      target.add_effect(DOT.burning(target, this.source_weapon));
    };
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

  static Grenade({ x, y, angle, source_unit, source_weapon }) {
    let range_limit = source_weapon.PreFireRange + Math.random() * 100 - 100; //Grenade 650-750距离后自然爆炸
    let speed = 15;
    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed,
      size: 4,
      exploding: true,
      lifetime: (range_limit / speed) * (1000 / game.targetFPS),
    });
    b.pierce = 0;
    b.name = "Grenade";
    b.EndLife_warning = false;
    b.damage_text_always = true;
    b.damage_text_affix = "💥";

    b.exploding_damage = 75;
    b.exploding_ff = true;
    b.exploding_minimum_percent = 0.3;
    b.exploding_radius = 75;
    return b;
  }

  static Rocket({ x, y, angle, source_unit, source_weapon }) {
    let speed = 3;
    let b = new Bullet({
      x,
      y,
      angle,
      source_unit,
      source_weapon,
      speed,
      size: 5,
      exploding: true,
      acceleration: 0.5,
    });
    b.pierce = 0;
    b.name = "Rocket";
    b.EndLife_warning = false;
    b.damage_text_always = true;
    b.damage_text_affix = "💥";

    b.exploding_damage = 300;
    b.exploding_ff = true;
    b.exploding_minimum_percent = 0.4;
    b.exploding_radius = 150;
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
    });
    b.pierce = 0;
    b.name = "SubsonicBullet";
    return b;
  }
}
