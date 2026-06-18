import { clamp, point_angle, point_distance_to_entity } from "../core/utils.js";
import { game, world } from "../core/game.js";
import { CanvasCircle } from "../core/CanvasTextPrompt.js";
import { DOT, SlowEffect } from "../core/effects.js";

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
        let dis = point_distance_to_entity(bullet.x, bullet.y, unit);
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

export const SlowOnHitBehavior = () => ({
  onHit: (bullet, target) => {
    if (bullet.source_weapon) {
      CanvasCircle.explosion(bullet.x, bullet.y, 8, "cyan");
      target.add_effect(SlowEffect.freezing(target, bullet.source_weapon));
    }
  }
});

export const HomingBehavior = (target_unit, turn_deg_per_second = 5) => ({
  onInit: (bullet) => {
    bullet.target_unit = target_unit;
    bullet.homing_turn_rad_per_frame = (turn_deg_per_second * Math.PI) / 180 / game.targetFPS;
  },
  onUpdate: (bullet) => {
    const target = bullet.target_unit;
    if (!target || target.dead) {
      return;
    }

    const desired_angle = point_angle(bullet.x, bullet.y, target.x, target.y);
    let diff = desired_angle - bullet.angle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));

    const turn = clamp(diff, -bullet.homing_turn_rad_per_frame, bullet.homing_turn_rad_per_frame);
    bullet.angle += turn;

    const current_speed = Math.hypot(bullet.dx, bullet.dy);
    bullet.dx = Math.cos(bullet.angle) * current_speed;
    bullet.dy = Math.sin(bullet.angle) * current_speed;

    if (bullet.acceleration) {
      bullet.ax = Math.cos(bullet.angle) * bullet.acceleration;
      bullet.ay = Math.sin(bullet.angle) * bullet.acceleration;
    }
  }
});
