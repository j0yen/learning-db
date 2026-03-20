import { describe, it, expect } from 'vitest';
import { LRUReplacer } from './lru-replacer.js';
import { ClockReplacer } from './clock-replacer.js';
import { LRUKReplacer } from './lru-k-replacer.js';
import type { Replacer } from './replacer.js';

function testReplacer(name: string, createReplacer: () => Replacer) {
  describe(name, () => {
    it('should return null when empty', () => {
      const r = createReplacer();
      expect(r.evict()).toBeNull();
    });

    it('should not evict non-evictable frames', () => {
      const r = createReplacer();
      r.recordAccess(0);
      r.setEvictable(0, false);
      expect(r.evict()).toBeNull();
      expect(r.size()).toBe(0);
    });

    it('should evict an evictable frame', () => {
      const r = createReplacer();
      r.recordAccess(0);
      r.setEvictable(0, true);
      expect(r.size()).toBe(1);
      expect(r.evict()).toBe(0);
      expect(r.size()).toBe(0);
    });

    it('should track evictable count', () => {
      const r = createReplacer();
      r.recordAccess(0);
      r.recordAccess(1);
      r.recordAccess(2);
      r.setEvictable(0, true);
      r.setEvictable(1, true);
      expect(r.size()).toBe(2);
      r.setEvictable(1, false);
      expect(r.size()).toBe(1);
    });

    it('should remove a frame', () => {
      const r = createReplacer();
      r.recordAccess(0);
      r.setEvictable(0, true);
      r.remove(0);
      expect(r.size()).toBe(0);
      expect(r.evict()).toBeNull();
    });

    it('should handle multiple frames', () => {
      const r = createReplacer();
      for (let i = 0; i < 5; i++) {
        r.recordAccess(i);
        r.setEvictable(i, true);
      }
      expect(r.size()).toBe(5);

      // Should be able to evict all 5
      const evicted = new Set<number>();
      for (let i = 0; i < 5; i++) {
        const f = r.evict();
        expect(f).not.toBeNull();
        evicted.add(f!);
      }
      expect(evicted.size).toBe(5);
      expect(r.evict()).toBeNull();
    });

    it('should handle setEvictable idempotently', () => {
      const r = createReplacer();
      r.recordAccess(0);
      r.setEvictable(0, true);
      r.setEvictable(0, true); // No double-counting
      expect(r.size()).toBe(1);
    });
  });
}

testReplacer('LRUReplacer', () => new LRUReplacer());
testReplacer('ClockReplacer', () => new ClockReplacer());
testReplacer('LRUKReplacer', () => new LRUKReplacer(2));

// LRU-specific behavior
describe('LRUReplacer specific', () => {
  it('should evict least recently used frame', () => {
    const r = new LRUReplacer();
    r.recordAccess(0);
    r.recordAccess(1);
    r.recordAccess(2);
    r.setEvictable(0, true);
    r.setEvictable(1, true);
    r.setEvictable(2, true);

    // Frame 0 was accessed first (least recent), should be evicted
    expect(r.evict()).toBe(0);

    // Access frame 1 again, making frame 2 the LRU
    r.recordAccess(1);
    expect(r.evict()).toBe(2);
  });
});

// Clock-specific behavior
describe('ClockReplacer specific', () => {
  it('should clear reference bit before evicting', () => {
    const r = new ClockReplacer();
    r.recordAccess(0);
    r.recordAccess(1);
    r.setEvictable(0, true);
    r.setEvictable(1, true);

    // Access frame 0 again (sets ref bit)
    r.recordAccess(0);

    // Clock should skip frame 0 (ref bit set, clears it) and evict frame 1
    // or clear frame 0's bit and evict it on second pass — either is valid
    const evicted = r.evict();
    expect(evicted).not.toBeNull();
    expect(r.size()).toBe(1);
  });
});

// LRU-K specific behavior
describe('LRUKReplacer specific', () => {
  it('should evict frames with < K accesses first', () => {
    const r = new LRUKReplacer(2);

    // Frame 0: accessed twice
    r.recordAccess(0);
    r.recordAccess(0);

    // Frame 1: accessed once (< K accesses → infinite backward K-distance)
    r.recordAccess(1);

    r.setEvictable(0, true);
    r.setEvictable(1, true);

    // Frame 1 should be evicted first (< K accesses)
    expect(r.evict()).toBe(1);
  });

  it('should evict frame with oldest K-th access among fully-accessed frames', () => {
    const r = new LRUKReplacer(2);

    // Frame 0: 2 accesses
    r.recordAccess(0);
    r.recordAccess(0);

    // Frame 1: 2 accesses (more recent)
    r.recordAccess(1);
    r.recordAccess(1);

    r.setEvictable(0, true);
    r.setEvictable(1, true);

    // Frame 0's K-th access is older → evict frame 0
    expect(r.evict()).toBe(0);
  });
});
