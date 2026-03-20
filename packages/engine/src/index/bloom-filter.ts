/**
 * Bloom Filter: Probabilistic membership test with no false negatives.
 *
 * Used to speed up lookups by avoiding unnecessary disk I/O when a key
 * is definitely not in a set.
 */

import type { Value } from '../types.js';

export class BloomFilter {
  private bits: Uint8Array;
  private numBits: number;
  private numHashes: number;
  private _count = 0;

  /**
   * @param expectedItems Expected number of items
   * @param falsePositiveRate Desired false positive rate (0-1)
   */
  constructor(expectedItems: number, falsePositiveRate: number = 0.01) {
    // Optimal number of bits: -n * ln(p) / (ln(2))^2
    this.numBits = Math.max(
      8,
      Math.ceil((-expectedItems * Math.log(falsePositiveRate)) / (Math.LN2 * Math.LN2)),
    );
    // Optimal number of hash functions: (m/n) * ln(2)
    this.numHashes = Math.max(
      1,
      Math.round((this.numBits / expectedItems) * Math.LN2),
    );
    this.bits = new Uint8Array(Math.ceil(this.numBits / 8));
  }

  /** Add a value to the filter. */
  add(value: Value): void {
    const hashes = this.getHashes(value);
    for (const h of hashes) {
      const idx = h % this.numBits;
      this.bits[Math.floor(idx / 8)] |= 1 << (idx % 8);
    }
    this._count++;
  }

  /** Test if a value might be in the set. false = definitely not, true = maybe. */
  mightContain(value: Value): boolean {
    const hashes = this.getHashes(value);
    for (const h of hashes) {
      const idx = h % this.numBits;
      if ((this.bits[Math.floor(idx / 8)] & (1 << (idx % 8))) === 0) {
        return false;
      }
    }
    return true;
  }

  /** Number of items added. */
  count(): number {
    return this._count;
  }

  /** Estimated false positive rate based on current fill. */
  estimatedFPRate(): number {
    const setBits = this.countSetBits();
    return Math.pow(setBits / this.numBits, this.numHashes);
  }

  /** Number of bits in the filter. */
  getBitCount(): number {
    return this.numBits;
  }

  /** Number of hash functions. */
  getHashCount(): number {
    return this.numHashes;
  }

  /** Reset the filter. */
  clear(): void {
    this.bits.fill(0);
    this._count = 0;
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  /** Generate numHashes hash values using double hashing. */
  private getHashes(value: Value): number[] {
    const str = this.valueToString(value);
    const h1 = this.fnv1a(str);
    const h2 = this.murmurish(str);

    const hashes: number[] = [];
    for (let i = 0; i < this.numHashes; i++) {
      hashes.push(Math.abs((h1 + i * h2) | 0));
    }
    return hashes;
  }

  private valueToString(v: Value): string {
    if (v === null) return '\0null';
    if (typeof v === 'number') return `\0n:${v}`;
    if (typeof v === 'string') return `\0s:${v}`;
    if (typeof v === 'boolean') return `\0b:${v}`;
    return String(v);
  }

  /** FNV-1a hash. */
  private fnv1a(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash;
  }

  /** Simple second hash function for double hashing. */
  private murmurish(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash | 1; // Ensure odd for coprimality
  }

  private countSetBits(): number {
    let count = 0;
    for (const byte of this.bits) {
      let b = byte;
      while (b) {
        count += b & 1;
        b >>>= 1;
      }
    }
    return count;
  }
}
