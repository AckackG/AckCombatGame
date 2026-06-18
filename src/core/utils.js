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

  clear() {
    this.weapons.clear();
  }
}

export let Weaponstat = new WeaponStat();

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const RECOIL_REFERENCE_SIZE = 9;
const RECOIL_REFERENCE_BASE = {
  hit100: 1031.324031,
  hit80: 1289.155039,
  hit50: 2062.648062,
  hit25: 4125.296125,
};

export function generate_recoil_reference(target_size = RECOIL_REFERENCE_SIZE) {
  const size_mul = target_size / RECOIL_REFERENCE_SIZE;
  const reference = new Map();

  for (let recoil_x10 = 1; recoil_x10 <= 200; recoil_x10++) {
    const recoil = recoil_x10 / 10;
    reference.set(recoil.toFixed(1), {
      recoil,
      hit100: (RECOIL_REFERENCE_BASE.hit100 * size_mul) / recoil,
      hit80: (RECOIL_REFERENCE_BASE.hit80 * size_mul) / recoil,
      hit50: (RECOIL_REFERENCE_BASE.hit50 * size_mul) / recoil,
      hit25: (RECOIL_REFERENCE_BASE.hit25 * size_mul) / recoil,
    });
  }

  return reference;
}

export function get_recoil_reference_row(reference, recoil) {
  const key = clamp(Math.round(recoil * 10) / 10, 0.1, 20).toFixed(1);
  return reference.get(key);
}

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

export function unit_distance_sq(unit1, unit2) {
  return point_distance_sq(unit1.x, unit1.y, unit2.x, unit2.y);
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

export function point_distance_sq(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function get_entity_shape(entity) {
  if (entity?.get_collision_shape) {
    return entity.get_collision_shape();
  }
  return {
    type: "circle",
    x: entity.x,
    y: entity.y,
    r: entity.size ?? Math.max(entity.width ?? 0, entity.height ?? 0) / 2,
  };
}

function get_shape_bounds(shape) {
  if (shape.type === "circle") {
    return {
      x: shape.x - shape.r,
      y: shape.y - shape.r,
      width: shape.r * 2,
      height: shape.r * 2,
    };
  }

  const cos = Math.cos(shape.angle ?? 0);
  const sin = Math.sin(shape.angle ?? 0);
  const hw = shape.hw;
  const hh = shape.hh;
  const extentX = Math.abs(cos) * hw + Math.abs(sin) * hh;
  const extentY = Math.abs(sin) * hw + Math.abs(cos) * hh;

  return {
    x: shape.x - extentX,
    y: shape.y - extentY,
    width: extentX * 2,
    height: extentY * 2,
  };
}

export function get_entity_bounds(entity) {
  if (entity?.get_bounds) {
    return entity.get_bounds();
  }
  if (entity?.get_collision_shape) {
    return get_shape_bounds(entity.get_collision_shape());
  }
  const width = entity.width ?? (entity.size ?? 0) * 2;
  const height = entity.height ?? (entity.size ?? 0) * 2;
  return {
    x: entity.x - width / 2,
    y: entity.y - height / 2,
    width,
    height,
  };
}

function to_local_point(x, y, shape) {
  const angle = -(shape.angle ?? 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - shape.x;
  const dy = y - shape.y;
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}

function to_world_vector(x, y, angle) {
  const cos = Math.cos(angle ?? 0);
  const sin = Math.sin(angle ?? 0);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function segment_intersects_aabb(ax, ay, bx, by, hw, hh) {
  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0;
  let tMax = 1;

  const axes = [
    { p: ax, d: dx, min: -hw, max: hw },
    { p: ay, d: dy, min: -hh, max: hh },
  ];

  for (const axis of axes) {
    if (Math.abs(axis.d) < 0.000001) {
      if (axis.p < axis.min || axis.p > axis.max) {
        return false;
      }
      continue;
    }

    const inv = 1 / axis.d;
    let t1 = (axis.min - axis.p) * inv;
    let t2 = (axis.max - axis.p) * inv;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) {
      return false;
    }
  }

  return true;
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

export function segment_intersects_shape(ax, ay, bx, by, shape, padding = 0) {
  if (shape.type === "circle") {
    return isIntersecting(ax, ay, bx, by, shape.x, shape.y, shape.r + padding);
  }

  const localA = to_local_point(ax, ay, shape);
  const localB = to_local_point(bx, by, shape);
  return segment_intersects_aabb(
    localA.x,
    localA.y,
    localB.x,
    localB.y,
    shape.hw + padding,
    shape.hh + padding
  );
}

export function point_distance_to_shape(x, y, shape) {
  if (shape.type === "circle") {
    return Math.max(0, point_distance(x, y, shape.x, shape.y) - shape.r);
  }

  const local = to_local_point(x, y, shape);
  const dx = Math.max(Math.abs(local.x) - shape.hw, 0);
  const dy = Math.max(Math.abs(local.y) - shape.hh, 0);
  return Math.sqrt(dx * dx + dy * dy);
}

export function point_distance_to_entity(x, y, entity) {
  return point_distance_to_shape(x, y, get_entity_shape(entity));
}

function circle_rect_resolution(circle, rect) {
  const local = to_local_point(circle.x, circle.y, rect);
  const closestX = clamp(local.x, -rect.hw, rect.hw);
  const closestY = clamp(local.y, -rect.hh, rect.hh);
  let dx = local.x - closestX;
  let dy = local.y - closestY;
  let dist = Math.sqrt(dx * dx + dy * dy);
  let depth = circle.r - dist;

  if (dist < 0.000001) {
    const toRight = rect.hw - local.x;
    const toLeft = rect.hw + local.x;
    const toBottom = rect.hh - local.y;
    const toTop = rect.hh + local.y;
    const min = Math.min(toRight, toLeft, toBottom, toTop);

    if (min === toRight) {
      dx = 1;
      dy = 0;
      depth = circle.r + toRight;
    } else if (min === toLeft) {
      dx = -1;
      dy = 0;
      depth = circle.r + toLeft;
    } else if (min === toBottom) {
      dx = 0;
      dy = 1;
      depth = circle.r + toBottom;
    } else {
      dx = 0;
      dy = -1;
      depth = circle.r + toTop;
    }
  } else {
    dx /= dist;
    dy /= dist;
  }

  if (depth <= 0) {
    return null;
  }

  const worldVector = to_world_vector(dx, dy, rect.angle ?? 0);
  return { x: worldVector.x, y: worldVector.y, depth };
}

function bounds_overlap_resolution(shapeA, shapeB) {
  const a = get_shape_bounds(shapeA);
  const b = get_shape_bounds(shapeB);
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (overlapX <= 0 || overlapY <= 0) {
    return null;
  }

  if (overlapX < overlapY) {
    return { x: shapeA.x < shapeB.x ? -1 : 1, y: 0, depth: overlapX };
  }
  return { x: 0, y: shapeA.y < shapeB.y ? -1 : 1, depth: overlapY };
}

export function get_overlap_resolution(entityA, entityB) {
  const shapeA = get_entity_shape(entityA);
  const shapeB = get_entity_shape(entityB);

  if (shapeA.type === "circle" && shapeB.type === "circle") {
    const combined = shapeA.r + shapeB.r;
    let dx = shapeA.x - shapeB.x;
    let dy = shapeA.y - shapeB.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= combined) {
      return null;
    }
    if (dist < 0.000001) {
      dx = 1;
      dy = 0;
      dist = 1;
    }
    return { x: dx / dist, y: dy / dist, depth: combined - dist };
  }

  if (shapeA.type === "circle") {
    return circle_rect_resolution(shapeA, shapeB);
  }

  if (shapeB.type === "circle") {
    const resolution = circle_rect_resolution(shapeB, shapeA);
    return resolution
      ? { x: -resolution.x, y: -resolution.y, depth: resolution.depth }
      : null;
  }

  return bounds_overlap_resolution(shapeA, shapeB);
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
  return segment_intersects_shape(
    bullet.x - bullet.dx,
    bullet.y - bullet.dy,
    bullet.x,
    bullet.y,
    get_entity_shape(unit),
    bullet.size
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

/**
 * 对象池 (Object Pool)
 * 用于复用高频创建/销毁的对象，避免垃圾回收 (GC) 导致的卡顿。
 */
export class ObjectPool {
  constructor(factoryFunc, initialSize = 100) {
    this.factoryFunc = factoryFunc;
    this.pool = [];
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factoryFunc());
    }
  }

  get() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return this.factoryFunc();
  }

  release(obj) {
    this.pool.push(obj);
  }
}

/**
 * 遍历数组，删除死掉的实体。使用 Swap-and-Pop 方式，O(1) 删除复杂度。
 * 直接在原数组上操作，避免 filter 创建新数组的内存开销。
 * @param {Array} arr 包含对象的数组
 * @param {ObjectPool} [pool=null] 可选的对象池，如果有则把死掉的对象放回池子
 */
export function cleanDeadEntities(arr, pool = null) {
  let i = 0;
  while (i < arr.length) {
    if (arr[i].dead) {
      if (pool) {
        pool.release(arr[i]);
      }
      // 将当前元素与最后一个元素交换
      const last = arr.length - 1;
      if (i !== last) {
        arr[i] = arr[last];
      }
      arr.pop(); // 移除最后的元素
      // 不要 i++，因为交换过来的新元素也需要检查
    } else {
      i++;
    }
  }
}
