/**
 * TableStatistics: Tracks per-table and per-column statistics for query optimization.
 *
 * - Tuple count
 * - Per-column: distinct value count, min, max, null count
 * - Equi-width histograms for numeric columns
 * - Selectivity estimation for equality and range predicates
 */

import type { Schema, Tuple, Value } from '../types.js';
import { DataType } from '../types.js';
import { compareValues } from '../index/index.js';

export interface ColumnStats {
  distinctCount: number;
  nullCount: number;
  min: Value;
  max: Value;
}

export interface Histogram {
  buckets: number[]; // Count in each bucket
  low: number; // Lower bound
  high: number; // Upper bound
  numBuckets: number;
  bucketWidth: number;
}

export class TableStatistics {
  private tupleCount = 0;
  private columnStats: Map<number, ColumnStats> = new Map();
  private histograms: Map<number, Histogram> = new Map();
  private schema: Schema;

  constructor(schema: Schema) {
    this.schema = schema;
  }

  /** Compute statistics from a full table scan. */
  computeFromTuples(tuples: Iterable<Tuple>, numHistogramBuckets: number = 10): void {
    // Reset
    this.tupleCount = 0;
    this.columnStats.clear();
    this.histograms.clear();

    const numCols = this.schema.columns.length;
    const distinctSets: Set<string>[] = Array.from({ length: numCols }, () => new Set());
    const nullCounts: number[] = new Array(numCols).fill(0);
    const mins: Value[] = new Array(numCols).fill(null);
    const maxs: Value[] = new Array(numCols).fill(null);
    const numericValues: number[][] = Array.from({ length: numCols }, () => []);

    for (const tuple of tuples) {
      this.tupleCount++;

      for (let i = 0; i < numCols; i++) {
        const val = tuple[i];
        if (val === null) {
          nullCounts[i]++;
          continue;
        }

        distinctSets[i].add(String(val));

        if (mins[i] === null || compareValues(val, mins[i]) < 0) mins[i] = val;
        if (maxs[i] === null || compareValues(val, maxs[i]) > 0) maxs[i] = val;

        const col = this.schema.columns[i];
        if (col.type === DataType.INTEGER || col.type === DataType.FLOAT) {
          numericValues[i].push(val as number);
        }
      }
    }

    // Store column stats
    for (let i = 0; i < numCols; i++) {
      this.columnStats.set(i, {
        distinctCount: distinctSets[i].size,
        nullCount: nullCounts[i],
        min: mins[i],
        max: maxs[i],
      });

      // Build histograms for numeric columns
      if (numericValues[i].length > 0) {
        this.histograms.set(
          i,
          this.buildHistogram(numericValues[i], numHistogramBuckets),
        );
      }
    }
  }

  /** Get total tuple count. */
  getTupleCount(): number {
    return this.tupleCount;
  }

  /** Get stats for a column. */
  getColumnStats(columnIndex: number): ColumnStats | undefined {
    return this.columnStats.get(columnIndex);
  }

  /** Get histogram for a column. */
  getHistogram(columnIndex: number): Histogram | undefined {
    return this.histograms.get(columnIndex);
  }

  // ─── Selectivity Estimation ────────────────────────────────────────────

  /** Estimate selectivity for equality predicate (col = value). */
  estimateEqualitySelectivity(columnIndex: number, _value: Value): number {
    if (this.tupleCount === 0) return 0;

    const stats = this.columnStats.get(columnIndex);
    if (!stats || stats.distinctCount === 0) return 0;

    // Uniform assumption: 1 / distinctCount
    return 1 / stats.distinctCount;
  }

  /** Estimate selectivity for range predicate (low <= col <= high). */
  estimateRangeSelectivity(
    columnIndex: number,
    low: Value | null,
    high: Value | null,
  ): number {
    if (this.tupleCount === 0) return 0;

    const histogram = this.histograms.get(columnIndex);
    const stats = this.columnStats.get(columnIndex);

    if (!stats) return 0.5; // No stats — default 50%

    // If no histogram, use min/max range estimation
    if (!histogram || typeof stats.min !== 'number' || typeof stats.max !== 'number') {
      return this.estimateRangeWithoutHistogram(stats, low, high);
    }

    return this.estimateRangeWithHistogram(histogram, low, high);
  }

  /** Estimate number of output tuples for a scan with selectivity. */
  estimateCardinality(selectivity: number): number {
    return Math.max(1, Math.round(this.tupleCount * selectivity));
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  private buildHistogram(values: number[], numBuckets: number): Histogram {
    const low = Math.min(...values);
    const high = Math.max(...values);

    if (low === high) {
      return { buckets: [values.length], low, high, numBuckets: 1, bucketWidth: 1 };
    }

    const bucketWidth = (high - low) / numBuckets;
    const buckets = new Array(numBuckets).fill(0);

    for (const v of values) {
      let idx = Math.floor((v - low) / bucketWidth);
      if (idx >= numBuckets) idx = numBuckets - 1; // Clamp high boundary
      buckets[idx]++;
    }

    return { buckets, low, high, numBuckets, bucketWidth };
  }

  private estimateRangeWithoutHistogram(
    stats: ColumnStats,
    low: Value | null,
    high: Value | null,
  ): number {
    if (typeof stats.min !== 'number' || typeof stats.max !== 'number') return 0.5;

    const rangeMin = stats.min;
    const rangeMax = stats.max;
    const totalRange = rangeMax - rangeMin;
    if (totalRange === 0) return 1;

    const lo = low !== null && typeof low === 'number' ? Math.max(low, rangeMin) : rangeMin;
    const hi = high !== null && typeof high === 'number' ? Math.min(high, rangeMax) : rangeMax;

    if (lo > hi) return 0;
    return (hi - lo) / totalRange;
  }

  private estimateRangeWithHistogram(
    histogram: Histogram,
    low: Value | null,
    high: Value | null,
  ): number {
    const lo = low !== null && typeof low === 'number' ? low : histogram.low;
    const hi = high !== null && typeof high === 'number' ? high : histogram.high;

    if (lo > hi) return 0;

    const totalCount = histogram.buckets.reduce((a, b) => a + b, 0);
    if (totalCount === 0) return 0;

    let matchCount = 0;

    for (let i = 0; i < histogram.numBuckets; i++) {
      const bucketLow = histogram.low + i * histogram.bucketWidth;
      const bucketHigh = bucketLow + histogram.bucketWidth;

      // Fraction of this bucket covered by the range
      const overlapLow = Math.max(lo, bucketLow);
      const overlapHigh = Math.min(hi, bucketHigh);

      if (overlapLow < overlapHigh) {
        const fraction = (overlapHigh - overlapLow) / histogram.bucketWidth;
        matchCount += histogram.buckets[i] * fraction;
      }
    }

    return matchCount / totalCount;
  }
}
