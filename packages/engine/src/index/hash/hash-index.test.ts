import { describe, it, expect } from 'vitest';
import { ChainedHashIndex } from './chained-hash-index.js';
import { LinearProbeHashIndex } from './linear-probe-hash-index.js';
import { ExtendibleHashIndex } from './extendible-hash-index.js';
import type { Index } from '../index.js';
import type { RecordId } from '../../types.js';

function rid(page: number, slot: number): RecordId {
  return { pageId: { fileId: 0, pageNum: page }, slotNum: slot };
}

function testHashIndex(name: string, createIndex: () => Index) {
  describe(name, () => {
    it('should insert and search', () => {
      const idx = createIndex();
      idx.insert(42, rid(0, 0));
      const results = idx.search(42);
      expect(results.length).toBe(1);
      expect(results[0]).toEqual(rid(0, 0));
    });

    it('should handle many inserts', () => {
      const idx = createIndex();
      for (let i = 0; i < 100; i++) {
        idx.insert(i, rid(0, i));
      }
      expect(idx.size()).toBe(100);

      for (let i = 0; i < 100; i++) {
        const results = idx.search(i);
        expect(results.length).toBe(1);
      }
    });

    it('should handle duplicate keys', () => {
      const idx = createIndex();
      idx.insert(5, rid(0, 0));
      idx.insert(5, rid(0, 1));
      idx.insert(5, rid(0, 2));

      const results = idx.search(5);
      expect(results.length).toBe(3);
    });

    it('should return empty for non-existent key', () => {
      const idx = createIndex();
      idx.insert(1, rid(0, 0));
      expect(idx.search(999)).toEqual([]);
    });

    it('should delete', () => {
      const idx = createIndex();
      idx.insert(10, rid(0, 0));
      expect(idx.delete(10, rid(0, 0))).toBe(true);
      expect(idx.search(10)).toEqual([]);
      expect(idx.size()).toBe(0);
    });

    it('should delete specific RID', () => {
      const idx = createIndex();
      idx.insert(5, rid(0, 0));
      idx.insert(5, rid(0, 1));
      idx.delete(5, rid(0, 0));

      const results = idx.search(5);
      expect(results.length).toBe(1);
      expect(results[0]).toEqual(rid(0, 1));
    });

    it('should return false for non-existent delete', () => {
      const idx = createIndex();
      expect(idx.delete(99, rid(0, 0))).toBe(false);
    });

    it('should handle string keys', () => {
      const idx = createIndex();
      idx.insert('hello', rid(0, 0));
      idx.insert('world', rid(0, 1));

      expect(idx.search('hello').length).toBe(1);
      expect(idx.search('world').length).toBe(1);
      expect(idx.search('nope')).toEqual([]);
    });

    it('should range scan (full scan for hash)', () => {
      const idx = createIndex();
      for (let i = 0; i < 20; i++) {
        idx.insert(i, rid(0, i));
      }

      const results = idx.rangeScan(5, 10);
      expect(results.length).toBe(6); // 5,6,7,8,9,10
    });
  });
}

testHashIndex('ChainedHashIndex', () => new ChainedHashIndex('test', 16));
testHashIndex('LinearProbeHashIndex', () => new LinearProbeHashIndex('test', 16));
testHashIndex('ExtendibleHashIndex', () => new ExtendibleHashIndex('test', 4, 1));

// Extendible-specific tests
describe('ExtendibleHashIndex specific', () => {
  it('should grow directory on overflow', () => {
    const idx = new ExtendibleHashIndex('test', 2, 1);
    const initialDir = idx.getDirectorySize();

    for (let i = 0; i < 20; i++) {
      idx.insert(i, rid(0, i));
    }

    expect(idx.getDirectorySize()).toBeGreaterThan(initialDir);
    expect(idx.getGlobalDepth()).toBeGreaterThan(1);
    expect(idx.size()).toBe(20);
  });

  it('should track distinct buckets', () => {
    const idx = new ExtendibleHashIndex('test', 4, 1);
    for (let i = 0; i < 10; i++) {
      idx.insert(i, rid(0, i));
    }
    expect(idx.getNumBuckets()).toBeGreaterThanOrEqual(2);
  });
});

// ChainedHash-specific tests
describe('ChainedHashIndex specific', () => {
  it('should report load factor', () => {
    const idx = new ChainedHashIndex('test', 10);
    for (let i = 0; i < 20; i++) {
      idx.insert(i, rid(0, i));
    }
    expect(idx.loadFactor()).toBe(2.0);
  });
});
