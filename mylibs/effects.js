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
    return this.lifetime > 0
      ? (this.end_time - game.time_now) / this.lifetime
      : 1.0;
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
    damage_per_frame = null, //每帧伤害
    damagePercent_per_frame = null, //每帧hp%伤害
    damage_per_second = null, //每秒伤害
    damagePercent_per_second = null, //每秒hp%伤害
    source_weapon = null,
    name = "Default DOT",
    color = "red",
    render_affix = "",
  } = {}) {
    super({ lifetime, unit });
    //伤害相关
    this.damage_per_frame = damage_per_frame;
    this.damage_per_second = damage_per_second;
    this.damagePercent_per_frame = damagePercent_per_frame;
    this.damagePercent_per_second = damagePercent_per_second;

    this._update_damage();

    //伤害源
    this.source_weapon = source_weapon;

    //渲染相关
    this.name = name;
    this.color = color;
    this.render_affix = render_affix;
  }

  _update_damage() {
    this.total_dps =
      this.damagePercent_per_second * this.unit.hp + this.damage_per_second;
    this.total_dpf =
      this.damagePercent_per_frame * this.unit.hp + this.damage_per_frame;
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
    if (this.total_dpf) {
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
    if (this.total_dps) {
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

  static burning(unit, source_weapon) {
    return new this({
      unit,
      source_weapon,
      lifetime: 3000,
      damage_per_second: 10,
      damagePercent_per_second: 0.01,
      name: "Burning",
      color: "red",
      render_affix: "🔥",
    });
  }
}
