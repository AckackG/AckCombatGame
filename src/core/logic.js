import { CanvasTextPrompt } from "./CanvasTextPrompt.js";
import { game, world } from "./game.js";
import soundManager from "./sound_manager.js";

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
  damage_type = "kinetic", // "kinetic", "explosive", "energy", "true_damage"
  target,
  source_weapon = null,
  source_unit = null,
  source_bullet = null,
} = {}) {
  if (!target || target.dead) return;

  // 1. 闪避判定 (Evasion)
  // true_damage 和 explosive 通常不可闪避
  if (damage_type !== "true_damage" && damage_type !== "explosive") {
    if (target.evasion > 0 && Math.random() < target.evasion) {
      world.CanvasPrompts.push(
        new CanvasTextPrompt({
          text: "MISS",
          unit: target,
          color: "gray",
          size: 10,
          lifetime: 800,
          vy: -1,
        })
      );
      return; // 闪避成功，免疫此次伤害
    }
  }

  // 2. 护甲与减伤计算 (Armor & Damage Reduction)
  let actual_damage = damage;
  if (damage_type !== "true_damage" && target.armor > 0) {
    // 护甲减伤公式：减免比例 = armor / (armor + 100)
    const reduction = target.armor / (target.armor + 100);
    actual_damage = actual_damage * (1 - reduction);
  }

  // 3. 造成伤害
  target.hp -= actual_damage;

  // 4. 目标粘性与仇恨响应 (Target Agro)
  // 如果受击者是 Monster 且攻击者存在，有概率被激怒并转移仇恨到攻击者身上，避免玩家单方面安全风筝
  if (source_unit && target.constructor.name === "Monster") {
    // 如果当前没有目标，或者 30% 概率转移仇恨（增加不可预测性和粘性）
    if (!target.target || Math.random() < 0.3) {
      target.target = source_unit;
    }
  }

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

  soundManager.play('death_monster', { position: { x: target.x, y: target.y } });

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
