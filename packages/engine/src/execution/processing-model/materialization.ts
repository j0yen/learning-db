/**
 * Materialization Processing Model: Each operator produces ALL output at once.
 *
 * Wraps a Volcano-style operator tree and materializes results bottom-up.
 * Each node computes its full result before passing to the parent.
 */

import type { Operator, Row, ColumnMeta } from '../operators/operator.js';

export class MaterializationWrapper implements Operator {
  private results: Row[] = [];
  private idx = 0;

  constructor(private inner: Operator) {}

  open(): void {
    this.inner.open();
    this.results = [];
    this.idx = 0;

    // Materialize all results eagerly
    let row: Row | null;
    while ((row = this.inner.next())) {
      this.results.push(row);
    }
    this.inner.close();
  }

  next(): Row | null {
    if (this.idx >= this.results.length) return null;
    return this.results[this.idx++];
  }

  close(): void {
    this.results = [];
    this.idx = 0;
  }

  getColumns(): ColumnMeta[] {
    return this.inner.getColumns();
  }

  /** Get all materialized rows (for debugging / visualization). */
  getAllRows(): Row[] {
    return this.results;
  }
}

/**
 * Wrap an entire operator tree in materialization.
 * Each operator materializes its full output before passing up.
 */
export function materializeTree(root: Operator): MaterializationWrapper {
  return new MaterializationWrapper(root);
}
