/**
 * Common index interface for all index types.
 */

import type { RecordId, Value } from '../types.js';

export interface Index {
  readonly name: string;

  /** Insert a key-value pair. */
  insert(key: Value, rid: RecordId): void;

  /** Delete a key-value pair. */
  delete(key: Value, rid: RecordId): boolean;

  /** Point lookup: find all RecordIds matching the key. */
  search(key: Value): RecordId[];

  /** Range scan: find all RecordIds with keys in [low, high]. */
  rangeScan(low: Value, high: Value): Array<{ key: Value; rid: RecordId }>;

  /** Number of entries in the index. */
  size(): number;
}

/** Compare two Values for ordering. Returns <0, 0, or >0. */
export function compareValues(a: Value, b: Value): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);

  // Mixed types: compare by string representation
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

/** Hash a Value to a non-negative integer. */
export function hashValue(v: Value): number {
  if (v === null) return 0;
  let str: string;
  if (typeof v === 'number') str = `n:${v}`;
  else if (typeof v === 'string') str = `s:${v}`;
  else if (typeof v === 'boolean') str = `b:${v}`;
  else str = String(v);

  // FNV-1a hash
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

/** Check if two RecordIds are equal. */
export function ridEquals(a: RecordId, b: RecordId): boolean {
  return a.pageId.fileId === b.pageId.fileId &&
    a.pageId.pageNum === b.pageId.pageNum &&
    a.slotNum === b.slotNum;
}
