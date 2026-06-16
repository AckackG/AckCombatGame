import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deal_damage } from '../src/core/logic.js';
import { world, game } from '../src/core/game.js';

describe('Damage Pipeline (deal_damage)', () => {
  beforeEach(() => {
    // Mock the world and game dependencies
    world.CanvasPrompts = [];
  });

  it('deals correct kinetic damage with no armor', () => {
    const target = { hp: 100, dead: false, armor: 0, evasion: 0 };
    deal_damage({ damage: 20, damage_type: 'kinetic', target });
    expect(target.hp).toBe(80);
  });

  it('reduces damage with armor', () => {
    // Armor formula: armor / (armor + 100)
    // For armor=100, reduction=0.5
    const target = { hp: 100, dead: false, armor: 100, evasion: 0 };
    deal_damage({ damage: 20, damage_type: 'kinetic', target });
    expect(target.hp).toBe(90); // 20 * 0.5 = 10 damage taken
  });

  it('true_damage ignores armor and evasion', () => {
    const target = { hp: 100, dead: false, armor: 100, evasion: 1.0 }; // 100% evasion
    deal_damage({ damage: 20, damage_type: 'true_damage', target });
    expect(target.hp).toBe(80); // full 20 damage taken
  });

  it('explosive damage ignores evasion but respects armor', () => {
    const target = { hp: 100, dead: false, armor: 100, evasion: 1.0 }; 
    deal_damage({ damage: 20, damage_type: 'explosive', target });
    expect(target.hp).toBe(90); // 10 damage taken due to armor, evasion ignored
  });

  it('evasion successfully blocks kinetic damage', () => {
    // Force Math.random to always be < 1.0
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    
    const target = { hp: 100, dead: false, armor: 0, evasion: 1.0 }; // 100% evasion
    deal_damage({ damage: 20, damage_type: 'kinetic', target });
    
    expect(target.hp).toBe(100); // no damage taken
    
    randomSpy.mockRestore();
  });
});
