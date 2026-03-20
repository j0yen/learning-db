/**
 * Project operator: Evaluates expressions to produce output columns.
 */

import type { Expr } from '../../sql/ast.js';
import type { Operator, Row, ColumnMeta } from './operator.js';
import { evaluate, buildRowContext } from '../expression-evaluator.js';

export interface ProjectionExpr {
  expr: Expr;
  alias?: string;
}

export class Project implements Operator {
  private outputColumns: ColumnMeta[] | null = null;

  constructor(
    private child: Operator,
    private projections: ProjectionExpr[],
  ) {}

  open(): void {
    this.child.open();
    this.outputColumns = this.projections.map((p, i) => ({
      name: p.alias ?? this.inferName(p.expr, i),
    }));
  }

  next(): Row | null {
    const row = this.child.next();
    if (!row) return null;

    const ctx = buildRowContext(row.columns, row.values);
    const values = this.projections.map((p) => evaluate(p.expr, ctx));
    return { values, columns: this.outputColumns! };
  }

  close(): void {
    this.child.close();
  }

  getColumns(): ColumnMeta[] {
    if (!this.outputColumns) {
      this.outputColumns = this.projections.map((p, i) => ({
        name: p.alias ?? this.inferName(p.expr, i),
      }));
    }
    return this.outputColumns;
  }

  private inferName(expr: Expr, index: number): string {
    if (expr.type === 'column_ref') return expr.column;
    if (expr.type === 'function') return `${expr.name.toLowerCase()}`;
    return `col${index}`;
  }
}
