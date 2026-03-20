/**
 * Sequential Scan operator: Reads all tuples from a HeapFile.
 */

import type { HeapFile } from '../../storage/heap-file.js';
import type { Operator, Row, ColumnMeta } from './operator.js';
import type { RecordId, Tuple } from '../../types.js';

export class SeqScan implements Operator {
  private heapFile: HeapFile;
  private tableAlias?: string;
  private iterator: Generator<[RecordId, Tuple]> | null = null;
  private columns: ColumnMeta[];

  constructor(heapFile: HeapFile, tableAlias?: string) {
    this.heapFile = heapFile;
    this.tableAlias = tableAlias;
    const schema = heapFile.getSchema();
    this.columns = schema.columns.map((c) => ({
      name: c.name,
      table: tableAlias,
    }));
  }

  open(): void {
    this.iterator = this.heapFile.scan();
  }

  next(): Row | null {
    if (!this.iterator) return null;
    const result = this.iterator.next();
    if (result.done) return null;

    const [_rid, tuple] = result.value;
    return { values: tuple, columns: this.columns };
  }

  close(): void {
    this.iterator = null;
  }

  getColumns(): ColumnMeta[] {
    return this.columns;
  }
}
