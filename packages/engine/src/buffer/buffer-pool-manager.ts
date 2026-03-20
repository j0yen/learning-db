/**
 * BufferPoolManager: Manages a fixed-size buffer pool of in-memory page frames.
 *
 * Pages are fetched from disk on demand and cached in frames. When the pool
 * is full, a replacement policy selects a frame to evict.
 */

import type { FrameId, PageSize } from '../types.js';
import { ReplacementPolicy } from '../types.js';
import type { DiskManager } from '../storage/disk-manager.js';
import type { Replacer } from './replacement/replacer.js';
import { LRUReplacer } from './replacement/lru-replacer.js';
import { ClockReplacer } from './replacement/clock-replacer.js';
import { LRUKReplacer } from './replacement/lru-k-replacer.js';

export interface BufferPoolStats {
  hits: number;
  misses: number;
  evictions: number;
  diskReads: number;
  diskWrites: number;
}

interface FrameEntry {
  pageNum: number; // -1 if frame is empty
  pinCount: number;
  isDirty: boolean;
  data: Uint8Array;
}

export class BufferPoolManager {
  private poolSize: number;
  private diskManager: DiskManager;
  private frames: FrameEntry[];
  private pageTable: Map<number, FrameId> = new Map(); // pageNum → frameId
  private freeList: FrameId[] = [];
  private replacer: Replacer;
  private stats: BufferPoolStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    diskReads: 0,
    diskWrites: 0,
  };

  constructor(
    diskManager: DiskManager,
    poolSize: number,
    policy: ReplacementPolicy = ReplacementPolicy.LRU,
    lruKValue: number = 2,
  ) {
    this.diskManager = diskManager;
    this.poolSize = poolSize;
    this.replacer = BufferPoolManager.createReplacer(policy, lruKValue);

    // Initialize frames
    this.frames = [];
    for (let i = 0; i < poolSize; i++) {
      this.frames.push({
        pageNum: -1,
        pinCount: 0,
        isDirty: false,
        data: new Uint8Array(diskManager.pageSize),
      });
      this.freeList.push(i);
    }
  }

  static createReplacer(policy: ReplacementPolicy, lruKValue: number = 2): Replacer {
    switch (policy) {
      case ReplacementPolicy.LRU:
        return new LRUReplacer();
      case ReplacementPolicy.CLOCK:
        return new ClockReplacer();
      case ReplacementPolicy.LRU_K:
        return new LRUKReplacer(lruKValue);
    }
  }

  /** Fetch a page into the buffer pool. Increments pin count. */
  fetchPage(pageNum: number): { frameId: FrameId; data: Uint8Array } | null {
    // Check if already in pool
    const existingFrame = this.pageTable.get(pageNum);
    if (existingFrame !== undefined) {
      this.stats.hits++;
      const frame = this.frames[existingFrame];
      frame.pinCount++;
      this.replacer.recordAccess(existingFrame);
      this.replacer.setEvictable(existingFrame, false);
      return { frameId: existingFrame, data: frame.data };
    }

    // Not in pool — need to bring it in
    this.stats.misses++;
    const frameId = this.findFrame();
    if (frameId === null) return null; // No available frame

    const frame = this.frames[frameId];

    // Read page from disk
    this.diskManager.readPage(pageNum, frame.data);
    this.stats.diskReads++;

    frame.pageNum = pageNum;
    frame.pinCount = 1;
    frame.isDirty = false;
    this.pageTable.set(pageNum, frameId);

    this.replacer.recordAccess(frameId);
    this.replacer.setEvictable(frameId, false);

    return { frameId, data: frame.data };
  }

  /** Allocate a new page on disk and fetch it into the pool. */
  newPage(): { pageNum: number; frameId: FrameId; data: Uint8Array } | null {
    const frameId = this.findFrame();
    if (frameId === null) return null;

    const pageNum = this.diskManager.allocatePage();
    const frame = this.frames[frameId];

    // Zero out the frame
    frame.data.fill(0);
    frame.pageNum = pageNum;
    frame.pinCount = 1;
    frame.isDirty = false;
    this.pageTable.set(pageNum, frameId);

    this.replacer.recordAccess(frameId);
    this.replacer.setEvictable(frameId, false);

    return { pageNum, frameId, data: frame.data };
  }

  /** Unpin a page (decrement pin count). */
  unpinPage(pageNum: number, isDirty: boolean): boolean {
    const frameId = this.pageTable.get(pageNum);
    if (frameId === undefined) return false;

    const frame = this.frames[frameId];
    if (frame.pinCount <= 0) return false;

    frame.pinCount--;
    if (isDirty) frame.isDirty = true;

    if (frame.pinCount === 0) {
      this.replacer.setEvictable(frameId, true);
    }

    return true;
  }

  /** Flush a specific page to disk. */
  flushPage(pageNum: number): boolean {
    const frameId = this.pageTable.get(pageNum);
    if (frameId === undefined) return false;

    const frame = this.frames[frameId];
    this.diskManager.writePage(pageNum, frame.data);
    this.stats.diskWrites++;
    frame.isDirty = false;
    return true;
  }

  /** Flush all dirty pages to disk. */
  flushAll(): void {
    for (const [pageNum, frameId] of this.pageTable) {
      const frame = this.frames[frameId];
      if (frame.isDirty) {
        this.diskManager.writePage(pageNum, frame.data);
        this.stats.diskWrites++;
        frame.isDirty = false;
      }
    }
  }

  /** Delete a page from the buffer pool and disk. */
  deletePage(pageNum: number): boolean {
    const frameId = this.pageTable.get(pageNum);
    if (frameId !== undefined) {
      const frame = this.frames[frameId];
      if (frame.pinCount > 0) return false; // Can't delete pinned page

      this.replacer.remove(frameId);
      this.pageTable.delete(pageNum);
      frame.pageNum = -1;
      frame.pinCount = 0;
      frame.isDirty = false;
      this.freeList.push(frameId);
    }

    this.diskManager.deallocatePage(pageNum);
    return true;
  }

  /** Get buffer pool statistics. */
  getStats(): Readonly<BufferPoolStats> {
    return { ...this.stats };
  }

  /** Reset statistics counters. */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0, diskReads: 0, diskWrites: 0 };
  }

  /** Get the hit rate as a percentage. */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : (this.stats.hits / total) * 100;
  }

  /** Get pool size. */
  getPoolSize(): number {
    return this.poolSize;
  }

  /** Get number of pages currently in the pool. */
  getOccupancy(): number {
    return this.pageTable.size;
  }

  /** Get frame info for visualization. */
  getFrameInfo(): Array<{
    frameId: FrameId;
    pageNum: number;
    pinCount: number;
    isDirty: boolean;
  }> {
    return this.frames.map((f, i) => ({
      frameId: i,
      pageNum: f.pageNum,
      pinCount: f.pinCount,
      isDirty: f.isDirty,
    }));
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private findFrame(): FrameId | null {
    // Try free list first
    if (this.freeList.length > 0) {
      return this.freeList.pop()!;
    }

    // Need to evict
    const evictedFrame = this.replacer.evict();
    if (evictedFrame === null) return null;

    const frame = this.frames[evictedFrame];
    this.stats.evictions++;

    // Write dirty page to disk before evicting
    if (frame.isDirty) {
      this.diskManager.writePage(frame.pageNum, frame.data);
      this.stats.diskWrites++;
    }

    // Remove old mapping
    this.pageTable.delete(frame.pageNum);

    return evictedFrame;
  }
}
