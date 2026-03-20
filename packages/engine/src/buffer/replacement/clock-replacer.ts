/**
 * Clock Replacer: Approximation of LRU using a circular buffer with reference bits.
 */

import type { FrameId } from '../../types.js';
import type { Replacer } from './replacer.js';

interface ClockEntry {
  frameId: FrameId;
  refBit: boolean;
  evictable: boolean;
}

export class ClockReplacer implements Replacer {
  private entries: Map<FrameId, ClockEntry> = new Map();
  private frameOrder: FrameId[] = []; // Circular buffer
  private clockHand = 0;
  private evictableCount = 0;

  recordAccess(frameId: FrameId): void {
    let entry = this.entries.get(frameId);
    if (entry) {
      entry.refBit = true;
    } else {
      entry = { frameId, refBit: true, evictable: false };
      this.entries.set(frameId, entry);
      this.frameOrder.push(frameId);
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

    const n = this.frameOrder.length;
    // At most 2 full sweeps (first clears ref bits, second evicts)
    for (let i = 0; i < 2 * n; i++) {
      if (this.frameOrder.length === 0) return null;

      this.clockHand = this.clockHand % this.frameOrder.length;
      const frameId = this.frameOrder[this.clockHand];
      const entry = this.entries.get(frameId);

      if (!entry || !entry.evictable) {
        this.clockHand = (this.clockHand + 1) % this.frameOrder.length;
        continue;
      }

      if (entry.refBit) {
        entry.refBit = false;
        this.clockHand = (this.clockHand + 1) % this.frameOrder.length;
        continue;
      }

      // Evict this frame
      this.remove(frameId);
      return frameId;
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

    const idx = this.frameOrder.indexOf(frameId);
    if (idx !== -1) {
      this.frameOrder.splice(idx, 1);
      if (this.clockHand > idx) {
        this.clockHand--;
      }
      if (this.frameOrder.length > 0) {
        this.clockHand = this.clockHand % this.frameOrder.length;
      } else {
        this.clockHand = 0;
      }
    }
  }

  size(): number {
    return this.evictableCount;
  }
}
