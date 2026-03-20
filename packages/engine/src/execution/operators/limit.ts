/**
 * Limit operator: Returns at most N rows, optionally skipping an offset.
 */

import type { Operator, Row, ColumnMeta } from './operator.js';

export class Limit implements Operator {
  private count = 0;
  private skipped = 0;

  constructor(
    private child: Operator,
    private maxRows: number,
    private offsetRows: number = 0,
  ) {}

  open(): void {
    this.child.open();
    this.count = 0;
    this.skipped = 0;
  }

  next(): Row | null {
    // Skip offset rows
    while (this.skipped < this.offsetRows) {
      const row = this.child.next();
      if (!row) return null;
      this.skipped++;
    }

    if (this.count >= this.maxRows) return null;
    const row = this.child.next();
    if (!row) return null;
    this.count++;
    return row;
  }

  close(): void {
    this.child.close();
  }

  getColumns(): ColumnMeta[] {
    return this.child.getColumns();
  }
}
