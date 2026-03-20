/**
 * Operator: Base interface for Volcano (iterator) execution model.
 *
 * Each operator produces rows one at a time via next().
 * A "Row" is an array of Values with associated column metadata.
 */

import type { Value } from '../../types.js';

export interface ColumnMeta {
  name: string;
  table?: string;
}

export interface Row {
  values: Value[];
  columns: ColumnMeta[];
}

export interface Operator {
  /** Initialize the operator (open cursors, etc.) */
  open(): void;

  /** Get the next row, or null if exhausted. */
  next(): Row | null;

  /** Clean up resources. */
  close(): void;

  /** Get output column metadata. */
  getColumns(): ColumnMeta[];
}
