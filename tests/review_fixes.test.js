import { beforeEach, describe, expect, it, vi } from "vitest";
import { deal_damage } from "../src/core/logic.js";
import { game, world } from "../src/core/game.js";
import { GunFactory } from "../src/core/weapons.js";
import { waveManager } from "../src/core/wave.js";
import {
  Base,
  ExplosiveMonster,
  Fighter,
  Monster,
  RangedMonster,
  SpawnerMonster,
  Turret,
} from "../src/entities/units.js";

describe("Review fixes", () => {
  beforeEach(() => {
    localStorage.clear();
    world.units.length = 0;
    world.bullets.length = 0;
    game.currentMode = "CAMPAIGN";
    game.money = 0;
    waveManager.init(world, game);
  });

  it("excludes monster-only weapons from random weapon pools", () => {
    expect(game.Guns_NormalNames).not.toContain("Monster_Spit");
    expect(game.Guns_NormalNames).not.toContain("Monster_Explosion");
    expect(game.Guns_SpecialNames).not.toContain("Monster_Spit");
    expect(game.Guns_SpecialNames).not.toContain("Monster_Explosion");
    expect(game.Guns_Names).toContain("Monster_Spit");
    expect(game.Guns_Names).toContain("Monster_Explosion");
  });

  it("applies hit aggro to monster variants", () => {
    const source = new Fighter({ x: 0, y: 0, weapon: GunFactory.get_gun("M16") });
    const target = new RangedMonster({ x: 10, y: 10, monster_mul: 1 });

    deal_damage({ damage: 1, target, source_unit: source });

    expect(target.target).toBe(source);
  });

  it("restores campaign wave phase, unit growth, turret weapon state, and monster scaling", () => {
    const base = new Base({
      x: 100,
      y: 100,
      color: game.player_color,
      hp: 20000,
      weapon: GunFactory.get_gun("M16"),
    });
    const fighter = new Fighter({
      x: 200,
      y: 200,
      weapon: GunFactory.get_gun("Scar_H"),
    });
    fighter.level = 8;
    fighter.exp = 123;
    fighter.hp_regen = 17;
    fighter.speed = 4.2;
    fighter.can_preaim = true;
    fighter.weapon.ReloadTime = 2222;
    fighter.weapon.recoil = 0.4;

    const turretGun = GunFactory.get_gun("M240B");
    turretGun.ReloadTime = 3333;
    turretGun.recoil = 1.25;
    const turret = new Turret({ x: 300, y: 300, weapon: turretGun });

    const explosive = ExplosiveMonster.spawn_fast(500, 500, 2);
    explosive.split_on_death = true;

    world.units.push(base, fighter, turret, explosive);
    game.money = 4321;
    waveManager.waveNumber = 6;
    waveManager.timeToNextWave = 3456;
    waveManager.spawnType = "soldier";
    waveManager.hasEnemies = true;
    waveManager.saveGame("wave_spawned");

    world.units.length = 0;
    game.money = 0;
    waveManager.waveNumber = 0;
    waveManager.timeToNextWave = 0;
    waveManager.spawnType = "monster";
    waveManager.hasEnemies = false;

    expect(waveManager.loadGame()).toBe(true);

    const restoredFighter = world.units.find((u) => u instanceof Fighter && !(u instanceof Turret));
    const restoredTurret = world.units.find((u) => u instanceof Turret);
    const restoredExplosive = world.units.find((u) => u instanceof ExplosiveMonster);

    expect(game.money).toBe(4321);
    expect(waveManager.waveNumber).toBe(6);
    expect(waveManager.timeToNextWave).toBe(3456);
    expect(waveManager.spawnType).toBe("soldier");
    expect(waveManager.hasEnemies).toBe(true);
    expect(waveManager.lastCheckpointReason).toBe("wave_spawned");

    expect(restoredFighter.level).toBe(8);
    expect(restoredFighter.exp).toBe(123);
    expect(restoredFighter.hp_regen).toBe(17);
    expect(restoredFighter.speed).toBe(4.2);
    expect(restoredFighter.can_preaim).toBe(true);
    expect(restoredFighter.weapon.wname).toBe("Scar_H");
    expect(restoredFighter.weapon.ReloadTime).toBe(2222);
    expect(restoredFighter.weapon.recoil).toBe(0.4);

    expect(restoredTurret.weapon.wname).toBe("M240B");
    expect(restoredTurret.weapon.ReloadTime).toBe(3333);
    expect(restoredTurret.weapon.recoil).toBe(1.25);

    expect(restoredExplosive.monster_mul).toBe(2);
    expect(restoredExplosive.split_on_death).toBe(true);
  });

  it("renders campaign wave UI only on quarter-second ticks", () => {
    const renderSpy = vi.spyOn(waveManager, "renderUI").mockImplementation(() => {});
    game.paused = false;
    game.isGameOver = false;
    game.currentMode = "CAMPAIGN";
    waveManager.playerBase = null;
    waveManager.timeToNextWave = 1000;
    vi.spyOn(game, "is_full_second").mockReturnValue(false);
    const quarterSpy = vi.spyOn(game, "is_quarter_second").mockReturnValue(false);

    waveManager.update(1);
    expect(quarterSpy).toHaveBeenCalled();
    expect(renderSpy).not.toHaveBeenCalled();

    quarterSpy.mockReturnValue(true);
    waveManager.update(1);
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it("scales explosive monster split spawns by parent monster multiplier", () => {
    const explosive = ExplosiveMonster.spawn_fast(500, 500, 2);
    explosive.split_on_death = true;
    explosive.hp = 0;

    expect(explosive._update_hp()).toBe(false);

    const spawned = world.units.filter((u) => u instanceof Monster);
    expect(spawned).toHaveLength(2);
    expect(spawned.every((u) => u.monster_mul === 1.2)).toBe(true);
  });

  it("scales explosive monster blast weapon by parent monster multiplier", () => {
    game.time_now = 10000;
    const explosive = ExplosiveMonster.spawn_fast(500, 500, 2);
    explosive.split_on_death = false;
    explosive.hp = 0;

    expect(explosive._update_hp()).toBe(false);
    expect(world.bullets).toHaveLength(1);
    expect(world.bullets[0].source_weapon.wname).toBe("Monster_Explosion");
    expect(world.bullets[0].source_weapon.damage).toBe(300);
  });

  it("scales spawner monster children by parent monster multiplier", () => {
    const spawner = SpawnerMonster.spawn_big(500, 500, 2);
    spawner.spawn_timer = 10000;

    spawner.update();

    const spawned = world.units.find((u) => u instanceof Monster);
    expect(spawned.monster_mul).toBe(1);
  });
});
