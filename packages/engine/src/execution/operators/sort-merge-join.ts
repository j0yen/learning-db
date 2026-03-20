/**
 * Sort-Merge Join operator: Sort both inputs on join key, then merge.
 */

import type { Expr } from '../../sql/ast.js';
import type { Operator, Row, ColumnMeta } from './operator.js';
import { evaluate, buildRowContext } from '../expression-evaluator.js';
import type { Value } from '../../types.js';
import { compareValues } from '../../index/index.js';

export class SortMergeJoin implements Operator {
  private leftSorted: Row[] = [];
  private rightSorted: Row[] = [];
  private leftIdx = 0;
  private rightIdx = 0;
  private rightMatchStart = 0;
  private outputColumns: ColumnMeta[] | null = null;

  constructor(
    private left: Operator,
    private right: Operator,
    private leftKey: Expr,
    private rightKey: Expr,
  ) {}

  open(): void {
    // Materialize and sort both sides
    this.left.open();
    this.leftSorted = [];
    let row: Row | null;
    while ((row = this.left.next())) this.leftSorted.push(row);
    this.left.close();

    this.right.open();
    this.rightSorted = [];
    while ((row = this.right.next())) this.rightSorted.push(row);
    this.right.close();

    this.leftSorted.sort((a, b) => compareValues(this.getKey(a, this.leftKey), this.getKey(b, this.leftKey)));
    this.rightSorted.sort((a, b) => compareValues(this.getKey(a, this.rightKey), this.getKey(b, this.rightKey)));

    this.leftIdx = 0;
    this.rightIdx = 0;
    this.rightMatchStart = 0;

    this.outputColumns = [
      ...this.left.getColumns(),
      ...this.right.getColumns(),
    ];
  }

  next(): Row | null {
    while (this.leftIdx < this.leftSorted.length) {
      const leftRow = this.leftSorted[this.leftIdx];
      const leftVal = this.getKey(leftRow, this.leftKey);

      // Find matching right rows
      while (this.rightIdx < this.rightSorted.length) {
        const rightRow = this.rightSorted[this.rightIdx];
        const rightVal = this.getKey(rightRow, this.rightKey);
        const cmp = compareValues(leftVal, rightVal);

        if (cmp < 0) {
          // Left is smaller — advance left, reset right to match start
          break;
        } else if (cmp > 0) {
          // Right is smaller — advance right
          this.rightIdx++;
          this.rightMatchStart = this.rightIdx;
          continue;
        } else {
          // Match! Emit joined row
          this.rightIdx++;
          return {
            values: [...leftRow.values, ...rightRow.values],
            columns: this.outputColumns!,
          };
        }
      }

      // Move to next left row, reset right to the start of matches
      this.leftIdx++;
      this.rightIdx = this.rightMatchStart;
    }

    return null;
  }

  close(): void {
    this.leftSorted = [];
    this.rightSorted = [];
  }

  getColumns(): ColumnMeta[] {
    if (!this.outputColumns) {
      this.outputColumns = [
        ...this.left.getColumns(),
        ...this.right.getColumns(),
      ];
    }
    return this.outputColumns;
  }

  private getKey(row: Row, keyExpr: Expr): Value {
    const ctx = buildRowContext(row.columns, row.values);
    return evaluate(keyExpr, ctx);
  }
}
