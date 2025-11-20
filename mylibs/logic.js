import { CanvasTextPrompt } from "./CanvasTextPrompt.js";
import { game, world } from "./game.js";

/**
 * 【核心函数】
 *
 * 处理最直接的单位扣血
 *
 * @param {number} damage 造成的伤害量。默认为0
 * @param {Object} target 受攻击的目标，一定要有！
 * @param {Object} source_weapon 攻击的来源武器。默认为null
 * @param {Object} source_unit 攻击的来源单位。默认为null
 * @param {Object} source_bullet 攻击的bullet。默认为null
 */
export function deal_damage({
  damage = 0,
  target,
  source_weapon = null,
  source_unit = null,
  source_bullet = null,
} = {}) {
  //造成伤害
  target.hp -= damage;

  //如果有来源武器，则更新武器统计数据
  if (source_weapon) {
    source_weapon.stat_damage_total += damage;
    source_weapon.stat_bullets_hit += 1;
    game.weapon_stats.weapon_hit(source_weapon, damage);
  }
}

/**
 * 【核心函数】
 *
 * 当目标被杀死时触发的函数。
 *
 * @param {Object|null} target - 被杀死的目标对象。默认为null，表示没有指定目标。
 * @param {Object} source_bullet 攻击的bullet。默认为null
 * @param {Object|null} source_unit - 发起攻击的单位对象。默认为null，表示没有指定攻击单位。
 * @param {Object|null} source_weapon - 发起攻击的武器对象。默认为null，表示没有指定武器。
 */
export function target_killed(
  target = null,
  source_bullet = null,
  source_unit = null,
  source_weapon = null
) {
  //更新数据
  source_weapon.stat_kills += 1;

  //凶手触发 onkill
  source_unit._onkill(target);

  // 玩家击杀敌军则增加金钱
  if (
    source_unit.color === game.player_color &&
    target.color !== game.player_color
  ) {
    game.money += target.value;
    world.CanvasPrompts.push(
      new CanvasTextPrompt({
        text: `+${target.value.toFixed(0)}$`,
        x: target.x,
        y: target.y,
        size: 13,
        color: "purple",
        lifetime: 1500,
      })
    );
  }
}
