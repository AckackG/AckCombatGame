import { BulletFactory } from "../objects/projectiles.js";
import { unit_distance, getRandomSign } from "./utils.js";
import { CanvasTextPrompt } from "./CanvasTextPrompt.js";
import { deal_damage, target_killed } from "./logic.js";
import { game, world } from "./game.js";
import { debug_gun, DefaultMaxRangeMul, DefaultPrefireRangeMul } from "./config.js";
import soundManager from "./sound_manager.js";

class GunBasic {
  //统计相关
  stat_damage_total = 0; //实际造成的伤害
  stat_bullets_hit = 0; //命中的子弹树
  stat_kills = 0;

  stat_damage_estimate = 0; //理论的总伤害。单发伤害可能会变动，所以实时累计而不是算出来
  stat_bullets_fired = 0; //发射的子弹数，包括 burst

  //gametick相关
  stat_create_time = game.time_now;
  frame_lastTime = 0;

  //装弹相关
  reloading = false;
  reloading_endTime = null;
  reloading_boost = false;

  /**
   * 枪械类的构造函数，用于初始化枪械的各项属性。
   *
   * @param {string} wname 枪械的名称，默认为"GunBasic"。
   * @param {number} damage 枪械的单发伤害，默认为15。
   * @param {number} burst 枪械的连发数，默认为1，表示单发。
   * @param {number} rpm 枪械的理论射速（每分钟射弹数），默认为600。
   * @param {number} magsize 枪械的弹匣容量，默认为30。
   * @param {number} recoil 枪械的后坐力，默认为5。
   * @param {number} range 枪械的有效射程，默认为600。
   * @param {string} projectile 枪械使用的弹丸类型，默认为Bullet类。
   * @param {number|null} ReloadTime 枪械的换弹时间（毫秒），如果为null，则根据其他属性计算得出。
   * @param {number|null} PreFireRange 默认超出range也开火，否则在这个距离内再开火
   * @param {number|null} Range_Max 子弹最大飞行距离，用于计算lifetime
   * @param {number} attenuation_factor 衰减指数，0为不衰减，1为线性衰减至25%
   */
  constructor({
    wname = "GunBasic",
    damage = 20,
    burst = 1,
    rpm = 600,
    magsize = 30,
    recoil = 5,
    range = 600,
    projectile = "RifleBullet",
    ReloadTime = null, //ms, 如果不手动指定，则自动计算出来
    PreFireRange = null,
    Range_Max = null,
    soundType = null,
    attenuation_factor = 1, // 默认为 1，开启衰减
  } = {}) {
    this.damage = damage; //子弹伤害
    this.burst = burst; //每轮射击几发（霰弹）
    this.rpm = rpm; //round per minute in 60FPS
    this.magsize = magsize;
    this.recoil = recoil; //误差角度 in degree
    this.projectile = projectile; //子弹类型 (string)
    this.soundType = soundType || soundManager.getRandomGunSound();

    this.range = range; //射程是无限的，但单位会在这个距离停下
    // 单位 距离目标 PreFireRange 或者 2 倍 range 即可开火，单位AI会尝试走到1倍 range 处。
    this.PreFireRange = PreFireRange !== null ? PreFireRange : this.range * DefaultPrefireRangeMul;
    // Range_Max 为子弹消失距离，默认为 3.5倍 range
    this.Range_Max = Range_Max !== null ? Range_Max : this.range * DefaultMaxRangeMul;

    this.wname = wname;
    this.attenuation_factor = attenuation_factor;

    this.rate = (1000 / (rpm / 60)) * (game.targetFPS / 60); //每次发射间隔 ms
    this.mag = magsize;

    // 换弹时间如果没有手动指定，则会根据伤害、弹夹大小、射速、换弹时间计算
    this.ReloadTime =
      ReloadTime !== null ? ReloadTime : Math.min(this.dps_burst * 10 + this.damage * 90, 15_000);
  }

  get dps_burst() {
    return this.burst * this.damage * (this.rpm / 60);
  }

  get mag_damage() {
    return this.magsize * this.burst * this.damage;
  }

  get dps_average() {
    return this.mag_damage / ((this.magsize / this.rpm) * 60 + this.ReloadTime / 1000);
  }

  /**
   * 获取当前武器统计信息。
   *
   * @returns {string} 返回一个格式化的字符串，包含武器或设备的名称和相关状态信息。
   */
  get_mag_info() {
    //武器伤害效率 = 实际总伤害 / 理论总伤害
    let eff = ((this.stat_damage_total / this.stat_damage_estimate) * 100).toFixed(1);

    if (this.reloading) {
      let reload_time = (this.reloading_endTime - game.time_now) / 1000;
      let msg = reload_time < 0 ? `${this.magsize}/${this.magsize}` : `${reload_time.toFixed(1)}s`;
      return `${this.wname} | ${msg} | ${eff}% `;
    } else {
      return `${this.wname} | ${this.mag}/${this.magsize} | ${eff}%`;
    }
  }

  /**
   * 计算武器的理论得分。
   *
   * 此函数通过综合考虑武器的弹夹大小、连发次数、单发伤害、射速和换弹时间来计算武器的综合性能得分。
   * 它主要计算了弹夹伤害、平均每秒伤害（DPS）以及换弹时间等关键指标，为评估武器的效能提供量化数据。
   *
   * @returns {Object} 返回一个包含武器名称、弹夹伤害、爆发DPS、平均DPS和换弹时间的对象。
   */
  get_estimated_score() {
    return {
      wname: this.wname,
      mag_damage: Math.round(this.mag_damage),
      dps_burst: Math.round(this.dps_burst),
      dps_average: Math.round(this.dps_average),
      reloadSeconds: Math.round(this.ReloadTime / 1000),
    };
  }

  // --- 手动换弹 ---
  manual_reload(x, y) {
    // 1. 如果弹匣已经是满的，不需要换弹
    if (this.mag >= this.magsize) return;

    // 2. 如果已经在换弹中，不要打断（否则会重置时间）
    if (this.reloading) return;

    // 3. 触发换弹逻辑
    this.reloading = true;

    // 可以选择是否给予战术换弹奖励（例如比空仓换弹快），这里暂时保持原速
    let ReloadTime = this.reloading_boost ? this.ReloadTime / 2 : this.ReloadTime;
    this.reloading_endTime = game.time_now + ReloadTime;

    world.CanvasPrompts.push(
      new CanvasTextPrompt({
        text: "🔃",
        x,
        y,
        size: 16,
        vy: -1,
        color: "yellow",
        lifetime: 2300,
      })
    );
  }

  /**
   * 减半换弹时间
   */
  boost_reload(x, y) {
    this.reloading_boost = true;
    world.CanvasPrompts.push(
      new CanvasTextPrompt({
        text: "⚡",
        x,
        y,
        size: 15,
        vy: -1,
        color: "yellow",
        lifetime: 1500,
      })
    );
  }

  /**
   * 执行攻击动作。
   *
   * 此函数模拟了一次攻击过程，包括装弹、射击等逻辑。它首先检查武器是否正在装弹，如果是，则判断装弹是否已完成；
   * 如果装弹未完成，则返回0，表示此次攻击无法进行。如果武器弹药为空，则开始装弹，并设定装弹结束时间。
   * 如果弹药充足，并且自上一次射击以来的时间超过了射击间隔，则执行射击逻辑，包括计算射击位置、减少弹药、生成子弹等。
   *
   * @param attacker 攻击者对象，包含攻击者的坐标等信息。
   * @param target 目标对象，包含目标的坐标等信息。
   * @returns {number} 返回生成的子弹数量，如果未射击则返回0。
   */
  attack(attacker, target) {
    //装弹阶段
    if (this.reloading) {
      if (game.time_now > this.reloading_endTime) {
        this.reloading = false;
        this.mag = this.magsize;
        this.reloading_boost = false;
      } else {
        return;
      }
    }

    //判断弹匣，进入装弹阶段
    if (this.mag <= 0) {
      this.reloading = true;
      let reloadtime = this.reloading_boost ? this.ReloadTime / 2 : this.ReloadTime;
      this.reloading_endTime = game.time_now + reloadtime;
      return;
    }

    //判断距离阶段，超出距离不开火
    if (unit_distance(attacker, target) > this.PreFireRange) {
      return;
    }

    //射击阶段，考虑game.targetFPS,需要跳过一些frame
    let nowTime = game.time_now;
    let deltaTime = nowTime - this.frame_lastTime;

    if (deltaTime > this.rate) {
      let x = attacker.x;
      let y = attacker.y;
      let target_x = target.x;
      let target_y = target.y;
      this.mag--;
      this.frame_lastTime = nowTime - (deltaTime % this.rate);
      this._generate_bullets(x, y, target_x, target_y, attacker);
    }
    return;
  }

  /**
   * 根据指定参数生成子弹。
   * @param {number} x - 子弹发射点的x坐标。
   * @param {number} y - 子弹发射点的y坐标。
   * @param {number} target_x - 子弹的目标x坐标。
   * @param {number} target_y - 子弹的目标y坐标。
   * @param {Object} source_unit - 发射子弹的单位对象。
   * @returns {number} estimated_damage - 预估的总伤害值。
   */
  _generate_bullets(x, y, target_x, target_y, source_unit) {
    // 计算目标距离，用于传递给工厂计算空爆时间
    const target_dist = Math.hypot(target_x - x, target_y - y);

    // 循环爆发次数，每次生成一颗子弹
    for (let i = 0; i < this.burst; i++) {
      // 计算目标位置与发射位置的水平和垂直距离
      let dx = target_x - x;
      let dy = target_y - y;

      // 计算子弹的初始角度，基于目标方向
      let angle = Math.atan2(dy, dx);
      // 添加随机后坐力，使子弹有一定散射
      //recoil 从 degree 转成 rad
      angle += (Math.random() - 0.5) * this.recoil * (Math.PI / 180);

      //统计数据
      this.stat_bullets_fired += 1;
      this.stat_damage_estimate += this.damage;
      game.weapon_stats.weapon_fire(this, this.damage);

      // 创建新子弹实例，并指定其初始位置、角度和所属对象

      world.bullets.push(
        BulletFactory[this.projectile]({
          x,
          y,
          angle,
          source_unit,
          source_weapon: this,
          target_dist, // 传入目标距离
        })
      );
    }
    soundManager.play(this.soundType, { position: { x, y } });
  }
}

class InstaWeaponBasic extends GunBasic {
  damage_info = true; //不用DEBUG MODE，也会显示伤害
  damage_affix = "";
  /**
   * 瞬间击中目标的武器，不会偏移。没有 recoil 和 projectile
   *
   * 如果要模拟光束武器的偏移，用一个高速普通武器
   *
   * @param {string} config.wname 武器的名称，默认为"InstaWeapon"。
   * @param {number} config.damage 武器的单发伤害，默认为15。
   * @param {number} config.burst 武器的连发模式，默认为1（单发）。
   * @param {number} config.rpm 武器的每分钟射速，默认为600。
   * @param {number} config.magsize 武器的弹夹容量，默认为30。
   * @param {number} config.range 武器的有效射程，和普通武器不同，范围之外不会攻击
   * @param {number|null} config.ReloadTime 武器的装填时间，默认为null，表示需要计算得出。
   */
  constructor({
    wname = "InstaWeapon",
    damage = 15,
    burst = 1,
    rpm = 600,
    magsize = 30,
    range = 600, //和普通武器不同，范围之外不会攻击
    ReloadTime = null, //ms, 如果不手动指定，则自动计算出来
    PreFireRange = null,
    // projectile = Bullet, //没有投射物，瞬间击中，不会偏移。
    // recoil = 5, //不会偏移
  } = {}) {
    super({
      wname,
      damage,
      burst,
      rpm,
      magsize,
      range,
      ReloadTime,
      // 即时命中/近战武器，强制设置 PreFireRange 为 range + 1，避免在 2倍 range 处空挥
      PreFireRange: PreFireRange !== null ? PreFireRange : range + 1,
      // InstaWeapon 不需要 Range_Max (无子弹实体)
    });
  }

  _damage_unit(attacker, target) {
    // Burst次数，每次生成一颗子弹
    for (let i = 0; i < this.burst; i++) {
      //统计数据
      this.stat_bullets_fired += 1;
      this.stat_damage_estimate += this.damage;
      attacker.threat += this.damage;
      game.weapon_stats.weapon_fire(this, this.damage);

      //造成伤害
      if (!target.dead) {
        deal_damage({
          damage: this.damage,
          target,
          source_unit: attacker,
          source_weapon: this,
        });

        //伤害信息
        if (this.damage_info || game.is_DebugMode()) {
          CanvasTextPrompt.damage_prompt({
            x: target.x,
            y: target.y,
            color: attacker.color,
            damage: this.damage,
            damage_ref: 500,
            affix: this.damage_affix,
          });
        }

        // 成功击杀
        if (!target._update_hp()) {
          target_killed(target, null, attacker, this);
        }
      }
    }
  }

  /**
   * 执行立即攻击动作。
   *
   * 此函数模拟了一次攻击过程，包括装弹、射击等逻辑。它首先检查武器是否正在装弹，如果是，则判断装弹是否已完成；
   * 如果装弹未完成，则返回0，表示此次攻击无法进行。如果武器弹药为空，则开始装弹，并设定装弹结束时间。
   * 如果弹药充足，并且自上一次射击以来的时间超过了射击间隔，则执行射击逻辑，包括计算射击位置、减少弹药等。
   *
   * @param attacker 攻击者对象，包含攻击者的坐标等信息。
   * @param target 目标对象，包含目标的坐标等信息。
   * @returns {number} 返回生成的子弹数量，如果未射击则返回0。
   */
  attack(attacker, target) {
    //装弹阶段
    if (this.reloading) {
      if (game.time_now > this.reloading_endTime) {
        this.reloading = false;
        this.mag = this.magsize;
      } else {
        return;
      }
    }

    //判断弹匣
    if (this.mag <= 0) {
      this.reloading = true;
      this.reloading_endTime = game.time_now + this.ReloadTime;
      return;
    }

    //判断射程，超射程不攻击
    if (unit_distance(attacker, target) > this.range + 1) {
      return;
    }

    //射击阶段，考虑game.targetFPS,需要跳过一些frame
    let nowTime = game.time_now;
    let deltaTime = nowTime - this.frame_lastTime;

    if (deltaTime > this.rate) {
      this.mag--;
      this.frame_lastTime = nowTime - (deltaTime % this.rate);
      this._damage_unit(attacker, target);
    }
    return;
  }
}

export class MeleeWeapon extends InstaWeaponBasic {
  damage_affix = " 🔪";
  constructor({
    wname = "Melee",
    damage = 50,
    burst = 1,
    rpm = 100,
    magsize = 100,
    range = 35,
    ReloadTime = 100, //ms, 如果不手动指定，则自动计算得出
    monster_mul = 1,
    // projectile = Bullet, //没有投射物，瞬间击中，不会偏移。
    // recoil = 5, //不会偏移
  } = {}) {
    super({
      wname,
      damage: damage * monster_mul,
      burst,
      rpm,
      magsize: parseInt(magsize * monster_mul),
      range: range * monster_mul,
      ReloadTime,
    });
  }

  get_mag_info() {
    if (this.reloading) {
      let reload_time = (this.reloading_endTime - game.time_now) / 1000;
      let msg =
        reload_time < 0 ? `| ${this.magsize}/${this.magsize}` : `| ${reload_time.toFixed(1)}s`;
      return `${this.wname} |  ${msg}`;
    } else {
      return `${this.wname} |  ${this.mag}/${this.magsize}`;
    }
  }
}

export class GunFactory extends GunBasic {
  /**
   * 随机生成一把枪械实例，有几率生成特殊武器 (默认 10%)
   *
   * @returns {Gun} 返回一个随机枪械的实例。
   */
  static random_gun(special_chance = 0.1) {
    const gun_names =
      Math.random() < special_chance ? game.Guns_SpecialNames : game.Guns_NormalNames;

    const random_name = gun_names[Math.floor(Math.random() * gun_names.length)];
    return new this(game.Guns_Data[random_name]);
  }
  /**
   * 根据枪支名称静态获取枪支实例。
   *
   * @param {string} gun_name - 枪支的名称。这个名称必须与游戏数据中的枪支名称对应。
   * @returns {Gun} 返回一个新的枪支实例。这个实例是通过传递的游戏数据来初始化的。
   */
  static get_gun(gun_name) {
    if (!game.Guns_Names.includes(gun_name)) {
      throw new Error(`${gun_name} is not a valid gun name`);
    }
    return new this(game.Guns_Data[gun_name]);
  }

  static debug_gun() {
    //debgun_gun 在 config 里
    return new this(game.Guns_Data[debug_gun]);
  }
}

//IIFE ,展示武器数据 TABLE
(() => {
  const results = game.Guns_Names.map((wname) => {
    return GunFactory.get_gun(wname).get_estimated_score();
  });
  console.table(results);
})();
