/**
 * 性能计数器类
 * 用于统计和显示游戏对象的更新耗时
 */
export class PerformanceCounter {
  constructor() {
    this.reset();
  }

  reset() {
    this.units_time = 0;
    this.bullets_time = 0;
    this.units_count = 0;
    this.bullets_count = 0;
    this.collisions_time = 0;

    this.render_units_time = 0;
    this.render_bullets_time = 0;
    this.render_canvas_time = 0;
    this.render_canvas_count = 0;

    this.window_ms = 5000;
    this.samples = [];
  }

  /**
   * 记录单位更新耗时
   * @param {number} time - 耗时（毫秒）
   * @param {number} count - 单位数量
   */
  recordUnits(time, count) {
    this.units_time = time;
    this.units_count = count;
  }

  /**
   * 记录子弹更新耗时
   * @param {number} time - 耗时（毫秒）
   * @param {number} count - 子弹数量
   */
  recordBullets(time, count) {
    this.bullets_time = time;
    this.bullets_count = count;
  }

  /**
   * 记录碰撞检测耗时
   * @param {number} time - 耗时（毫秒）
   */
  recordCollisions(time) {
    this.collisions_time = time;
  }

  /**
   * 记录渲染耗时
   * @param {number} units_time - 单位渲染耗时（毫秒）
   * @param {number} bullets_time - 子弹渲染耗时（毫秒）
   * @param {number} canvas_time - 画布渲染耗时（毫秒）
   * @param {number} canvas_count - 画布渲染次数
   */
  recordRendertime(units_time, bullets_time, canvas_time, canvas_count) {
    this.render_units_time = units_time;
    this.render_bullets_time = bullets_time;
    this.render_canvas_time = canvas_time;
    this.render_canvas_count = canvas_count;
    this.#recordSample();
  }

  #recordSample() {
    const now = performance.now();
    const total =
      this.units_time +
      this.bullets_time +
      this.collisions_time +
      this.render_units_time +
      this.render_bullets_time +
      this.render_canvas_time;

    this.samples.push({ time: now, total });

    const cutoff = now - this.window_ms;
    while (this.samples.length && this.samples[0].time < cutoff) {
      this.samples.shift();
    }
  }

  #getWindowStats() {
    if (!this.samples.length) {
      return { avg: 0, max: 0 };
    }

    let total = 0;
    let max = 0;
    this.samples.forEach((sample) => {
      total += sample.total;
      if (sample.total > max) {
        max = sample.total;
      }
    });

    return {
      avg: total / this.samples.length,
      max,
    };
  }

  /**
   * 获取格式化的性能报告
   * @returns {string} 性能报告字符串
   */
  getReport() {
    const total_time = this.units_time + this.bullets_time;
    const total_count = this.units_count + this.bullets_count;
    const windowStats = this.#getWindowStats();

    const avg_unit =
      this.units_count > 0 ? (this.units_time / this.units_count).toFixed(4) : "0.0000";

    const avg_bullet =
      this.bullets_count > 0 ? (this.bullets_time / this.bullets_count).toFixed(4) : "0.0000";

    const currentTotal = (
      total_time +
      this.collisions_time +
      this.render_units_time +
      this.render_bullets_time +
      this.render_canvas_time
    ).toFixed(2);

    return `Logic: Units ${this.units_count}×${avg_unit}ms=${this.units_time.toFixed(
      2
    )}ms | Bullets ${this.bullets_count}×${avg_bullet}ms=${this.bullets_time.toFixed(
      2
    )}ms | Collisions ${this.collisions_time.toFixed(
      2
    )}ms <br> Render: Units ${this.render_units_time.toFixed(
      2
    )}ms | Render Bullets ${this.render_bullets_time.toFixed(
      2
    )}ms | Render Canvas ${this.render_canvas_time.toFixed(2)}ms (${
      this.render_canvas_count
    } times) <br>  Total: ${currentTotal}ms | 5s Avg ${windowStats.avg.toFixed(
      2
    )}ms / Max ${windowStats.max.toFixed(2)}ms`;
  }
}

export const performanceCounter = new PerformanceCounter();
