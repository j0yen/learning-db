/**
 * Skip List: Probabilistic balanced structure with O(log n) operations.
 * Supports point lookup and range scans.
 */

import type { RecordId, Value } from '../types.js';
import { type Index, compareValues, ridEquals } from './index.js';

interface SkipListNode {
  key: Value;
  rids: RecordId[]; // Multiple RIDs per key (duplicates)
  forward: (SkipListNode | null)[];
}

export class SkipList implements Index {
  readonly name: string;
  private head: SkipListNode;
  private maxLevel: number;
  private level = 0; // Current highest level
  private _size = 0;
  private probability: number;

  constructor(name: string, maxLevel: number = 16, probability: number = 0.5) {
    this.name = name;
    this.maxLevel = maxLevel;
    this.probability = probability;
    this.head = {
      key: null,
      rids: [],
      forward: new Array(maxLevel).fill(null),
    };
  }

  insert(key: Value, rid: RecordId): void {
    const update: (SkipListNode | null)[] = new Array(this.maxLevel).fill(null);
    let current = this.head;

    // Find position at each level
    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] && compareValues(current.forward[i]!.key, key) < 0) {
        current = current.forward[i]!;
      }
      update[i] = current;
    }

    const next = current.forward[0];

    // If key already exists, add RID to existing node
    if (next && compareValues(next.key, key) === 0) {
      next.rids.push(rid);
      this._size++;
      return;
    }

    // Create new node with random level
    const newLevel = this.randomLevel();
    if (newLevel > this.level) {
      for (let i = this.level + 1; i <= newLevel; i++) {
        update[i] = this.head;
      }
      this.level = newLevel;
    }

    const newNode: SkipListNode = {
      key,
      rids: [rid],
      forward: new Array(this.maxLevel).fill(null),
    };

    for (let i = 0; i <= newLevel; i++) {
      newNode.forward[i] = update[i]!.forward[i];
      update[i]!.forward[i] = newNode;
    }

    this._size++;
  }

  delete(key: Value, rid: RecordId): boolean {
    const update: (SkipListNode | null)[] = new Array(this.maxLevel).fill(null);
    let current = this.head;

    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] && compareValues(current.forward[i]!.key, key) < 0) {
        current = current.forward[i]!;
      }
      update[i] = current;
    }

    const target = current.forward[0];
    if (!target || compareValues(target.key, key) !== 0) return false;

    // Remove specific RID
    const ridIdx = target.rids.findIndex((r) => ridEquals(r, rid));
    if (ridIdx === -1) return false;

    target.rids.splice(ridIdx, 1);
    this._size--;

    // If no more RIDs, remove the node entirely
    if (target.rids.length === 0) {
      for (let i = 0; i <= this.level; i++) {
        if (update[i]!.forward[i] !== target) break;
        update[i]!.forward[i] = target.forward[i];
      }

      while (this.level > 0 && !this.head.forward[this.level]) {
        this.level--;
      }
    }

    return true;
  }

  search(key: Value): RecordId[] {
    let current = this.head;
    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] && compareValues(current.forward[i]!.key, key) < 0) {
        current = current.forward[i]!;
      }
    }

    const target = current.forward[0];
    if (target && compareValues(target.key, key) === 0) {
      return [...target.rids];
    }
    return [];
  }

  rangeScan(low: Value, high: Value): Array<{ key: Value; rid: RecordId }> {
    const results: Array<{ key: Value; rid: RecordId }> = [];

    // Find the first node >= low
    let current = this.head;
    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] && compareValues(current.forward[i]!.key, low) < 0) {
        current = current.forward[i]!;
      }
    }

    current = current.forward[0]!;

    // Scan forward at level 0
    while (current && compareValues(current.key, high) <= 0) {
      for (const rid of current.rids) {
        results.push({ key: current.key, rid });
      }
      current = current.forward[0]!;
    }

    return results;
  }

  size(): number {
    return this._size;
  }

  private randomLevel(): number {
    let lvl = 0;
    while (Math.random() < this.probability && lvl < this.maxLevel - 1) {
      lvl++;
    }
    return lvl;
  }
}
