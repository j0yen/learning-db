/**
 * Chained Hash Index: Each bucket is a linked list of entries.
 * Simple, no resizing — fixed number of buckets.
 */

import type { RecordId, Value } from '../../types.js';
import { type Index, compareValues, hashValue, ridEquals } from '../index.js';

interface Entry {
  key: Value;
  rid: RecordId;
}

export class ChainedHashIndex implements Index {
  readonly name: string;
  private buckets: Entry[][];
  private numBuckets: number;
  private _size = 0;

  constructor(name: string, numBuckets: number = 64) {
    this.name = name;
    this.numBuckets = numBuckets;
    this.buckets = Array.from({ length: numBuckets }, () => []);
  }

  insert(key: Value, rid: RecordId): void {
    const bucket = this.getBucket(key);
    this.buckets[bucket].push({ key, rid });
    this._size++;
  }

  delete(key: Value, rid: RecordId): boolean {
    const bucket = this.getBucket(key);
    const chain = this.buckets[bucket];
    const idx = chain.findIndex(
      (e) => compareValues(e.key, key) === 0 && ridEquals(e.rid, rid),
    );
    if (idx === -1) return false;
    chain.splice(idx, 1);
    this._size--;
    return true;
  }

  search(key: Value): RecordId[] {
    const bucket = this.getBucket(key);
    return this.buckets[bucket]
      .filter((e) => compareValues(e.key, key) === 0)
      .map((e) => e.rid);
  }

  rangeScan(_low: Value, _high: Value): Array<{ key: Value; rid: RecordId }> {
    // Hash indexes don't support efficient range scans — full scan required
    const results: Array<{ key: Value; rid: RecordId }> = [];
    for (const chain of this.buckets) {
      for (const entry of chain) {
        if (compareValues(entry.key, _low) >= 0 && compareValues(entry.key, _high) <= 0) {
          results.push({ key: entry.key, rid: entry.rid });
        }
      }
    }
    return results;
  }

  size(): number {
    return this._size;
  }

  /** Get load factor (entries / buckets). */
  loadFactor(): number {
    return this._size / this.numBuckets;
  }

  private getBucket(key: Value): number {
    return hashValue(key) % this.numBuckets;
  }
}
