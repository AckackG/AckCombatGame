import { game, world } from "./game.js";
import { getRandomSign } from "./utils.js";

export class CanvasTextPrompt {
  dead = false;
  y_offset = -11;

  /**
   * 创建一个文本粒子对象。
   *
   * 文本粒子用于在屏幕上显示带有特定文本、运动特性和寿命的视觉元素。
   * 它们可以被用于各种视觉效果，如消息提示、爆炸效果等。
   *
   * @param {Object} config 初始化配置对象，包含以下属性：
   * @param text {string}：要显示的文本内容。
   * @param unit {Object}（可选）：与粒子关联的单位对象，如果提供，粒子将定位到该单位的位置。
   * @param x {number}（可选）：粒子的初始x坐标。
   * @param y {number}（可选）：粒子的初始y坐标。
   * @param size {number}（可选，默认为10）：粒子的字体大小。
   * @param vx {number}（可选，默认为0.05）：粒子在x轴上的速度。
   * @param vy {number}（可选，默认为-0.4）：粒子在y轴上的速度。
   * @param color {string}（可选，默认为"red"）：粒子的颜色。
   * @param fade {boolean}（可选，默认为true）：是否使粒子逐渐消失。
   * @param lifetime {number}（可选，默认为2000）：粒子的寿命，以毫秒为单位。
   * @param alpha_final {number}（可选，默认为0.3）：粒子消失时的透明度。
   */
  constructor({
    text,
    unit, //如果设置了unit，则绑定在unit上
    x, //固定位置
    y, //固定位置
    size = 10,
    vx = 0.05, //自然右飘
    vy = -0.4, //自然上升
    color = "red",
    fade = true,
    lifetime = 2000,
    alpha_init = 1.0,
    alpha_final = 0.3, //最终透明度会变为30%
  } = {}) {
    this.text = text;
    if (unit) {
      this.x = unit.x;
      this.y = unit.y + this.y_offset;
      this.unit = unit;
    } else {
      this.x = x;
      this.y = y;
    }
    this.vx = vx;
    this.vy = vy;
    this.size = size + "px sans-serif";
    this.color = color;

    //渐变相关
    this.fade = fade;
    this.alpha = alpha_init;
    this.valpha =
      -(alpha_init - alpha_final) / ((lifetime / 1000) * game.targetFPS); //每帧alpha 变化速度

    this.end_time = game.time_now + lifetime;
  }

  _check_time() {
    if (game.time_now > this.end_time) {
      this.dead = true;
    }
  }
  _update() {
    if (this.unit) {
      this.x = this.unit.x;
      this.y = this.unit.y + this.y_offset;
    } else {
      this.x += this.vx;
      this.y += this.vy;
    }

    if (this.fade) {
      this.alpha += this.valpha;
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx - 画布上下文对象，用于绘制Text
   */
  _render(ctx) {
    // 保存当前的globalAlpha值,字体设置
    const originalAlpha = ctx.globalAlpha;
    const originalFont = ctx.font;

    // 设置新的透明度,字体
    ctx.globalAlpha = this.alpha;
    ctx.font = this.size;

    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);

    // 恢复原来的globalAlpha,字体值
    ctx.globalAlpha = originalAlpha;
    ctx.font = originalFont;
  }
  /**
   * 渲染图形到画布上下文
   * @param {CanvasRenderingContext2D} ctx - 画布上下文对象
   */
  render(ctx) {
    this._render(ctx);
    this._update();
    this._check_time();
  }

  /**
   * 静态方法：创建一个伤害提示文本对象并添加到提示框队列中。
   *
   * @param {number} x - 提示文本的初始x坐标。
   * @param {number} y - 提示文本的初始y坐标。
   * @param {string} color - 提示文本的颜色。
   * @param {number} damage - 伤害数值。
   * @param {number} damage_ref - optional 伤害最大值参考，用于放大字体
   * @param {string} [affix=""] - optional 伤害数值的后缀，如“%”。
   * @param {number} [size=10] - optional 提示文本的初始字体大小。
   * @param {number} [lifetime=600] - optional 提示文本在画布上显示的生命周期，以毫秒为单位。
   * @param {number} [vy=-1.75] - optional 文本上浮速度。
   */
  static damage_prompt({
    x,
    y,
    color,
    damage,
    damage_ref = 200,
    affix = "",
    size = 10,
    lifetime = 600,
    vy = -1.75,
  } = {}) {
    size += 8 * (damage / damage_ref); //按伤害比例增加字体大小
    world.CanvasPrompts.push(
      new this({
        text: `-${damage.toFixed(1)}${affix}`,
        x,
        y,
        vx: 0.8 * getRandomSign(),
        vy,
        color,
        size,
        lifetime,
      })
    );
  }
}

export class CanvasCircle extends CanvasTextPrompt {
  /**
   * 创建一个圆形对象。
   *
   * 圆形用于在屏幕上显示圆形的视觉元素。
   * 它们可以被用于各种视觉效果，如消息提示、爆炸效果等。
   *
   * @param {number} config.size 对象的大小，默认为20。
   * @param {string} config.color 对象的颜色，默认为"red"。
   * @param {string} [config.color_border] 对象边框的颜色，如果未提供，则默认与对象颜色相同。
   * @param {string} [config.unit] 单位字符串，如果提供，则将其绑定到对象上。
   * @param {number} [config.x] 对象的x坐标，用于定位。
   * @param {number} [config.y] 对象的y坐标，用于定位。
   * @param {number} [config.vx] 对象在x轴上的速度。
   * @param {number} [config.vy] 对象在y轴上的速度。
   * @param {boolean} [config.fade] 控制对象是否逐渐消失，默认为true。
   * @param {number} [config.lifetime] 对象的生命周期，默认为2000毫秒。
   * @param {number} [config.alpha_final] 对象最终的透明度，默认为0.1。
   */
  constructor({
    size = 20,
    color = "red",
    color_border,
    unit, //如果设置了unit，则绑定在unit上
    x, //固定位置
    y, //固定位置
    vx = 0,
    vy = 0,
    fade = true,
    lifetime = 2000,
    alpha_init = 1.0, //最终透明度会变为10%
    alpha_final = 0.1, //最终透明度会变为10%
  } = {}) {
    super({
      text: "",
      unit, //如果设置了unit，则绑定在unit上
      x, //固定位置
      y, //固定位置
      vx,
      vy,
      color,
      fade,
      lifetime,
      alpha_init,
      alpha_final,
    });
    this.color_border = color_border ?? this.color;
    this.size = size;
  }
  /**
   * 渲染圆形到画布上下文
   * @param {CanvasRenderingContext2D} ctx - 画布上下文对象，用于绘制圆形
   */
  _render(ctx) {
    const originalAlpha = ctx.globalAlpha;
    ctx.globalAlpha = this.alpha;

    ctx.fillStyle = this.color;
    //圆形
    ctx.beginPath(); // 开始绘制新路径
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); // 绘制一个圆心坐标为 (100, 100)，半径为 50 的圆
    ctx.fill(); // 填充圆

    // 设置边框样式
    ctx.strokeStyle = this.color_border; // 边框颜色
    ctx.lineWidth = 1; // 边框宽度，单位为像素

    // 绘制边框
    ctx.beginPath(); // 开始绘制新路径
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); // 绘制圆
    ctx.stroke(); // 绘制边框

    ctx.globalAlpha = originalAlpha;
  }

  static explosion(x, y, size = 15, color = "red", lifetime = 1000) {
    let outer = new this({
      x,
      y,
      size,
      color,
      lifetime: lifetime,
      alpha_init: 0.3,
      alpha_final: 0.1,
    });
    let inner = new this({
      x,
      y,
      size: size / 2,
      color,
      lifetime: lifetime * 0.9,
      alpha_init: 0.8,
      alpha_final: 0.3,
    });

    world.CanvasPrompts.push(outer);
    world.CanvasPrompts.push(inner);
  }
}
