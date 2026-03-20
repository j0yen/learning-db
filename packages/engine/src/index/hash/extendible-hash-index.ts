/**
 * Extendible Hash Index: Dynamic hashing with directory doubling.
 *
 * - Global directory of 2^globalDepth pointers
 * - Each bucket has a local depth
 * - On overflow: split bucket and potentially double directory
 */

import type { RecordId, Value } from '../../types.js';
import { type Index, compareValues, hashValue, ridEquals } from '../index.js';

interface Entry {
  key: Value;
  rid: RecordId;
}

interface Bucket {
  localDepth: number;
  entries: Entry[];
}

export class ExtendibleHashIndex implements Index {
  readonly name: string;
  private globalDepth: number;
  private directory: Bucket[];
  private bucketCapacity: number;
  private _size = 0;

  constructor(name: string, bucketCapacity: number = 4, initialDepth: number = 1) {
    this.name = name;
    this.bucketCapacity = bucketCapacity;
    this.globalDepth = initialDepth;

    const numBuckets = 1 << initialDepth;
    this.directory = [];
    for (let i = 0; i < numBuckets; i++) {
      this.directory.push({ localDepth: initialDepth, entries: [] });
    }
  }

  insert(key: Value, rid: RecordId): void {
    const hash = hashValue(key);
    const bucketIdx = this.getBucketIdx(hash);
    const bucket = this.directory[bucketIdx];

    if (bucket.entries.length < this.bucketCapacity) {
      bucket.entries.push({ key, rid });
      this._size++;
      return;
    }

    // Bucket is full — need to split
    if (bucket.localDepth === this.globalDepth) {
      this.doubleDirectory();
    }

    this.splitBucket(this.getBucketIdx(hash));

    // Retry insert after split
    this.insert(key, rid);
  }

  delete(key: Value, rid: RecordId): boolean {
    const hash = hashValue(key);
    const bucketIdx = this.getBucketIdx(hash);
    const bucket = this.directory[bucketIdx];

    const idx = bucket.entries.findIndex(
      (e) => compareValues(e.key, key) === 0 && ridEquals(e.rid, rid),
    );
    if (idx === -1) return false;

    bucket.entries.splice(idx, 1);
    this._size--;
    return true;
  }

  search(key: Value): RecordId[] {
    const hash = hashValue(key);
    const bucketIdx = this.getBucketIdx(hash);
    const bucket = this.directory[bucketIdx];

    return bucket.entries
      .filter((e) => compareValues(e.key, key) === 0)
      .map((e) => e.rid);
  }

  rangeScan(low: Value, high: Value): Array<{ key: Value; rid: RecordId }> {
    const results: Array<{ key: Value; rid: RecordId }> = [];
    const seen = new Set<Bucket>();

    for (const bucket of this.directory) {
      if (seen.has(bucket)) continue;
      seen.add(bucket);

      for (const entry of bucket.entries) {
        if (compareValues(entry.key, low) >= 0 && compareValues(entry.key, high) <= 0) {
          results.push({ key: entry.key, rid: entry.rid });
        }
      }
    }

    return results;
  }

  size(): number {
    return this._size;
  }

  /** Get the global depth. */
  getGlobalDepth(): number {
    return this.globalDepth;
  }

  /** Get the number of directory entries. */
  getDirectorySize(): number {
    return this.directory.length;
  }

  /** Get the number of distinct buckets. */
  getNumBuckets(): number {
    const seen = new Set<Bucket>();
    for (const bucket of this.directory) {
      seen.add(bucket);
    }
    return seen.size;
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  private getBucketIdx(hash: number): number {
    return hash & ((1 << this.globalDepth) - 1);
  }

  private doubleDirectory(): void {
    const oldSize = this.directory.length;
    this.globalDepth++;
    // Each new entry points to the same bucket as its counterpart
    for (let i = 0; i < oldSize; i++) {
      this.directory.push(this.directory[i]);
    }
  }

  private splitBucket(bucketIdx: number): void {
    const oldBucket = this.directory[bucketIdx];
    const newLocalDepth = oldBucket.localDepth + 1;

    const newBucket: Bucket = { localDepth: newLocalDepth, entries: [] };
    oldBucket.localDepth = newLocalDepth;

    // Redistribute entries
    const entries = [...oldBucket.entries];
    oldBucket.entries = [];

    const bit = 1 << (newLocalDepth - 1);

    for (const entry of entries) {
      const hash = hashValue(entry.key);
      if (hash & bit) {
        newBucket.entries.push(entry);
      } else {
        oldBucket.entries.push(entry);
      }
    }

    // Update directory pointers
    for (let i = 0; i < this.directory.length; i++) {
      if (this.directory[i] === oldBucket) {
        const hash = i;
        if (hash & bit) {
          this.directory[i] = newBucket;
        }
      }
    }
  }
}
