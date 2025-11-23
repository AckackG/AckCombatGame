// 本文件是零碎功能，不应该import其他module

/**
 * FpsQueue 类用于管理FPS（帧率）数据，通过限制队列大小来保持最近的FPS样本。
 * 这有助于平滑地展示FPS变化趋势，而不会被极值点所误导。
 */
class FpsQueue {
  #counter = 0;
  #queue = new Array(60);

  constructor(maxSize = 60) {
    this._maxSize = maxSize;
    this.#queue.fill(30);
  }

  push(value) {
    this.#queue[this.#counter] = value; // 将新值添加到数组末尾
    this.#counter++;
    if (this.#counter >= this._maxSize) {
      this.#counter = 0;
    }
  }

  /**
   * 计算平均帧率。
   *
   * @returns {string} 平均帧率的字符串表示，单位为毫秒（ms）。
   */
  getAverageFps() {
    //最大值减最小值除以length-1
    const min = Math.min.apply(null, this.#queue);
    const max = Math.max.apply(null, this.#queue);
    return (((this._maxSize - 1) / (max - min)) * 1000).toFixed(1);
  }
}

export let fpsqueue = new FpsQueue();

class WeaponStat {
  weapons = new Map();

  #init_weapon(weapon) {
    let name = weapon.wname;
    if (!this.weapons.has(name)) {
      this.weapons.set(name, {
        name,
        shots_fired: 0,
        shots_hit: 0,
        damage_fired: 0,
        damage_hit: 0,
        range: weapon.range,
        dps_average: weapon.dps_average,
      });
    }
  }

  weapon_fire(weapon, damage) {
    this.#init_weapon(weapon);
    this.weapons.get(weapon.wname).shots_fired += 1;
    this.weapons.get(weapon.wname).damage_fired += damage;
  }

  weapon_hit(weapon, damage) {
    this.#init_weapon(weapon);
    this.weapons.get(weapon.wname).shots_hit += 1;
    this.weapons.get(weapon.wname).damage_hit += damage;
  }

  get_report() {
    let r = [];
    this.weapons.forEach((value, key, map) => {
      value.accurate = parseFloat(value.shots_hit / value.shots_fired).toFixed(2);
      value.dmg_efficiency = parseFloat(value.damage_hit / value.damage_fired).toFixed(2);
      r.push(value);
      value.dps_finnal = value.dps_average * value.dmg_efficiency;
    });

    return r;
  }
}

export let Weaponstat = new WeaponStat();

/**
 * 计算两个单位之间的欧几里得距离。
 *
 * @param {Object} unit1 - 第一个单位的位置对象，包含x和y坐标。
 * @param {Object} unit2 - 第二个单位的位置对象，包含x和y坐标。
 * @returns {number} 返回两个单位之间的欧几里得距离。
 */
export function unit_distance(unit1, unit2) {
  return point_distance(unit1.x, unit1.y, unit2.x, unit2.y);
}

/**
 * 计算两点之间的欧几里得距离。
 *
 * @param {number} x1 第一个点的x坐标
 * @param {number} y1 第一个点的y坐标
 * @param {number} x2 第二个点的x坐标
 * @param {number} y2 第二个点的y坐标
 * @returns {number} 返回两点之间的距离
 */
export function point_distance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * 计算unit1->unit2之间的rad。
 *
 *
 * @param {Object} unit1 - 第一个单位向量，需要有x和y属性。
 * @param {Object} unit2 - 第二个单位向量，需要有x和y属性。
 * @returns {number} 两个单位向量之间的角度，以弧度表示。
 */
export function unit_angle(unit1, unit2) {
  return point_angle(unit1.x, unit1.y, unit2.x, unit2.y);
}

/**
 * 计算x1,y1 -> x2,y2的rad
 * @param {number} x1 - 第一个点的x坐标
 * @param {number} y1 - 第一个点的y坐标
 * @param {number} x2 - 第二个点的x坐标
 * @param {number} y2 - 第二个点的y坐标
 * @return {number} 返回由第一个点到第二个点的角度，单位为弧度
 */
export function point_angle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * 生成一个随机的1或-1。
 *
 * @returns {number} 返回1或-1，表示正或负。
 */
export function getRandomSign() {
  // 使用Math.random()生成0到1之间的随机数，并通过三元运算符决定返回1还是-1。
  return Math.random() > 0.5 ? 1 : -1;
}

/**
 * 判断一条线段是否与一个圆相交。
 *
 * @param Ax 线段A点的x坐标
 * @param Ay 线段A点的y坐标
 * @param Bx 线段B点的x坐标
 * @param By 线段B点的y坐标
 * @param Cx 圆心的x坐标
 * @param Cy 圆心的y坐标
 * @param R 圆的半径
 * @return 如果线段与圆相交返回true，否则返回false
 */
function isIntersecting(Ax, Ay, Bx, By, Cx, Cy, R) {
  // 计算线段的两个端点到圆心的距离
  const distAtoC = Math.sqrt((Ax - Cx) ** 2 + (Ay - Cy) ** 2);
  const distBtoC = Math.sqrt((Bx - Cx) ** 2 + (By - Cy) ** 2);

  // 如果线段的任意一个端点在圆内，则相交
  if (distAtoC <= R || distBtoC <= R) {
    return true;
  }

  // 计算线段AB的向量和圆心到A点的向量
  const ABx = Bx - Ax;
  const ABy = By - Ay;
  const ACx = Cx - Ax;
  const ACy = Cy - Ay;

  // 计算投影长度 t = (AC · AB) / (AB · AB)
  const dotProduct = ABx * ACx + ABy * ACy;
  const lenABSquared = ABx * ABx + ABy * ABy;
  const t = dotProduct / lenABSquared;

  // 计算投影点D的坐标
  const Dx = Ax + t * ABx;
  const Dy = Ay + t * ABy;

  // 计算投影点D到圆心的距离
  const distDtoC = Math.sqrt((Dx - Cx) ** 2 + (Dy - Cy) ** 2);

  // 检查垂足是否在线段上并且距离是否小于等于R
  if (t >= 0 && t <= 1 && distDtoC <= R) {
    return true;
  }

  // 如果以上条件都不满足，则不相交
  return false;
}

/**
 * 检查子弹是否已经命中单位。
 *
 * 通过比较子弹本帧和上一帧的轨迹是否穿过圆，来判定已经命中单位。
 *
 * @param {Object} bullet - 子弹对象，包含x、y坐标以及dx、dy表示运动方向和大小的属性。
 * @param {Object} unit - 单位对象，包含x、y坐标以及半径radius属性。
 * @returns {boolean} 如果子弹和单位相交，则返回true；否则返回false。
 */
export function isBulletIntersect(bullet, unit) {
  return isIntersecting(
    bullet.x - bullet.dx,
    bullet.y - bullet.dy,
    bullet.x,
    bullet.y,
    unit.x,
    unit.y,
    unit.size + bullet.size
  );
}

/**
 * 计算预瞄拦截点 (Interception Point)
 * 求解一元二次方程: |Target + V*t - Shooter|^2 = (S*t)^2
 *
 * @param {Object} shooter - 射击者 {x, y}
 * @param {Object} target - 目标 {x, y, dx, dy, vx, vy}
 * @param {number} v_bullet - 子弹速度
 * @returns {Object} 预测的 {x, y}。如果无法拦截（目标比子弹快且在远离），返回目标当前位置。
 */
export function get_intercept_position(shooter, target, v_bullet) {
  // 相对位置向量
  const dx = target.x - shooter.x;
  const dy = target.y - shooter.y;

  // 目标速度向量
  // 优先使用实际速度 (vx, vy)，因为 MoveableObject 的 dx,dy 可能在单位静止时仍保持非零值
  const vx = target.moved_x !== undefined ? target.moved_x : target.dx || 0;
  const vy = target.moved_y !== undefined ? target.moved_y : target.dy || 0;

  // 求解 at^2 + bt + c = 0
  // a = V_target^2 - V_bullet^2
  const a = vx * vx + vy * vy - v_bullet * v_bullet;
  // b = 2 * (D . V_target)
  const b = 2 * (dx * vx + dy * vy);
  // c = D^2
  const c = dx * dx + dy * dy;

  // 判别式
  const delta = b * b - 4 * a * c;

  let t = 0;

  if (Math.abs(a) < 0.0001) {
    // 目标速度 ≈ 子弹速度，退化为线性方程 bt + c = 0
    if (Math.abs(b) > 0.0001) {
      t = -c / b;
    } else {
      // 无法拦截
      return { x: target.x, y: target.y };
    }
  } else if (delta >= 0) {
    // 两个解，取最小正解
    const t1 = (-b - Math.sqrt(delta)) / (2 * a);
    const t2 = (-b + Math.sqrt(delta)) / (2 * a);

    if (t1 > 0 && t2 > 0) t = Math.min(t1, t2);
    else if (t1 > 0) t = t1;
    else if (t2 > 0) t = t2;
    else return { x: target.x, y: target.y }; // 时间为负，无法拦截
  } else {
    // 无解（目标太快追不上），直接打当前位置
    return { x: target.x, y: target.y };
  }

  // 计算预测位置 P = T + V*t
  return {
    x: target.x + vx * t,
    y: target.y + vy * t,
  };
}
