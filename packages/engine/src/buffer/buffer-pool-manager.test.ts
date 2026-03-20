import { describe, it, expect } from 'vitest';
import { BufferPoolManager } from './buffer-pool-manager.js';
import { MemoryDiskManager } from '../storage/disk-manager.js';
import { ReplacementPolicy } from '../types.js';

function createBPM(poolSize = 4, policy = ReplacementPolicy.LRU) {
  const dm = new MemoryDiskManager(4096);
  return { bpm: new BufferPoolManager(dm, poolSize, policy), dm };
}

describe('BufferPoolManager', () => {
  it('should allocate a new page', () => {
    const { bpm } = createBPM();
    const result = bpm.newPage();
    expect(result).not.toBeNull();
    expect(result!.pageNum).toBe(0);
    expect(result!.data.byteLength).toBe(4096);
  });

  it('should fetch a page after writing', () => {
    const { bpm } = createBPM();
    const page = bpm.newPage()!;
    page.data[0] = 42;
    bpm.unpinPage(page.pageNum, true);

    const fetched = bpm.fetchPage(page.pageNum);
    expect(fetched).not.toBeNull();
    expect(fetched!.data[0]).toBe(42);
  });

  it('should track buffer hits and misses', () => {
    const { bpm } = createBPM();
    const page = bpm.newPage()!;
    bpm.unpinPage(page.pageNum, false);

    // First fetch after newPage was unpinned — page should still be cached
    bpm.fetchPage(page.pageNum);
    const stats = bpm.getStats();
    expect(stats.hits).toBe(1);
  });

  it('should return null when pool is full and all pinned', () => {
    const { bpm } = createBPM(2);
    bpm.newPage(); // page 0, pinned
    bpm.newPage(); // page 1, pinned
    // Pool is full, both pinned → can't allocate
    expect(bpm.newPage()).toBeNull();
  });

  it('should evict unpinned pages when pool is full', () => {
    const { bpm } = createBPM(2);
    const p0 = bpm.newPage()!;
    bpm.unpinPage(p0.pageNum, false);
    const p1 = bpm.newPage()!;
    bpm.unpinPage(p1.pageNum, false);

    // Pool full with 2 unpinned pages → should evict one
    const p2 = bpm.newPage();
    expect(p2).not.toBeNull();
  });

  it('should flush dirty pages on eviction', () => {
    const { bpm, dm } = createBPM(2);
    const p0 = bpm.newPage()!;
    p0.data[0] = 0xaa;
    bpm.unpinPage(p0.pageNum, true); // Mark dirty

    const p1 = bpm.newPage()!;
    bpm.unpinPage(p1.pageNum, false);

    // Evict p0 by allocating p2
    bpm.newPage();

    // Verify p0 was written to disk
    const buf = new Uint8Array(4096);
    dm.readPage(p0.pageNum, buf);
    expect(buf[0]).toBe(0xaa);
  });

  it('should flush a specific page', () => {
    const { bpm, dm } = createBPM();
    const page = bpm.newPage()!;
    page.data[0] = 0xbb;
    bpm.flushPage(page.pageNum);

    const buf = new Uint8Array(4096);
    dm.readPage(page.pageNum, buf);
    expect(buf[0]).toBe(0xbb);
  });

  it('should flush all dirty pages', () => {
    const { bpm, dm } = createBPM();
    const p0 = bpm.newPage()!;
    const p1 = bpm.newPage()!;
    p0.data[0] = 1;
    p1.data[0] = 2;
    bpm.unpinPage(p0.pageNum, true);
    bpm.unpinPage(p1.pageNum, true);

    bpm.flushAll();

    const buf0 = new Uint8Array(4096);
    dm.readPage(p0.pageNum, buf0);
    expect(buf0[0]).toBe(1);

    const buf1 = new Uint8Array(4096);
    dm.readPage(p1.pageNum, buf1);
    expect(buf1[0]).toBe(2);
  });

  it('should delete a page', () => {
    const { bpm } = createBPM();
    const page = bpm.newPage()!;
    bpm.unpinPage(page.pageNum, false);

    expect(bpm.deletePage(page.pageNum)).toBe(true);
    // Page was deallocated from disk — fetchPage should throw
    expect(() => bpm.fetchPage(page.pageNum)).toThrow();
  });

  it('should not delete a pinned page', () => {
    const { bpm } = createBPM();
    const page = bpm.newPage()!;
    expect(bpm.deletePage(page.pageNum)).toBe(false);
  });

  it('should report pool stats', () => {
    const { bpm } = createBPM();
    expect(bpm.getPoolSize()).toBe(4);
    expect(bpm.getOccupancy()).toBe(0);

    bpm.newPage();
    expect(bpm.getOccupancy()).toBe(1);
  });

  it('should compute hit rate', () => {
    const { bpm } = createBPM();
    expect(bpm.getHitRate()).toBe(0);

    const p = bpm.newPage()!;
    bpm.unpinPage(p.pageNum, false);
    bpm.fetchPage(p.pageNum); // hit
    expect(bpm.getHitRate()).toBe(100); // 1 hit, 0 misses (newPage doesn't count as fetch)
  });

  it('should provide frame info for visualization', () => {
    const { bpm } = createBPM(2);
    const p = bpm.newPage()!;
    const info = bpm.getFrameInfo();
    expect(info.length).toBe(2);
    // One frame should have our page, the other should be empty
    const used = info.find((f) => f.pageNum === p.pageNum);
    const empty = info.find((f) => f.pageNum === -1);
    expect(used).toBeDefined();
    expect(used!.pinCount).toBe(1);
    expect(empty).toBeDefined();
  });

  it('should reset stats', () => {
    const { bpm } = createBPM();
    bpm.newPage();
    bpm.resetStats();
    const stats = bpm.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  describe('with different replacement policies', () => {
    for (const policy of [ReplacementPolicy.LRU, ReplacementPolicy.CLOCK, ReplacementPolicy.LRU_K]) {
      it(`should work with ${policy}`, () => {
        const { bpm } = createBPM(3, policy);

        // Allocate 3 pages
        const pages = [];
        for (let i = 0; i < 3; i++) {
          const p = bpm.newPage()!;
          p.data[0] = i;
          pages.push(p);
        }

        // Unpin all
        for (const p of pages) {
          bpm.unpinPage(p.pageNum, true);
        }

        // Allocate a 4th — should evict one
        const p3 = bpm.newPage();
        expect(p3).not.toBeNull();
        expect(bpm.getStats().evictions).toBeGreaterThanOrEqual(1);
      });
    }
  });
});
