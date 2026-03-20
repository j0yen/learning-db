/**
 * LRU-K Replacer: Evicts the frame whose K-th most recent access is oldest.
 *
 * Frames with fewer than K accesses are considered to have -Infinity as their
 * K-th access timestamp, making them evicted first (FIFO among them).
 */

import type { FrameId } from '../../types.js';
import type { Replacer } from './replacer.js';

interface LRUKEntry {
  frameId: FrameId;
  history: number[]; // Timestamps of recent accesses, most recent first
  evictable: boolean;
}

export class LRUKReplacer implements Replacer {
  private k: number;
  private entries: Map<FrameId, LRUKEntry> = new Map();
  private evictableCount = 0;
  private currentTimestamp = 0;

  constructor(k: number = 2) {
    this.k = k;
  }

  recordAccess(frameId: FrameId): void {
    const ts = this.currentTimestamp++;
    let entry = this.entries.get(frameId);
    if (entry) {
      entry.history.unshift(ts);
      if (entry.history.length > this.k) {
        entry.history.pop();
      }
    } else {
      entry = { frameId, history: [ts], evictable: false };
      this.entries.set(frameId, entry);
    }
  }

  setEvictable(frameId: FrameId, evictable: boolean): void {
    const entry = this.entries.get(frameId);
    if (!entry) return;

    if (entry.evictable !== evictable) {
      entry.evictable = evictable;
      this.evictableCount += evictable ? 1 : -1;
    }
  }

  evict(): FrameId | null {
    if (this.evictableCount === 0) return null;

    let bestFrame: FrameId | null = null;
    let bestKDist = -1;
    let bestEarliestAccess = Infinity;

    for (const [frameId, entry] of this.entries) {
      if (!entry.evictable) continue;

      if (entry.history.length < this.k) {
        // Frames with < K accesses have infinite backward K-distance
        // Among these, evict the one with the earliest first access (FIFO)
        const earliestAccess = entry.history[entry.history.length - 1];
        if (
          bestFrame === null ||
          bestKDist !== Infinity ||
          (bestKDist === Infinity && earliestAccess < bestEarliestAccess)
        ) {
          if (bestKDist !== Infinity || earliestAccess < bestEarliestAccess) {
            bestFrame = frameId;
            bestKDist = Infinity;
            bestEarliestAccess = earliestAccess;
          }
        }
      } else {
        // K-th most recent access timestamp
        const kthAccess = entry.history[this.k - 1];
        const kDist = this.currentTimestamp - kthAccess;

        if (bestKDist !== Infinity) {
          if (bestFrame === null || kDist > bestKDist) {
            bestFrame = frameId;
            bestKDist = kDist;
            bestEarliestAccess = entry.history[entry.history.length - 1];
          }
        }
        // If bestKDist is Infinity, frames with < K accesses take priority
      }
    }

    if (bestFrame !== null) {
      this.remove(bestFrame);
      return bestFrame;
    }

    return null;
  }

  remove(frameId: FrameId): void {
    const entry = this.entries.get(frameId);
    if (!entry) return;

    if (entry.evictable) {
      this.evictableCount--;
    }
    this.entries.delete(frameId);
  }

  size(): number {
    return this.evictableCount;
  }
}
