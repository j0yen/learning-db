import { describe, it, expect } from 'vitest';
import { SkipList } from './skip-list.js';
import type { RecordId } from '../types.js';

function rid(page: number, slot: number): RecordId {
  return { pageId: { fileId: 0, pageNum: page }, slotNum: slot };
}

describe('SkipList', () => {
  it('should insert and search', () => {
    const sl = new SkipList('test');
    sl.insert(10, rid(0, 0));
    expect(sl.search(10)).toEqual([rid(0, 0)]);
    expect(sl.size()).toBe(1);
  });

  it('should handle many inserts', () => {
    const sl = new SkipList('test');
    for (let i = 0; i < 100; i++) {
      sl.insert(i, rid(0, i));
    }
    expect(sl.size()).toBe(100);

    for (let i = 0; i < 100; i++) {
      expect(sl.search(i).length).toBe(1);
    }
  });

  it('should handle duplicate keys (multiple RIDs)', () => {
    const sl = new SkipList('test');
    sl.insert(5, rid(0, 0));
    sl.insert(5, rid(0, 1));
    sl.insert(5, rid(0, 2));

    expect(sl.search(5).length).toBe(3);
    expect(sl.size()).toBe(3);
  });

  it('should return empty for non-existent key', () => {
    const sl = new SkipList('test');
    sl.insert(1, rid(0, 0));
    expect(sl.search(99)).toEqual([]);
  });

  it('should delete', () => {
    const sl = new SkipList('test');
    sl.insert(10, rid(0, 0));
    expect(sl.delete(10, rid(0, 0))).toBe(true);
    expect(sl.search(10)).toEqual([]);
    expect(sl.size()).toBe(0);
  });

  it('should delete specific RID for duplicate keys', () => {
    const sl = new SkipList('test');
    sl.insert(5, rid(0, 0));
    sl.insert(5, rid(0, 1));

    expect(sl.delete(5, rid(0, 0))).toBe(true);
    const results = sl.search(5);
    expect(results.length).toBe(1);
    expect(results[0]).toEqual(rid(0, 1));
  });

  it('should return false for non-existent delete', () => {
    const sl = new SkipList('test');
    expect(sl.delete(99, rid(0, 0))).toBe(false);
  });

  it('should range scan', () => {
    const sl = new SkipList('test');
    for (let i = 0; i < 20; i++) {
      sl.insert(i * 10, rid(0, i));
    }

    const results = sl.rangeScan(50, 120);
    const keys = results.map((r) => r.key as number);
    expect(keys).toEqual([50, 60, 70, 80, 90, 100, 110, 120]);
  });

  it('should handle string keys with range scan', () => {
    const sl = new SkipList('test');
    sl.insert('alice', rid(0, 0));
    sl.insert('bob', rid(0, 1));
    sl.insert('charlie', rid(0, 2));
    sl.insert('dave', rid(0, 3));

    const results = sl.rangeScan('b', 'c');
    expect(results.length).toBe(1); // bob
  });

  it('should handle insert-delete-insert cycle', () => {
    const sl = new SkipList('test');
    for (let i = 0; i < 50; i++) {
      sl.insert(i, rid(0, i));
    }
    for (let i = 0; i < 50; i++) {
      sl.delete(i, rid(0, i));
    }
    expect(sl.size()).toBe(0);

    for (let i = 0; i < 50; i++) {
      sl.insert(i + 100, rid(1, i));
    }
    expect(sl.size()).toBe(50);
    expect(sl.search(100).length).toBe(1);
  });
});
