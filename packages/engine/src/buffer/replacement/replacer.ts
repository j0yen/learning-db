/**
 * Replacer interface for buffer pool page eviction policies.
 */

import type { FrameId } from '../../types.js';

export interface Replacer {
  /** Record that a frame was accessed (pin). */
  recordAccess(frameId: FrameId): void;

  /** Mark a frame as evictable (unpin count reached 0). */
  setEvictable(frameId: FrameId, evictable: boolean): void;

  /** Choose a frame to evict. Returns the frame ID or null if none evictable. */
  evict(): FrameId | null;

  /** Remove a frame from the replacer entirely. */
  remove(frameId: FrameId): void;

  /** Number of evictable frames. */
  size(): number;
}
