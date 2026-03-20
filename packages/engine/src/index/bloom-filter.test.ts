import { describe, it, expect } from 'vitest';
import { BloomFilter } from './bloom-filter.js';

describe('BloomFilter', () => {
  it('should report no false negatives', () => {
    const bf = new BloomFilter(100, 0.01);
    for (let i = 0; i < 100; i++) {
      bf.add(i);
    }

    // All inserted values must be found
    for (let i = 0; i < 100; i++) {
      expect(bf.mightContain(i)).toBe(true);
    }
  });

  it('should have low false positive rate', () => {
    const bf = new BloomFilter(1000, 0.01);
    for (let i = 0; i < 1000; i++) {
      bf.add(i);
    }

    // Test 1000 values NOT in the filter
    let falsePositives = 0;
    for (let i = 1000; i < 2000; i++) {
      if (bf.mightContain(i)) falsePositives++;
    }

    // Allow up to 5% false positives (target is 1%)
    expect(falsePositives / 1000).toBeLessThan(0.05);
  });

  it('should handle string values', () => {
    const bf = new BloomFilter(100, 0.01);
    bf.add('hello');
    bf.add('world');

    expect(bf.mightContain('hello')).toBe(true);
    expect(bf.mightContain('world')).toBe(true);
  });

  it('should handle null values', () => {
    const bf = new BloomFilter(100, 0.01);
    bf.add(null);
    expect(bf.mightContain(null)).toBe(true);
  });

  it('should handle boolean values', () => {
    const bf = new BloomFilter(100, 0.01);
    bf.add(true);
    expect(bf.mightContain(true)).toBe(true);
    // false might or might not be a false positive — just check no crash
    bf.mightContain(false);
  });

  it('should track count', () => {
    const bf = new BloomFilter(100, 0.01);
    expect(bf.count()).toBe(0);
    bf.add(1);
    bf.add(2);
    expect(bf.count()).toBe(2);
  });

  it('should clear', () => {
    const bf = new BloomFilter(100, 0.01);
    bf.add(1);
    bf.add(2);
    bf.clear();
    expect(bf.count()).toBe(0);
    // After clear, items should not be found (barring weird hash collisions)
    // This is technically possible but extremely unlikely with good hashing
    expect(bf.mightContain(1)).toBe(false);
  });

  it('should report configuration', () => {
    const bf = new BloomFilter(1000, 0.01);
    expect(bf.getBitCount()).toBeGreaterThan(0);
    expect(bf.getHashCount()).toBeGreaterThan(0);
  });

  it('should estimate false positive rate', () => {
    const bf = new BloomFilter(100, 0.01);
    expect(bf.estimatedFPRate()).toBe(0); // Empty filter

    for (let i = 0; i < 100; i++) {
      bf.add(i);
    }
    expect(bf.estimatedFPRate()).toBeGreaterThan(0);
    expect(bf.estimatedFPRate()).toBeLessThan(0.1);
  });
});
