/**
 * Hash Join operator: Build hash table on inner, probe with outer.
 * Supports equi-join conditions (column = column).
 */

import type { Expr } from '../../sql/ast.js';
import type { Operator, Row, ColumnMeta } from './operator.js';
import { evaluate, buildRowContext, mergeContexts } from '../expression-evaluator.js';
import type { Value } from '../../types.js';

export class HashJoin implements Operator {
  private hashTable: Map<string, Row[]> = new Map();
  private outputColumns: ColumnMeta[] | null = null;
  private probeIterator: Iterator<Row[]> | null = null;
  private currentBucket: Row[] = [];
  private currentBucketIdx = 0;
  private currentOuterRow: Row | null = null;
  private buildKeyExpr: Expr;
  private probeKeyExpr: Expr;

  constructor(
    private build: Operator, // inner (build side)
    private probe: Operator, // outer (probe side)
    buildKey: Expr,
    probeKey: Expr,
    private condition?: Expr, // Full condition for non-equi parts
  ) {
    this.buildKeyExpr = buildKey;
    this.probeKeyExpr = probeKey;
  }

  open(): void {
    // Build phase: hash all rows from build side
    this.build.open();
    this.hashTable.clear();

    let row: Row | null;
    while ((row = this.build.next())) {
      const ctx = buildRowContext(row.columns, row.values);
      const key = this.hashKey(evaluate(this.buildKeyExpr, ctx));
      const bucket = this.hashTable.get(key) ?? [];
      bucket.push(row);
      this.hashTable.set(key, bucket);
    }
    this.build.close();

    // Probe phase
    this.probe.open();
    this.outputColumns = [
      ...this.probe.getColumns(),
      ...this.build.getColumns(),
    ];
    this.currentOuterRow = null;
    this.currentBucket = [];
    this.currentBucketIdx = 0;
  }

  next(): Row | null {
    while (true) {
      // If we have matches from current bucket
      while (this.currentBucketIdx < this.currentBucket.length) {
        const buildRow = this.currentBucket[this.currentBucketIdx++];
        const combinedValues = [...this.currentOuterRow!.values, ...buildRow.values];

        if (this.condition) {
          const outerCtx = buildRowContext(this.currentOuterRow!.columns, this.currentOuterRow!.values);
          const innerCtx = buildRowContext(buildRow.columns, buildRow.values);
          const ctx = mergeContexts(outerCtx, innerCtx);
          if (evaluate(this.condition, ctx) !== true) continue;
        }

        return { values: combinedValues, columns: this.outputColumns! };
      }

      // Get next probe row
      this.currentOuterRow = this.probe.next();
      if (!this.currentOuterRow) return null;

      const ctx = buildRowContext(this.currentOuterRow.columns, this.currentOuterRow.values);
      const key = this.hashKey(evaluate(this.probeKeyExpr, ctx));
      this.currentBucket = this.hashTable.get(key) ?? [];
      this.currentBucketIdx = 0;
    }
  }

  close(): void {
    this.probe.close();
    this.hashTable.clear();
  }

  getColumns(): ColumnMeta[] {
    if (!this.outputColumns) {
      this.outputColumns = [
        ...this.probe.getColumns(),
        ...this.build.getColumns(),
      ];
    }
    return this.outputColumns;
  }

  private hashKey(value: Value): string {
    return String(value);
  }
}
