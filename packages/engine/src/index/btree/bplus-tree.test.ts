import { describe, it, expect } from 'vitest';
import { BPlusTree } from './bplus-tree.js';
import type { RecordId } from '../../types.js';

function rid(page: number, slot: number): RecordId {
  return { pageId: { fileId: 0, pageNum: page }, slotNum: slot };
}

describe('BPlusTree', () => {
  it('should insert and search a single key', () => {
    const tree = new BPlusTree('test', 4);
    tree.insert(10, rid(0, 0));
    expect(tree.search(10)).toEqual([rid(0, 0)]);
    expect(tree.size()).toBe(1);
  });

  it('should handle multiple inserts', () => {
    const tree = new BPlusTree('test', 4);
    for (let i = 0; i < 20; i++) {
      tree.insert(i, rid(0, i));
    }
    expect(tree.size()).toBe(20);

    for (let i = 0; i < 20; i++) {
      const results = tree.search(i);
      expect(results.length).toBe(1);
      expect(results[0].slotNum).toBe(i);
    }
  });

  it('should handle duplicate keys', () => {
    const tree = new BPlusTree('test', 4);
    tree.insert(5, rid(0, 0));
    tree.insert(5, rid(0, 1));
    tree.insert(5, rid(0, 2));

    const results = tree.search(5);
    expect(results.length).toBe(3);
    expect(tree.size()).toBe(3);
  });

  it('should return empty for non-existent key', () => {
    const tree = new BPlusTree('test', 4);
    tree.insert(1, rid(0, 0));
    expect(tree.search(99)).toEqual([]);
  });

  it('should delete a key', () => {
    const tree = new BPlusTree('test', 4);
    tree.insert(10, rid(0, 0));
    expect(tree.delete(10, rid(0, 0))).toBe(true);
    expect(tree.search(10)).toEqual([]);
    expect(tree.size()).toBe(0);
  });

  it('should delete specific RID for duplicate keys', () => {
    const tree = new BPlusTree('test', 4);
    tree.insert(5, rid(0, 0));
    tree.insert(5, rid(0, 1));

    expect(tree.delete(5, rid(0, 0))).toBe(true);
    const results = tree.search(5);
    expect(results.length).toBe(1);
    expect(results[0]).toEqual(rid(0, 1));
  });

  it('should return false when deleting non-existent key', () => {
    const tree = new BPlusTree('test', 4);
    expect(tree.delete(99, rid(0, 0))).toBe(false);
  });

  it('should perform range scan', () => {
    const tree = new BPlusTree('test', 4);
    for (let i = 0; i < 20; i++) {
      tree.insert(i * 10, rid(0, i));
    }

    const results = tree.rangeScan(50, 120);
    const keys = results.map((r) => r.key as number);
    expect(keys).toEqual([50, 60, 70, 80, 90, 100, 110, 120]);
  });

  it('should handle string keys', () => {
    const tree = new BPlusTree('test', 4);
    tree.insert('alice', rid(0, 0));
    tree.insert('bob', rid(0, 1));
    tree.insert('charlie', rid(0, 2));

    expect(tree.search('bob').length).toBe(1);
    const range = tree.rangeScan('a', 'c');
    expect(range.length).toBe(2); // alice, bob
  });

  it('should cause splits with many inserts', () => {
    const tree = new BPlusTree('test', 3); // Small order = more splits
    for (let i = 0; i < 100; i++) {
      tree.insert(i, rid(0, i));
    }

    expect(tree.size()).toBe(100);
    expect(tree.height()).toBeGreaterThan(1);

    // Verify all keys are still searchable
    for (let i = 0; i < 100; i++) {
      expect(tree.search(i).length).toBe(1);
    }
  });

  it('should handle many deletes', () => {
    const tree = new BPlusTree('test', 4);
    for (let i = 0; i < 50; i++) {
      tree.insert(i, rid(0, i));
    }

    // Delete even numbers
    for (let i = 0; i < 50; i += 2) {
      expect(tree.delete(i, rid(0, i))).toBe(true);
    }

    expect(tree.size()).toBe(25);

    // Odd numbers should still be searchable
    for (let i = 1; i < 50; i += 2) {
      expect(tree.search(i).length).toBe(1);
    }
    // Even numbers should be gone
    for (let i = 0; i < 50; i += 2) {
      expect(tree.search(i)).toEqual([]);
    }
  });

  it('should provide visualization data', () => {
    const tree = new BPlusTree('test', 4);
    for (let i = 0; i < 10; i++) {
      tree.insert(i, rid(0, i));
    }

    const viz = tree.toVizData();
    expect(viz.id).toBe('0');
    expect(viz.type).toBeDefined();
    // Root should have keys
    expect(viz.keys.length).toBeGreaterThan(0);
  });

  it('should reject order < 3', () => {
    expect(() => new BPlusTree('test', 2)).toThrow('order must be >= 3');
  });

  it('should handle insert and delete stress test', () => {
    const tree = new BPlusTree('stress', 5);
    const inserted: number[] = [];

    // Insert 200 random-ish values
    for (let i = 0; i < 200; i++) {
      const val = (i * 37) % 500;
      tree.insert(val, rid(0, i));
      inserted.push(val);
    }
    expect(tree.size()).toBe(200);

    // Delete first half
    for (let i = 0; i < 100; i++) {
      tree.delete(inserted[i], rid(0, i));
    }
    expect(tree.size()).toBe(100);

    // Remaining should still be searchable
    for (let i = 100; i < 200; i++) {
      expect(tree.search(inserted[i]).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should bulk insert', () => {
    const tree = new BPlusTree('test', 4);
    const entries = Array.from({ length: 50 }, (_, i) => ({
      key: i as number | string | boolean | null,
      rid: rid(0, i),
    }));
    tree.bulkInsert(entries);
    expect(tree.size()).toBe(50);
  });
});
