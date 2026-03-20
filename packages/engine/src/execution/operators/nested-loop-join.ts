/**
 * Nested Loop Join operator: For each row in the outer, scan all rows in the inner.
 */

import type { Expr } from '../../sql/ast.js';
import type { Operator, Row, ColumnMeta } from './operator.js';
import { evaluate, buildRowContext, mergeContexts } from '../expression-evaluator.js';

export class NestedLoopJoin implements Operator {
  private outerRow: Row | null = null;
  private outputColumns: ColumnMeta[] | null = null;
  private joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'CROSS';
  private outerMatched = false;

  constructor(
    private outer: Operator,
    private inner: Operator,
    private condition: Expr | undefined,
    joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'CROSS' = 'INNER',
  ) {
    this.joinType = joinType;
  }

  open(): void {
    this.outer.open();
    this.inner.open();
    this.outerRow = this.outer.next();
    this.outerMatched = false;
    this.outputColumns = [
      ...this.outer.getColumns(),
      ...this.inner.getColumns(),
    ];
  }

  next(): Row | null {
    while (this.outerRow) {
      const innerRow = this.inner.next();

      if (!innerRow) {
        // Inner exhausted for current outer row
        if (this.joinType === 'LEFT' && !this.outerMatched) {
          // Emit outer row with nulls for inner columns
          const nullInner = this.inner.getColumns().map(() => null);
          const row: Row = {
            values: [...this.outerRow.values, ...nullInner],
            columns: this.outputColumns!,
          };
          this.outerRow = this.outer.next();
          this.outerMatched = false;
          this.inner.close();
          this.inner.open();
          return row;
        }

        // Advance outer
        this.outerRow = this.outer.next();
        this.outerMatched = false;
        if (!this.outerRow) return null;
        this.inner.close();
        this.inner.open();
        continue;
      }

      // Build combined row
      const combinedValues = [...this.outerRow.values, ...innerRow.values];

      if (!this.condition) {
        // Cross join or no condition
        this.outerMatched = true;
        return { values: combinedValues, columns: this.outputColumns! };
      }

      // Evaluate join condition
      const outerCtx = buildRowContext(this.outerRow.columns, this.outerRow.values);
      const innerCtx = buildRowContext(innerRow.columns, innerRow.values);
      const ctx = mergeContexts(outerCtx, innerCtx);
      const result = evaluate(this.condition, ctx);

      if (result === true) {
        this.outerMatched = true;
        return { values: combinedValues, columns: this.outputColumns! };
      }
    }

    return null;
  }

  close(): void {
    this.outer.close();
    this.inner.close();
  }

  getColumns(): ColumnMeta[] {
    if (!this.outputColumns) {
      this.outputColumns = [
        ...this.outer.getColumns(),
        ...this.inner.getColumns(),
      ];
    }
    return this.outputColumns;
  }
}
