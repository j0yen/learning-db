/**
 * Filter operator: Passes through rows that match a predicate.
 */

import type { Expr } from '../../sql/ast.js';
import type { Operator, Row, ColumnMeta } from './operator.js';
import { evaluate, buildRowContext } from '../expression-evaluator.js';

export class Filter implements Operator {
  constructor(
    private child: Operator,
    private predicate: Expr,
  ) {}

  open(): void {
    this.child.open();
  }

  next(): Row | null {
    while (true) {
      const row = this.child.next();
      if (!row) return null;

      const ctx = buildRowContext(row.columns, row.values);
      const result = evaluate(this.predicate, ctx);
      if (result === true) return row;
    }
  }

  close(): void {
    this.child.close();
  }

  getColumns(): ColumnMeta[] {
    return this.child.getColumns();
  }
}
