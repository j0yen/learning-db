/**
 * Sort operator: Materializes all input, sorts, then emits rows.
 */

import type { OrderByItem } from '../../sql/ast.js';
import type { Operator, Row, ColumnMeta } from './operator.js';
import { evaluate, buildRowContext } from '../expression-evaluator.js';
import { compareValues } from '../../index/index.js';

export class Sort implements Operator {
  private sorted: Row[] = [];
  private idx = 0;

  constructor(
    private child: Operator,
    private orderBy: OrderByItem[],
  ) {}

  open(): void {
    this.child.open();
    this.sorted = [];
    this.idx = 0;

    let row: Row | null;
    while ((row = this.child.next())) {
      this.sorted.push(row);
    }
    this.child.close();

    this.sorted.sort((a, b) => {
      for (const item of this.orderBy) {
        const ctxA = buildRowContext(a.columns, a.values);
        const ctxB = buildRowContext(b.columns, b.values);
        const valA = evaluate(item.expr, ctxA);
        const valB = evaluate(item.expr, ctxB);
        const cmp = compareValues(valA, valB);
        if (cmp !== 0) return item.direction === 'DESC' ? -cmp : cmp;
      }
      return 0;
    });
  }

  next(): Row | null {
    if (this.idx >= this.sorted.length) return null;
    return this.sorted[this.idx++];
  }

  close(): void {
    this.sorted = [];
    this.idx = 0;
  }

  getColumns(): ColumnMeta[] {
    return this.child.getColumns();
  }
}
