/**
 * LRU Replacer: Evicts the least recently used frame.
 * Uses a doubly-linked list for O(1) eviction and access recording.
 */

import type { FrameId } from '../../types.js';
import type { Replacer } from './replacer.js';

interface LRUNode {
  frameId: FrameId;
  prev: LRUNode | null;
  next: LRUNode | null;
  evictable: boolean;
}

export class LRUReplacer implements Replacer {
  private nodes: Map<FrameId, LRUNode> = new Map();
  // Sentinel nodes for the doubly-linked list
  private head: LRUNode; // Most recently used
  private tail: LRUNode; // Least recently used
  private evictableCount = 0;

  constructor() {
    this.head = { frameId: -1, prev: null, next: null, evictable: false };
    this.tail = { frameId: -2, prev: null, next: null, evictable: false };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  recordAccess(frameId: FrameId): void {
    let node = this.nodes.get(frameId);
    if (node) {
      // Move to front (most recently used)
      this.removeNode(node);
      this.addToFront(node);
    } else {
      // New frame, add to front
      node = { frameId, prev: null, next: null, evictable: false };
      this.nodes.set(frameId, node);
      this.addToFront(node);
    }
  }

  setEvictable(frameId: FrameId, evictable: boolean): void {
    const node = this.nodes.get(frameId);
    if (!node) return;

    if (node.evictable !== evictable) {
      node.evictable = evictable;
      this.evictableCount += evictable ? 1 : -1;
    }
  }

  evict(): FrameId | null {
    // Walk from tail (LRU end) to find first evictable frame
    let current = this.tail.prev;
    while (current && current !== this.head) {
      if (current.evictable) {
        const frameId = current.frameId;
        this.remove(frameId);
        return frameId;
      }
      current = current.prev;
    }
    return null;
  }

  remove(frameId: FrameId): void {
    const node = this.nodes.get(frameId);
    if (!node) return;

    if (node.evictable) {
      this.evictableCount--;
    }
    this.removeNode(node);
    this.nodes.delete(frameId);
  }

  size(): number {
    return this.evictableCount;
  }

  // ─── Linked List Helpers ────────────────────────────────────────────────

  private addToFront(node: LRUNode): void {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: LRUNode): void {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    node.prev = null;
    node.next = null;
  }
}
