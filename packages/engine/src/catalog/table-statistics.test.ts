import { describe, it, expect } from 'vitest';
import { TableStatistics } from './table-statistics.js';
import { DataType } from '../types.js';
import type { Schema, Tuple } from '../types.js';

const schema: Schema = {
  columns: [
    { name: 'id', type: DataType.INTEGER, nullable: false },
    { name: 'name', type: DataType.VARCHAR, maxLength: 100, nullable: false },
    { name: 'score', type: DataType.FLOAT, nullable: true },
  ],
};

function generateTuples(n: number): Tuple[] {
  const tuples: Tuple[] = [];
  for (let i = 0; i < n; i++) {
    tuples.push([
      i,
      `name_${i % 10}`, // 10 distinct names
      i < n * 0.1 ? null : (i % 100) * 0.5, // 10% nulls, 50 distinct scores
    ]);
  }
  return tuples;
}

describe('TableStatistics', () => {
  it('should compute basic stats', () => {
    const stats = new TableStatistics(schema);
    stats.computeFromTuples(generateTuples(100));

    expect(stats.getTupleCount()).toBe(100);
  });

  it('should track column distinct counts', () => {
    const stats = new TableStatistics(schema);
    stats.computeFromTuples(generateTuples(100));

    const idStats = stats.getColumnStats(0);
    expect(idStats).toBeDefined();
    expect(idStats!.distinctCount).toBe(100); // All unique IDs

    const nameStats = stats.getColumnStats(1);
    expect(nameStats).toBeDefined();
    expect(nameStats!.distinctCount).toBe(10); // 10 distinct names
  });

  it('should track null counts', () => {
    const stats = new TableStatistics(schema);
    stats.computeFromTuples(generateTuples(100));

    const scoreStats = stats.getColumnStats(2);
    expect(scoreStats).toBeDefined();
    expect(scoreStats!.nullCount).toBe(10); // 10% nulls
  });

  it('should track min/max', () => {
    const stats = new TableStatistics(schema);
    stats.computeFromTuples(generateTuples(100));

    const idStats = stats.getColumnStats(0)!;
    expect(idStats.min).toBe(0);
    expect(idStats.max).toBe(99);
  });

  it('should build histograms for numeric columns', () => {
    const stats = new TableStatistics(schema);
    stats.computeFromTuples(generateTuples(100));

    const idHist = stats.getHistogram(0);
    expect(idHist).toBeDefined();
    expect(idHist!.numBuckets).toBe(10);
    expect(idHist!.low).toBe(0);
    expect(idHist!.high).toBe(99);

    // Total counts should match non-null values
    const total = idHist!.buckets.reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it('should not build histograms for VARCHAR columns', () => {
    const stats = new TableStatistics(schema);
    stats.computeFromTuples(generateTuples(100));
    expect(stats.getHistogram(1)).toBeUndefined();
  });

  it('should estimate equality selectivity', () => {
    const stats = new TableStatistics(schema);
    stats.computeFromTuples(generateTuples(100));

    const sel = stats.estimateEqualitySelectivity(0, 42);
    expect(sel).toBeCloseTo(1 / 100, 2); // 100 distinct IDs → 1%

    const nameSel = stats.estimateEqualitySelectivity(1, 'name_0');
    expect(nameSel).toBeCloseTo(1 / 10, 2); // 10 distinct names → 10%
  });

  it('should estimate range selectivity with histogram', () => {
    const stats = new TableStatistics(schema);
    stats.computeFromTuples(generateTuples(1000), 10);

    // Range covering roughly half the values
    const sel = stats.estimateRangeSelectivity(0, 0, 499);
    expect(sel).toBeGreaterThan(0.4);
    expect(sel).toBeLessThan(0.6);
  });

  it('should estimate cardinality', () => {
    const stats = new TableStatistics(schema);
    stats.computeFromTuples(generateTuples(1000));

    const card = stats.estimateCardinality(0.1);
    expect(card).toBe(100);
  });

  it('should handle empty table', () => {
    const stats = new TableStatistics(schema);
    stats.computeFromTuples([]);

    expect(stats.getTupleCount()).toBe(0);
    expect(stats.estimateEqualitySelectivity(0, 1)).toBe(0);
    expect(stats.estimateRangeSelectivity(0, 0, 100)).toBe(0);
  });

  it('should handle single-value column', () => {
    const stats = new TableStatistics(schema);
    const tuples: Tuple[] = Array.from({ length: 10 }, () => [42, 'same', 1.0]);
    stats.computeFromTuples(tuples);

    const idStats = stats.getColumnStats(0)!;
    expect(idStats.distinctCount).toBe(1);
    expect(idStats.min).toBe(42);
    expect(idStats.max).toBe(42);
  });
});
