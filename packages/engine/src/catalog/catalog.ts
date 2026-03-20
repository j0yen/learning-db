/**
 * System Catalog: Registry for tables, indexes, and schemas.
 */

import type { Schema, RecordId, Value } from '../types.js';
import type { HeapFile } from '../storage/heap-file.js';
import type { Index } from '../index/index.js';

export interface TableInfo {
  tableId: number;
  name: string;
  schema: Schema;
  heapFile: HeapFile;
  indexes: Map<string, IndexInfo>;
}

export interface IndexInfo {
  indexId: number;
  name: string;
  tableName: string;
  columnIndex: number; // Which column is indexed
  index: Index;
}

export class Catalog {
  private tables: Map<string, TableInfo> = new Map();
  private nextTableId = 0;
  private nextIndexId = 0;

  /** Register a table. */
  registerTable(name: string, schema: Schema, heapFile: HeapFile): TableInfo {
    if (this.tables.has(name)) {
      throw new Error(`Table '${name}' already exists`);
    }

    this.validateSchema(schema);

    const info: TableInfo = {
      tableId: this.nextTableId++,
      name,
      schema,
      heapFile,
      indexes: new Map(),
    };
    this.tables.set(name, info);
    return info;
  }

  /** Drop a table. */
  dropTable(name: string): boolean {
    return this.tables.delete(name);
  }

  /** Get table info by name. */
  getTable(name: string): TableInfo | undefined {
    return this.tables.get(name);
  }

  /** Get all table names. */
  getTableNames(): string[] {
    return [...this.tables.keys()];
  }

  /** Register an index on a table column. */
  registerIndex(
    name: string,
    tableName: string,
    columnIndex: number,
    index: Index,
  ): IndexInfo {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table '${tableName}' does not exist`);
    }
    if (columnIndex < 0 || columnIndex >= table.schema.columns.length) {
      throw new Error(`Column index ${columnIndex} out of range`);
    }
    if (table.indexes.has(name)) {
      throw new Error(`Index '${name}' already exists on table '${tableName}'`);
    }

    const info: IndexInfo = {
      indexId: this.nextIndexId++,
      name,
      tableName,
      columnIndex,
      index,
    };
    table.indexes.set(name, info);
    return info;
  }

  /** Drop an index. */
  dropIndex(tableName: string, indexName: string): boolean {
    const table = this.tables.get(tableName);
    if (!table) return false;
    return table.indexes.delete(indexName);
  }

  /** Get all indexes for a table. */
  getIndexes(tableName: string): IndexInfo[] {
    const table = this.tables.get(tableName);
    if (!table) return [];
    return [...table.indexes.values()];
  }

  /** Get indexes that cover a specific column. */
  getIndexesForColumn(tableName: string, columnIndex: number): IndexInfo[] {
    return this.getIndexes(tableName).filter((idx) => idx.columnIndex === columnIndex);
  }

  /** Resolve a column name to its index in the schema. Returns -1 if not found. */
  resolveColumn(tableName: string, columnName: string): number {
    const table = this.tables.get(tableName);
    if (!table) return -1;
    return table.schema.columns.findIndex((c) => c.name === columnName);
  }

  /** Validate a schema for basic correctness. */
  private validateSchema(schema: Schema): void {
    if (schema.columns.length === 0) {
      throw new Error('Schema must have at least one column');
    }

    const names = new Set<string>();
    for (const col of schema.columns) {
      if (!col.name || col.name.trim() === '') {
        throw new Error('Column name cannot be empty');
      }
      if (names.has(col.name)) {
        throw new Error(`Duplicate column name: '${col.name}'`);
      }
      names.add(col.name);
    }
  }
}
