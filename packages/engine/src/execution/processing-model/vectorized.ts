/**
 * Vectorized Processing Model: Operators produce batches of rows at a time.
 *
 * Instead of one row at a time (Volcano) or all rows (materialization),
 * operators produce fixed-size batches for better cache utilization.
 */

import type { Operator, Row, ColumnMeta } from '../operators/operator.js';

export interface Batch {
  rows: Row[];
  size: number;
  eof: boolean;
}

export interface VectorizedOperator {
  open(): void;
  nextBatch(): Batch;
  close(): void;
  getColumns(): ColumnMeta[];
}

/**
 * Wraps a Volcano-style operator to produce batches of rows.
 */
export class VectorizedWrapper implements VectorizedOperator {
  private inner: Operator;
  private batchSize: number;

  constructor(inner: Operator, batchSize: number = 1024) {
    this.inner = inner;
    this.batchSize = batchSize;
  }

  open(): void {
    this.inner.open();
  }

  nextBatch(): Batch {
    const rows: Row[] = [];

    for (let i = 0; i < this.batchSize; i++) {
      const row = this.inner.next();
      if (!row) {
        return { rows, size: rows.length, eof: true };
      }
      rows.push(row);
    }

    return { rows, size: rows.length, eof: false };
  }

  close(): void {
    this.inner.close();
  }

  getColumns(): ColumnMeta[] {
    return this.inner.getColumns();
  }

  /** Get batch size configuration. */
  getBatchSize(): number {
    return this.batchSize;
  }
}

/**
 * Adapter: consume a VectorizedOperator as a standard Operator (row-at-a-time).
 */
export class VectorizedToRowAdapter implements Operator {
  private vectorized: VectorizedOperator;
  private currentBatch: Batch | null = null;
  private batchIdx = 0;

  constructor(vectorized: VectorizedOperator) {
    this.vectorized = vectorized;
  }

  open(): void {
    this.vectorized.open();
    this.currentBatch = null;
    this.batchIdx = 0;
  }

  next(): Row | null {
    while (true) {
      if (this.currentBatch && this.batchIdx < this.currentBatch.size) {
        return this.currentBatch.rows[this.batchIdx++];
      }

      if (this.currentBatch?.eof) return null;

      this.currentBatch = this.vectorized.nextBatch();
      this.batchIdx = 0;

      if (this.currentBatch.size === 0 && this.currentBatch.eof) return null;
    }
  }

  close(): void {
    this.vectorized.close();
  }

  getColumns(): ColumnMeta[] {
    return this.vectorized.getColumns();
  }
}

/**
 * Collect all rows from a vectorized operator.
 */
export function collectVectorized(op: VectorizedOperator): Row[] {
  op.open();
  const allRows: Row[] = [];

  while (true) {
    const batch = op.nextBatch();
    allRows.push(...batch.rows);
    if (batch.eof) break;
  }

  op.close();
  return allRows;
}
