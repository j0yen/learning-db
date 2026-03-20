/**
 * Linear Probe Hash Index: Open addressing with linear probing.
 * Resizes when load factor exceeds threshold.
 */

import type { RecordId, Value } from '../../types.js';
import { type Index, compareValues, hashValue, ridEquals } from '../index.js';

interface Slot {
  key: Value;
  rid: RecordId;
  occupied: boolean;
  deleted: boolean; // Tombstone for lazy deletion
}

export class LinearProbeHashIndex implements Index {
  readonly name: string;
  private slots: Slot[];
  private capacity: number;
  private _size = 0;
  private loadFactorThreshold = 0.7;

  constructor(name: string, initialCapacity: number = 64) {
    this.name = name;
    this.capacity = initialCapacity;
    this.slots = this.createSlots(initialCapacity);
  }

  insert(key: Value, rid: RecordId): void {
    if (this._size / this.capacity >= this.loadFactorThreshold) {
      this.resize(this.capacity * 2);
    }

    let idx = hashValue(key) % this.capacity;
    while (this.slots[idx].occupied && !this.slots[idx].deleted) {
      idx = (idx + 1) % this.capacity;
    }

    this.slots[idx] = { key, rid, occupied: true, deleted: false };
    this._size++;
  }

  delete(key: Value, rid: RecordId): boolean {
    let idx = hashValue(key) % this.capacity;
    let probes = 0;

    while (probes < this.capacity) {
      const slot = this.slots[idx];
      if (!slot.occupied && !slot.deleted) return false; // Empty slot = not found

      if (
        slot.occupied &&
        !slot.deleted &&
        compareValues(slot.key, key) === 0 &&
        ridEquals(slot.rid, rid)
      ) {
        slot.deleted = true; // Tombstone
        this._size--;
        return true;
      }

      idx = (idx + 1) % this.capacity;
      probes++;
    }

    return false;
  }

  search(key: Value): RecordId[] {
    const results: RecordId[] = [];
    let idx = hashValue(key) % this.capacity;
    let probes = 0;

    while (probes < this.capacity) {
      const slot = this.slots[idx];
      if (!slot.occupied && !slot.deleted) break; // Empty slot = end of cluster

      if (slot.occupied && !slot.deleted && compareValues(slot.key, key) === 0) {
        results.push(slot.rid);
      }

      idx = (idx + 1) % this.capacity;
      probes++;
    }

    return results;
  }

  rangeScan(low: Value, high: Value): Array<{ key: Value; rid: RecordId }> {
    const results: Array<{ key: Value; rid: RecordId }> = [];
    for (const slot of this.slots) {
      if (
        slot.occupied &&
        !slot.deleted &&
        compareValues(slot.key, low) >= 0 &&
        compareValues(slot.key, high) <= 0
      ) {
        results.push({ key: slot.key, rid: slot.rid });
      }
    }
    return results;
  }

  size(): number {
    return this._size;
  }

  private resize(newCapacity: number): void {
    const oldSlots = this.slots;
    this.capacity = newCapacity;
    this.slots = this.createSlots(newCapacity);
    this._size = 0;

    for (const slot of oldSlots) {
      if (slot.occupied && !slot.deleted) {
        this.insert(slot.key, slot.rid);
      }
    }
  }

  private createSlots(capacity: number): Slot[] {
    return Array.from({ length: capacity }, () => ({
      key: null,
      rid: { pageId: { fileId: 0, pageNum: 0 }, slotNum: 0 },
      occupied: false,
      deleted: false,
    }));
  }
}
