import { Unit, Fighter, Monster, Turret } from "./units.js";
import { GunFactory, MeleeWeapon } from "../mylibs/weapons.js";

export class Battalion {
  /**
   * 静态方法：生成并返回一个步兵单位。
   *
   * @param {number} x - 单位的x坐标，用于确定单位在游戏世界中的水平位置。
   * @param {number} y - 单位的y坐标，用于确定单位在游戏世界中的垂直位置。
   * @param {string} color - 单位的颜色，默认为"blue" - 敌军
   * @returns {Unit} 返回一个新的步兵单位实例，已配置好基本属性和战斗行为参数。
   */
  static spawn_infantry(x, y, color = "blue") {
    let unit = new Unit({
      x,
      y,
      color,
      size: 9,
      speed: 2,
      maxhp: 500,
      weapon: GunFactory.random_gun(),
    });
    unit.combat_threat_chance = 0.25; //选择危险目标而不是就近的概率
    unit.combat_dodge_chance = 0.15; //战术平移概率
    return unit;
  }

  /**
   * 静态方法：生成并返回一个民兵单位。
   *
   * @param {number} x - 单位的x坐标，用于确定单位在游戏世界中的水平位置。
   * @param {number} y - 单位的y坐标，用于确定单位在游戏世界中的垂直位置。
   * @param {string} color - 单位的颜色，默认为"blue" - 敌军
   * @returns {Unit} 返回一个新的步兵单位实例，已配置好基本属性和战斗行为参数。
   */
  static spawn_militia(x, y, color = "blue") {
    let unit = new Unit({
      x,
      y,
      color,
      size: 9,
      speed: 1.5,
      maxhp: 300,
      weapon: GunFactory.random_gun(),
    });
    unit.combat_threat_chance = 0.15; //选择危险目标而不是就近的概率
    unit.combat_dodge_chance = 0.05; //战术平移概率
    return unit;
  }

  /**
   * 静态方法：生成并返回一个精英步兵单位。
   *
   * @param {number} x - 单位的x坐标，用于确定单位在游戏世界中的水平位置。
   * @param {number} y - 单位的y坐标，用于确定单位在游戏世界中的垂直位置。
   * @param {string} color - 单位的颜色，默认为"blue" - 敌军
   * @returns {Unit} 返回一个新的步兵单位实例，已配置好基本属性和战斗行为参数。
   */
  static spawn_veteran(x, y, color = "blue") {
    let unit = new Unit({
      x,
      y,
      color,
      size: 8.5,
      speed: 2.5,
      maxhp: 700,
      weapon: GunFactory.random_gun(0.25),
    });
    unit.combat_threat_chance = 0.3; //选择危险目标而不是就近的概率
    unit.combat_dodge_chance = 0.25; //战术平移概率
    return unit;
  }

  /**
   * 静态方法：生成并返回一个特种部队单位。
   *
   * @param {number} x - 单位的x坐标，用于确定单位在游戏世界中的水平位置。
   * @param {number} y - 单位的y坐标，用于确定单位在游戏世界中的垂直位置。
   * @param {string} color - 单位的颜色，默认为"blue" - 敌军
   * @returns {Unit} 返回一个新的步兵单位实例，已配置好基本属性和战斗行为参数。
   */
  static spawn_specOps(x, y, color = "blue") {
    let unit = new Unit({
      x,
      y,
      color,
      size: 8,
      speed: 3,
      maxhp: 800,
      weapon: GunFactory.random_gun(0.25),
    });
    unit.combat_threat_chance = 0.3; //选择危险目标而不是就近的概率
    unit.combat_dodge_chance = 0.3; //战术平移概率
    return unit;
  }
}
