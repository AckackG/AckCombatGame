import { unit_distance } from "../core/utils.js";
import { world } from "../core/game.js";
import { CanvasCircle } from "../core/CanvasTextPrompt.js";
import { DOT } from "../core/effects.js";

/**
 * 爆炸行为插件
 * 在子弹死亡时造成范围伤害
 */
export const ExplodeBehavior = (damage, radius, is_ff = false) => ({
  onDeath: (bullet) => {
    let units = world.UnitsQT.retrieve(bullet);
    units.forEach((unit) => {
      // 友军伤害判定
      if ((unit.color !== bullet.color && !is_ff) || is_ff) {
        let dis = unit_distance(unit, bullet) - unit.size;
        if (dis <= radius && !unit.dead) {
          // 线性衰减伤害计算
          const damage_percent = 0.5 + 0.5 * (1 - dis / radius);
          const final_damage = damage * damage_percent;
          
          bullet.onHit(unit, final_damage, "explosive");
          
          // 额外增加威胁值
          if (bullet.source_unit) {
            bullet.source_unit.threat += final_damage * bullet.threat_level;
          }
        }
      }
    });

    // 视觉特效
    CanvasCircle.explosion(bullet.x, bullet.y, radius, bullet.color, 2000);
  }
});

/**
 * 命中点燃行为插件
 */
export const BurnOnHitBehavior = () => ({
  onHit: (bullet, target) => {
    if (bullet.source_weapon) {
      CanvasCircle.explosion(bullet.x, bullet.y, 6, "red");
      target.add_effect(DOT.burning(target, bullet.source_weapon));
    }
  }
});

/**
 * 命中中毒行为插件
 */
export const PoisonOnHitBehavior = () => ({
  onHit: (bullet, target) => {
    if (bullet.source_weapon) {
      CanvasCircle.explosion(bullet.x, bullet.y, 4, "green");
      target.add_effect(DOT.poisoning(target, bullet.source_weapon));
    }
  }
});
