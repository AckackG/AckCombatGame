import { beforeEach, describe, expect, it } from "vitest";
import { game, world } from "../src/core/game.js";
import {
  get_overlap_resolution,
  point_distance_to_entity,
  segment_intersects_shape,
} from "../src/core/utils.js";
import { GunFactory } from "../src/core/weapons.js";
import { BulletFactory } from "../src/entities/projectiles.js";
import { ArmoredCar, Cover, Fighter, Sandbag, Unit } from "../src/entities/units.js";

describe("Obstacle and vehicle collision", () => {
  beforeEach(() => {
    world.units.length = 0;
    world.bullets.length = 0;
    world.CanvasPrompts = [];
    game.time_now = 10000;
    game.currentMode = "CAMPAIGN";
  });

  it("intersects bullet segments with rectangular shapes", () => {
    const cover = new Cover({ x: 0, y: 0, color: "red" });
    const shape = cover.get_collision_shape();

    expect(segment_intersects_shape(-80, 0, 80, 0, shape, 1)).toBe(true);
    expect(segment_intersects_shape(-80, 80, 80, 80, shape, 1)).toBe(false);
    expect(point_distance_to_entity(0, 0, cover)).toBe(0);
    expect(point_distance_to_entity(0, 60, cover)).toBe(40);
  });

  it("lets friendly projectiles pass friendly sandbags but blocks enemy projectiles", () => {
    const weapon = GunFactory.get_gun("M16");
    const friendly = new Fighter({ x: -100, y: 0, color: "red", weapon });
    const enemy = new Unit({ x: -100, y: 0, color: "blue", weapon: GunFactory.get_gun("M16") });
    const sandbag = new Sandbag({ x: 0, y: 0, color: "red" });

    const friendlyBullet = BulletFactory.RifleBullet({
      x: 0,
      y: 0,
      angle: 0,
      source_unit: friendly,
      source_weapon: weapon,
    });
    sandbag.bullet_collision(friendlyBullet);
    expect(sandbag.hp).toBe(sandbag.maxhp);
    expect(friendlyBullet.dead).toBe(false);

    const enemyBullet = BulletFactory.RifleBullet({
      x: 0,
      y: 0,
      angle: 0,
      source_unit: enemy,
      source_weapon: enemy.weapon,
    });
    sandbag.bullet_collision(enemyBullet);
    expect(sandbag.hp).toBeLessThan(sandbag.maxhp);
  });

  it("blocks both friendly and enemy projectiles with cover", () => {
    const weapon = GunFactory.get_gun("M16");
    const friendly = new Fighter({ x: -100, y: 0, color: "red", weapon });
    const cover = new Cover({ x: 0, y: 0, color: "red" });
    const bullet = BulletFactory.RifleBullet({
      x: 0,
      y: 0,
      angle: 0,
      source_unit: friendly,
      source_weapon: weapon,
    });

    cover.bullet_collision(bullet);

    expect(cover.hp).toBeLessThan(cover.maxhp);
  });

  it("resolves circle movement overlap against rectangular obstacles", () => {
    const fighter = new Fighter({ x: 0, y: 0, color: "red", weapon: GunFactory.get_gun("M16") });
    const cover = new Cover({ x: 0, y: 0, color: "red" });

    const resolution = get_overlap_resolution(fighter, cover);
    expect(resolution.depth).toBeGreaterThan(0);

    fighter.unit_collision(cover);
    expect(point_distance_to_entity(fighter.x, fighter.y, cover)).toBeGreaterThan(0);
  });

  it("uses separate turret health and disables armored car fire when turret is destroyed", () => {
    const car = new ArmoredCar({
      x: 0,
      y: 0,
      color: "red",
      weapon: GunFactory.get_gun("M16"),
      turret_hp: 20,
    });
    const enemy = new Unit({ x: -100, y: 0, color: "blue", weapon: GunFactory.get_gun("M16") });
    const bullet = BulletFactory.RifleBullet({
      x: 0,
      y: 0,
      angle: 0,
      source_unit: enemy,
      source_weapon: enemy.weapon,
    });

    car.bullet_collision(bullet);

    expect(car.turret_hp).toBeLessThan(20);
    expect(car.hp).toBe(car.maxhp);

    car.turret_hp = 0;
    car.turret_dead = true;
    car.setTarget(enemy);
    car.attack();

    expect(world.bullets).toHaveLength(0);
  });
});
