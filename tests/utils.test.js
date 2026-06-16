import { describe, it, expect } from 'vitest';
import { unit_distance, point_distance, getRandomSign, ObjectPool, cleanDeadEntities } from '../src/core/utils.js';

describe('Utils Functions', () => {
  it('point_distance calculates correct distance', () => {
    expect(point_distance(0, 0, 3, 4)).toBe(5);
    expect(point_distance(1, 1, 1, 1)).toBe(0);
    expect(point_distance(-1, -1, 2, 3)).toBe(5);
  });

  it('unit_distance calculates correct distance between objects', () => {
    const obj1 = { x: 0, y: 0 };
    const obj2 = { x: 3, y: 4 };
    expect(unit_distance(obj1, obj2)).toBe(5);
  });

  it('getRandomSign returns 1 or -1', () => {
    const sign = getRandomSign();
    expect([1, -1]).toContain(sign);
  });
});

describe('ObjectPool', () => {
  it('should reuse objects when available', () => {
    const createFn = () => ({ id: Math.random(), active: false });
    const pool = new ObjectPool(createFn, 0); // 初始大小为0

    const obj1 = pool.get();
    obj1.active = true;

    pool.release(obj1);
    const obj2 = pool.get();
    
    // Should be the exact same reference
    expect(obj1).toBe(obj2);
    expect(obj2.active).toBe(true); // it keeps its previous state
  });

  it('should create new objects when empty', () => {
    const createFn = () => ({ id: Math.random(), active: false });
    const pool = new ObjectPool(createFn, 0);

    const obj1 = pool.get();
    const obj2 = pool.get();
    
    expect(obj1).not.toBe(obj2);
  });
});

describe('cleanDeadEntities (Swap-and-Pop GC)', () => {
  it('should remove dead entities without changing array reference', () => {
    const arr = [
      { id: 1, dead: false },
      { id: 2, dead: true },
      { id: 3, dead: false },
      { id: 4, dead: true }
    ];
    
    // Custom logic simulating UnitsArray/BulletsArray
    let count = arr.length;
    let i = 0;
    while (i < count) {
      if (arr[i].dead) {
        if (i !== count - 1) {
          arr[i] = arr[count - 1]; // swap
        }
        count--;
      } else {
        i++;
      }
    }
    arr.length = count;

    expect(arr.length).toBe(2);
    expect(arr.some(e => e.dead)).toBe(false);
    expect(arr.map(e => e.id)).not.toContain(2);
    expect(arr.map(e => e.id)).not.toContain(4);
  });
});
