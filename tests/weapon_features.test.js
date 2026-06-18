import { beforeEach, describe, expect, it, vi } from "vitest";
import { game, world } from "../src/core/game.js";
import { GunFactory } from "../src/core/weapons.js";
import { generate_recoil_reference } from "../src/core/utils.js";
import { BulletFactory } from "../src/entities/projectiles.js";
import { Fighter, Unit } from "../src/entities/units.js";

describe("Weapon feature updates", () => {
  beforeEach(() => {
    world.units.length = 0;
    world.bullets.length = 0;
    world.CanvasPrompts = [];
    game.time_now = 10000;
  });

  it("adds weighted special weapons to the special pool", () => {
    expect(game.Guns_SpecialNames).toContain("Homing_RPG");
    expect(game.Guns_SpecialNames).toContain("Cryo_RG6");
    expect(game.Guns_Data.Homing_RPG.random_weight).toBe(0.66);
    expect(game.Guns_Data.Cryo_RG6.random_weight).toBe(0.66);
  });

  it("scales recoil reference by target size", () => {
    const size9 = generate_recoil_reference(9).get("1.0");
    const size18 = generate_recoil_reference(18).get("1.0");

    expect(size18.hit25).toBeCloseTo(size9.hit25 * 2);
  });

  it("generates target recoil reference when a unit acquires a target", () => {
    const attacker = new Fighter({ x: 0, y: 0, weapon: GunFactory.get_gun("M16") });
    const target = new Unit({ x: 10, y: 0, size: 18, color: "blue", weapon: GunFactory.get_gun("M16") });

    attacker.setTarget(target);

    expect(attacker.target_recoil_reference.get("1.0").hit25).toBeCloseTo(8250.59225);
  });

  it("holds fire when fire control recoil is too high for the target distance", () => {
    const weapon = GunFactory.get_gun("M16");
    weapon.use_fire_control = true;
    weapon.recoil_heat = 20;
    weapon.last_recoil_update_time = game.time_now;

    const attacker = new Fighter({ x: 0, y: 0, weapon });
    const target = new Unit({
      x: 900,
      y: 0,
      size: 9,
      color: "blue",
      weapon: GunFactory.get_gun("M16"),
    });
    attacker.setTarget(target);

    weapon.attack(attacker, target);

    expect(weapon.mag).toBe(weapon.magsize);
    expect(world.bullets).toHaveLength(0);
  });

  it("ignores PreFireRange for fire-control weapons when hit-rate distance allows firing", () => {
    const weapon = GunFactory.get_gun("M16");
    weapon.use_fire_control = true;
    weapon.frame_lastTime = 0;

    const attacker = new Fighter({ x: 0, y: 0, weapon });
    const target = new Unit({
      x: 1500,
      y: 0,
      size: 9,
      color: "blue",
      weapon: GunFactory.get_gun("M16"),
    });
    attacker.setTarget(target);

    weapon.attack(attacker, target);

    expect(weapon.mag).toBe(weapon.magsize - 1);
    expect(world.bullets).toHaveLength(1);
  });

  it("lets weapons customize the fire-control hit-rate threshold", () => {
    const weapon = GunFactory.get_gun("M16");
    weapon.use_fire_control = true;
    weapon.fire_control_hit_rate = 0.5;
    weapon.frame_lastTime = 0;

    const attacker = new Fighter({ x: 0, y: 0, weapon });
    const target = new Unit({
      x: 1500,
      y: 0,
      size: 9,
      color: "blue",
      weapon: GunFactory.get_gun("M16"),
    });
    attacker.setTarget(target);

    weapon.attack(attacker, target);

    expect(weapon.mag).toBe(weapon.magsize);
    expect(world.bullets).toHaveLength(0);
  });

  it("uses class default recoil cooling multiplier unless a weapon overrides it", () => {
    expect(GunFactory.get_gun("RPG_7").recoil_cooling_multiplier).toBe(1);
    expect(GunFactory.get_gun("M16").recoil_cooling_multiplier).toBe(0.06);
  });

  it("does not cool recoil heat during continuous fire cadence", () => {
    const weapon = GunFactory.get_gun("M16");
    const attacker = new Fighter({ x: 0, y: 0, weapon });
    const target = new Unit({
      x: 100,
      y: 0,
      size: 9,
      color: "blue",
      weapon: GunFactory.get_gun("M16"),
    });
    attacker.setTarget(target);

    weapon.attack(attacker, target);
    const heatAfterShot = weapon.recoil_heat;
    game.time_now += weapon.rate / 2;
    weapon.attack(attacker, target);

    expect(weapon.recoil_heat).toBe(heatAfterShot);
  });

  it("lets fire-control rifles pause at long-range edge after heat builds up", () => {
    const weapon = GunFactory.get_gun("M16");
    const attacker = new Fighter({ x: 0, y: 0, weapon });
    const target = new Unit({
      x: 1688,
      y: 0,
      size: 9,
      color: "blue",
      weapon: GunFactory.get_gun("M16"),
    });
    attacker.setTarget(target);

    let heldFire = false;
    for (let i = 0; i < 40; i++) {
      game.time_now += weapon.rate + 1;
      weapon.attack(attacker, target);
      if (weapon.fire_control_release_time > game.time_now) {
        heldFire = true;
        break;
      }
    }

    expect(heldFire).toBe(true);
    expect(weapon.mag).toBeGreaterThan(0);
  });

  it("keeps non-fire-control weapons firing normally", () => {
    const weapon = GunFactory.get_gun("M870");
    weapon.frame_lastTime = 0;
    weapon.recoil_heat = 20;

    const attacker = new Fighter({ x: 0, y: 0, weapon });
    const target = new Unit({
      x: 100,
      y: 0,
      size: 9,
      color: "blue",
      weapon: GunFactory.get_gun("M16"),
    });
    attacker.setTarget(target);

    weapon.attack(attacker, target);

    expect(weapon.mag).toBe(weapon.magsize - 1);
    expect(world.bullets.length).toBeGreaterThan(0);
  });

  it("turns homing rockets by no more than their per-frame turn limit", () => {
    const source_weapon = GunFactory.get_gun("Homing_RPG");
    const source_unit = new Fighter({ x: 0, y: 0, weapon: source_weapon });
    const target_unit = new Unit({
      x: 0,
      y: 100,
      color: "blue",
      weapon: GunFactory.get_gun("M16"),
    });
    const rocket = BulletFactory.HomingRocket({
      x: 0,
      y: 0,
      angle: 0,
      source_unit,
      source_weapon,
      target_dist: 1000,
      target_unit,
    });

    const before = rocket.angle;
    rocket.behaviors.forEach((behavior) => behavior.onUpdate?.(rocket));

    expect(rocket.angle - before).toBeCloseTo((5 * Math.PI) / 180 / game.targetFPS);
  });

  it("refreshes freezing slow without stacking", () => {
    const weapon = GunFactory.get_gun("Cryo_RG6");
    const target = new Unit({ x: 0, y: 0, color: "blue", weapon: GunFactory.get_gun("M16") });
    const grenade = BulletFactory.CryoGrenade({
      x: 0,
      y: 0,
      angle: 0,
      source_unit: new Fighter({ x: 0, y: 0, weapon }),
      source_weapon: weapon,
      target_dist: 100,
    });

    grenade.onHit(target, 1);
    grenade.onHit(target, 1);
    target._update_effect();

    expect(target.effect_list).toHaveLength(1);
    expect(target.movement_speed_multiplier).toBeCloseTo(0.6);
  });
});
