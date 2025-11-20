import { point_angle } from "../mylibs/utils.js";

class MoveableObject {
  angle = 0; //当前朝向
  /**
   *
   * Unit 和 Bullet 都继承于此
   *
   * 只规定了如何移动的一系列函数
   *
   * @param {number} x 对象的初始x坐标。
   * @param {number} y 对象的初始y坐标。
   * @param {number} speed 对象的绝对速度，横着或者斜着走都是这个速度
   */
  constructor({ x, y, speed } = {}) {
    this._x = x;
    this._y = y;
    this.speed = speed; //绝对速度，横着或者斜着走都是这个速度

    this.dx = Math.cos(this.angle) * this.speed;
    this.dy = Math.sin(this.angle) * this.speed;
  }

  set x(value) {
    this._x = value;
  }

  get x() {
    return this._x;
  }

  set y(value) {
    this._y = value;
  }
  get y() {
    return this._y;
  }

  _move_UpdateAngle(x1, y1, x2, y2) {
    this.angle = point_angle(x1, y1, x2, y2);
  }

  _move_GetVector(angle) {
    this.dx = Math.cos(angle) * this.speed;
    this.dy = Math.sin(angle) * this.speed;
  }

  /**
   * 1帧内，对象通过angle更新dx,dy，然后向指定的角度移动
   *
   * 适用于移动方向改变后的运动。
   *
   * @param {Number} angle - 移动的方向角，以度为单位。默认使用对象当前的角度。
   */
  moveTowards(angle = this.angle) {
    this._move_GetVector(angle);
    this.moveForward();
  }

  /**
   * 1帧内，移动对象向dx,dy移动。
   *
   * 适用于移动方向不变的运动，或不按照angle方向的运动
   *
   * 【这个函数实现最终的移动效果！】
   *
   */
  moveForward() {
    this.x += this.dx;
    this.y += this.dy;
  }

  /**
   * 1帧内，移动对象靠近X,Y
   *
   * @param {number} toX 目标位置的x坐标。
   * @param {number} toY 目标位置的y坐标。
   */
  moveToXY(toX, toY) {
    let dx = toX - this.x;
    let dy = toY - this.y;
    let distance = Math.sqrt(dx * dx + dy * dy);

    // 如果已经到达目标点附近，则直接设置为目标点
    if (distance < this.speed) {
      this.x = toX;
      this.y = toY;
      return;
    }

    //更新角度并前进
    this._move_UpdateAngle(this.x, this.y, toX, toY);
    this.moveTowards();
  }

  /**
   * 1帧内，朝向单位移动
   */
  moveToUnit(target) {
    this.moveToXY(target.x, target.y);
  }

  /**
   * 1帧内，远离单位移动
   */
  moveAwayFromUnit(target) {
    let angle = point_angle(target.x, target.y, this.x, this.y);
    this.moveTowards(angle);
  }

  /**
   * 1帧内，垂直于单位移动
   *
   * @param {Object} target - 目标点的对象，包含x和y坐标。
   * @param {boolean} [left=null] - 指定是否向左侧滑动，默认为左
   */
  moveStrafe(target, left = true) {
    let angle = point_angle(this.x, this.y, target.x, target.y);
    if (left) {
      angle += Math.PI / 2;
    } else {
      angle -= Math.PI / 2;
    }
    this.moveTowards(angle);
  }

  update_slow() {}
}

export class EntityBasic extends MoveableObject {
  //Entity 可以随意改变angle
  //Entity 不能出地图边界
}

export class BulletBasic extends MoveableObject {
  //Bullet 不能随意改变angle，只能向前飞。拥有 ax ay 以时刻改变Vector
  //Bullet 飞出地图即死亡
}
