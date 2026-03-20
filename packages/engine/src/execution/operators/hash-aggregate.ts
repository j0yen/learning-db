/**
 * Hash Aggregate operator: Groups rows by key and computes aggregates.
 */

import type { Expr } from '../../sql/ast.js';
import type { Operator, Row, ColumnMeta } from './operator.js';
import { evaluate, buildRowContext } from '../expression-evaluator.js';
import type { Value } from '../../types.js';

interface AggState {
  count: number;
  sum: number;
  min: Value;
  max: Value;
  values: Value[]; // For distinct
}

interface GroupEntry {
  groupKey: Value[];
  aggStates: AggState[];
}

export class HashAggregate implements Operator {
  private groups: Map<string, GroupEntry> = new Map();
  private resultIterator: Iterator<GroupEntry> | null = null;
  private outputColumns: ColumnMeta[];

  constructor(
    private child: Operator,
    private groupByExprs: Expr[],
    private aggregateExprs: Array<{ expr: Expr; alias?: string }>,
  ) {
    this.outputColumns = aggregateExprs.map((a, i) => ({
      name: a.alias ?? this.inferName(a.expr, i),
    }));
  }

  open(): void {
    this.child.open();
    this.groups.clear();

    let row: Row | null;
    while ((row = this.child.next())) {
      const ctx = buildRowContext(row.columns, row.values);
      const groupKey = this.groupByExprs.map((e) => evaluate(e, ctx));
      const keyStr = JSON.stringify(groupKey);

      let entry = this.groups.get(keyStr);
      if (!entry) {
        entry = {
          groupKey,
          aggStates: this.aggregateExprs.map(() => ({
            count: 0, sum: 0, min: null, max: null, values: [],
          })),
        };
        this.groups.set(keyStr, entry);
      }

      // Update aggregate states
      for (let i = 0; i < this.aggregateExprs.length; i++) {
        const aggExpr = this.aggregateExprs[i].expr;
        this.updateAggState(entry.aggStates[i], aggExpr, ctx);
      }
    }

    this.child.close();

    // Handle empty input with no group-by (return single row with defaults)
    if (this.groups.size === 0 && this.groupByExprs.length === 0) {
      const entry: GroupEntry = {
        groupKey: [],
        aggStates: this.aggregateExprs.map(() => ({
          count: 0, sum: 0, min: null, max: null, values: [],
        })),
      };
      this.groups.set('[]', entry);
    }

    this.resultIterator = this.groups.values();
  }

  next(): Row | null {
    if (!this.resultIterator) return null;
    const result = this.resultIterator.next();
    if (result.done) return null;

    const entry = result.value;
    const values = this.aggregateExprs.map((agg, i) =>
      this.finalizeAgg(entry.aggStates[i], agg.expr),
    );

    return { values, columns: this.outputColumns };
  }

  close(): void {
    this.groups.clear();
    this.resultIterator = null;
  }

  getColumns(): ColumnMeta[] {
    return this.outputColumns;
  }

  private updateAggState(state: AggState, expr: Expr, ctx: Map<string, Value>): void {
    if (expr.type === 'function') {
      const argExpr = expr.args[0];
      const val = argExpr?.type === 'star' ? 1 : evaluate(argExpr, ctx);
      const name = expr.name.toUpperCase();

      if (name === 'COUNT') {
        if (argExpr?.type === 'star' || val !== null) {
          state.count++;
        }
      } else if (val !== null && typeof val === 'number') {
        state.count++;
        state.sum += val;
        if (state.min === null || val < (state.min as number)) state.min = val;
        if (state.max === null || val > (state.max as number)) state.max = val;
      } else if (val !== null) {
        state.count++;
        if (name === 'MIN' && (state.min === null || String(val) < String(state.min))) state.min = val;
        if (name === 'MAX' && (state.max === null || String(val) > String(state.max))) state.max = val;
      }
    } else {
      // Non-aggregate expression in aggregate context (e.g., group-by column)
      const val = evaluate(expr, ctx);
      state.min = val; // Just track the value
      state.count = 1;
    }
  }

  private finalizeAgg(state: AggState, expr: Expr): Value {
    if (expr.type === 'function') {
      const name = expr.name.toUpperCase();
      switch (name) {
        case 'COUNT': return state.count;
        case 'SUM': return state.count === 0 ? null : state.sum;
        case 'AVG': return state.count === 0 ? null : state.sum / state.count;
        case 'MIN': return state.min;
        case 'MAX': return state.max;
        default: return null;
      }
    }
    // Non-aggregate: return the tracked value
    return state.min;
  }

  private inferName(expr: Expr, index: number): string {
    if (expr.type === 'function') return `${expr.name.toLowerCase()}`;
    if (expr.type === 'column_ref') return expr.column;
    return `col${index}`;
  }
}
