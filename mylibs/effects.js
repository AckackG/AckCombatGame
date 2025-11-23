import { deal_damage } from "./logic.js";
import { CanvasTextPrompt } from "./CanvasTextPrompt.js";
import { game, world } from "./game.js";

class Effect {
  dead = false;
  constructor({ lifetime = -1, unit = null } = {}) {
    this.unit = unit;

    this.lifetime = lifetime; // 如果<=0，则表示永远存在
    this.end_time = game.time_now + lifetime;
  }

  /**
   * 计算当前进度的百分比。
   *
   * 它将根据剩余时间与生命周期的比值来计算进度；
   * 如果永远持续，此时返回1.0
   *
   * @returns {number} 进度的百分比，范围在0到1之间，1表示100%完成。
   */
  progress_percent() {
    return this.lifetime > 0 ? (this.end_time - game.time_now) / this.lifetime : 1.0;
  }

  /**
   * 更新effect 的生命状态。
   *
   * 如果effect 的生命周期已结束，则将其标记为dead。
   *
   * 如果effect 永远持续，那么不会因为时间原因而标记为 dead。但仍可能因其他原因死亡。
   *
   * @private
   */
  _update_lifetime() {
    if (this.lifetime > 0 && game.time_now > this.end_time) {
      this.dead = true;
    }
  }

  _update_slow() {}
  _update() {}

  _update_custom() {
    //自定义的效果函数，一般用来设置 unit 属性，与伤害无关
  }

  _render() {}
  _render_slow() {}

  update() {
    this._update_lifetime();

    this._update();
    this._update_custom();
    this._render();
    if (game.is_full_second()) {
      this._update_slow();
      this._render_slow();
    }
  }
}

export class DOT extends Effect {
  constructor({
    lifetime,
    unit,
    damage_per_frame = null,
    damagePercent_per_frame = null,
    damage_per_second = null,
    damagePercent_per_second = null,
    source_weapon = null,
    name = "Default DOT",
    color = "red",
    render_affix = "",
  } = {}) {
    super({ lifetime, unit });

    this.damage_per_frame = damage_per_frame || 0;
    this.damage_per_second = damage_per_second || 0;
    this.damagePercent_per_frame = damagePercent_per_frame || 0;
    this.damagePercent_per_second = damagePercent_per_second || 0;

    this._update_damage();

    this.source_weapon = source_weapon;
    this.name = name; // 使用name作为DOT类型标识符
    this.color = color;
    this.render_affix = render_affix;

    // 用于控制提示显示
    this.last_prompt_time = 0;
    this.prompt_cooldown = 800; // 提示冷却时间(ms)
  }

  _update_damage() {
    this.total_dps = this.damagePercent_per_second * this.unit.hp + this.damage_per_second;
    this.total_dpf = this.damagePercent_per_frame * this.unit.hp + this.damage_per_frame;
  }

  /**
   * 计算DOT的固定伤害潜力（剩余生命周期内能造成的总固定伤害，不包括百分比伤害）
   */
  _calculate_fixed_damage_potential() {
    const remaining_time = (this.end_time - game.time_now) / 1000; // 转换为秒
    const remaining_frames = (this.end_time - game.time_now) / (1000 / game.targetFPS);

    // 只计算固定伤害部分，百分比伤害不参与叠加计算
    const damage_from_dps = this.damage_per_second * remaining_time;
    const damage_from_dpf = this.damage_per_frame * remaining_frames;

    return damage_from_dps + damage_from_dpf;
  }

  /**
   * 合并另一个相同类型的DOT效果
   * @param {DOT} otherDOT - 要合并的DOT效果
   */
  merge(otherDOT) {
    // 1. 计算现有DOT的剩余固定伤害潜力
    const existing_fixed_potential = this._calculate_fixed_damage_potential();

    // 2. 计算新DOT的总固定伤害潜力
    const new_lifetime_seconds = otherDOT.lifetime / 1000;
    const new_lifetime_frames = otherDOT.lifetime / (1000 / game.targetFPS);
    const new_fixed_potential =
      otherDOT.damage_per_second * new_lifetime_seconds +
      otherDOT.damage_per_frame * new_lifetime_frames;

    // 3. 计算总固定伤害潜力
    const total_fixed_potential = existing_fixed_potential + new_fixed_potential;

    // 4. 百分比伤害保持不变（不叠加，使用新DOT的值）
    this.damagePercent_per_second = otherDOT.damagePercent_per_second;
    this.damagePercent_per_frame = otherDOT.damagePercent_per_frame;

    // 5. 重置生命周期为新DOT的持续时间
    this.lifetime = otherDOT.lifetime;
    this.end_time = game.time_now + otherDOT.lifetime;

    // 6. 根据新的持续时间重新分配固定伤害
    const new_duration_seconds = this.lifetime / 1000;
    const new_duration_frames = this.lifetime / (1000 / game.targetFPS);

    // 将总固定伤害平均分配到新的持续时间内
    if (new_duration_seconds > 0) {
      // 判断原本伤害主要分配在哪个部分
      const has_dps = this.damage_per_second > 0;
      const has_dpf = this.damage_per_frame > 0;

      if (has_dps && !has_dpf) {
        // 只有每秒伤害
        this.damage_per_second = total_fixed_potential / new_duration_seconds;
      } else if (!has_dps && has_dpf) {
        // 只有每帧伤害
        this.damage_per_frame = total_fixed_potential / new_duration_frames;
      } else if (has_dps && has_dpf) {
        // 两者都有，按原比例分配
        const total_original =
          this.damage_per_second * new_duration_seconds +
          this.damage_per_frame * new_duration_frames;
        if (total_original > 0) {
          const dps_ratio = (this.damage_per_second * new_duration_seconds) / total_original;
          this.damage_per_second = (total_fixed_potential * dps_ratio) / new_duration_seconds;
          this.damage_per_frame = (total_fixed_potential * (1 - dps_ratio)) / new_duration_frames;
        }
      } else {
        // 原本没有固定伤害，默认分配给每秒伤害
        this.damage_per_second = total_fixed_potential / new_duration_seconds;
      }
    }

    // 7. 重新计算当前帧的伤害
    this._update_damage();

    console.log(
      `DOT merged: ${this.name} | Fixed potential: ${total_fixed_potential.toFixed(
        1
      )} | New DPS: ${this.total_dps.toFixed(1)} (${this.damage_per_second.toFixed(1)} + ${(
        this.damagePercent_per_second * 100
      ).toFixed(1)}%)`
    );
  }

  _update_slow() {
    if (this.total_dps) {
      deal_damage({
        damage: this.total_dps,
        target: this.unit,
        source_weapon: this.source_weapon,
      });
      this._update_damage();
    }
  }

  _update() {
    if (this.total_dpf) {
      deal_damage({
        damage: this.total_dpf,
        target: this.unit,
        source_weapon: this.source_weapon,
      });
      this._update_damage();
    }
  }

  _render() {
    // 每帧伤害的提示
    if (this.total_dpf && this._should_show_prompt()) {
      CanvasTextPrompt.damage_prompt({
        x: this.unit.x,
        y: this.unit.y,
        color: this.color,
        damage: this.total_dpf,
        affix: this.render_affix,
        lifetime: 150,
        vy: -3,
      });
    }
  }

  _render_slow() {
    // 每秒伤害的提示
    if (this.total_dps && this._should_show_prompt()) {
      CanvasTextPrompt.damage_prompt({
        x: this.unit.x,
        y: this.unit.y,
        color: this.color,
        damage: this.total_dps,
        affix: this.render_affix,
        lifetime: 800,
      });
    }
  }

  /**
   * 判断是否应该显示伤害提示（防止刷屏）
   */
  _should_show_prompt() {
    const now = game.time_now;
    if (now - this.last_prompt_time >= this.prompt_cooldown) {
      this.last_prompt_time = now;
      return true;
    }
    return false;
  }

  // 静态工厂方法
  static burning(unit, source_weapon) {
    return new this({
      unit,
      source_weapon,
      lifetime: 4000,
      damage_per_second: 7,
      damagePercent_per_second: 0.01,
      name: "Burning", // 使用name作为标识符
      color: "red",
      render_affix: "🔥",
    });
  }

  static poisoning(unit, source_weapon) {
    return new this({
      unit,
      source_weapon,
      lifetime: 10000,
      damage_per_second: 2,
      name: "Toxic", // 使用name作为标识符
      color: "green",
      render_affix: "☠️",
    });
  }
}
