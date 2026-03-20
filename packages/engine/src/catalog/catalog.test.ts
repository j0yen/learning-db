import { describe, it, expect } from 'vitest';
import { Catalog } from './catalog.js';
import { MemoryDiskManager } from '../storage/disk-manager.js';
import { HeapFile } from '../storage/heap-file.js';
import { BPlusTree } from '../index/btree/bplus-tree.js';
import { DataType } from '../types.js';
import type { Schema } from '../types.js';

const schema: Schema = {
  columns: [
    { name: 'id', type: DataType.INTEGER, nullable: false, primaryKey: true },
    { name: 'name', type: DataType.VARCHAR, maxLength: 100, nullable: false },
    { name: 'age', type: DataType.INTEGER, nullable: true },
  ],
};

function makeCatalog() {
  const dm = new MemoryDiskManager(4096);
  const hf = new HeapFile(dm, schema, 0);
  const catalog = new Catalog();
  return { catalog, hf, dm };
}

describe('Catalog', () => {
  it('should register and retrieve a table', () => {
    const { catalog, hf } = makeCatalog();
    const info = catalog.registerTable('users', schema, hf);
    expect(info.name).toBe('users');
    expect(info.tableId).toBe(0);

    const retrieved = catalog.getTable('users');
    expect(retrieved).toBeDefined();
    expect(retrieved!.schema.columns.length).toBe(3);
  });

  it('should reject duplicate table names', () => {
    const { catalog, hf } = makeCatalog();
    catalog.registerTable('users', schema, hf);
    expect(() => catalog.registerTable('users', schema, hf)).toThrow("already exists");
  });

  it('should reject empty schema', () => {
    const { catalog, hf } = makeCatalog();
    expect(() =>
      catalog.registerTable('empty', { columns: [] }, hf),
    ).toThrow('at least one column');
  });

  it('should reject duplicate column names', () => {
    const { catalog, hf } = makeCatalog();
    const badSchema: Schema = {
      columns: [
        { name: 'x', type: DataType.INTEGER, nullable: false },
        { name: 'x', type: DataType.INTEGER, nullable: false },
      ],
    };
    expect(() => catalog.registerTable('bad', badSchema, hf)).toThrow('Duplicate column');
  });

  it('should drop a table', () => {
    const { catalog, hf } = makeCatalog();
    catalog.registerTable('users', schema, hf);
    expect(catalog.dropTable('users')).toBe(true);
    expect(catalog.getTable('users')).toBeUndefined();
  });

  it('should list table names', () => {
    const { catalog, hf } = makeCatalog();
    catalog.registerTable('a', schema, hf);
    catalog.registerTable('b', schema, hf);
    expect(catalog.getTableNames().sort()).toEqual(['a', 'b']);
  });

  it('should register and retrieve an index', () => {
    const { catalog, hf } = makeCatalog();
    catalog.registerTable('users', schema, hf);
    const btree = new BPlusTree('idx_id', 4);
    const idx = catalog.registerIndex('idx_id', 'users', 0, btree);

    expect(idx.name).toBe('idx_id');
    expect(idx.columnIndex).toBe(0);

    const indexes = catalog.getIndexes('users');
    expect(indexes.length).toBe(1);
  });

  it('should reject index on non-existent table', () => {
    const catalog = new Catalog();
    const btree = new BPlusTree('idx', 4);
    expect(() => catalog.registerIndex('idx', 'nope', 0, btree)).toThrow('does not exist');
  });

  it('should reject out-of-range column index', () => {
    const { catalog, hf } = makeCatalog();
    catalog.registerTable('users', schema, hf);
    const btree = new BPlusTree('idx', 4);
    expect(() => catalog.registerIndex('idx', 'users', 99, btree)).toThrow('out of range');
  });

  it('should get indexes for a specific column', () => {
    const { catalog, hf } = makeCatalog();
    catalog.registerTable('users', schema, hf);
    catalog.registerIndex('idx_id', 'users', 0, new BPlusTree('idx_id'));
    catalog.registerIndex('idx_name', 'users', 1, new BPlusTree('idx_name'));

    const idIndexes = catalog.getIndexesForColumn('users', 0);
    expect(idIndexes.length).toBe(1);
    expect(idIndexes[0].name).toBe('idx_id');
  });

  it('should resolve column names', () => {
    const { catalog, hf } = makeCatalog();
    catalog.registerTable('users', schema, hf);

    expect(catalog.resolveColumn('users', 'id')).toBe(0);
    expect(catalog.resolveColumn('users', 'name')).toBe(1);
    expect(catalog.resolveColumn('users', 'age')).toBe(2);
    expect(catalog.resolveColumn('users', 'nope')).toBe(-1);
    expect(catalog.resolveColumn('nope', 'id')).toBe(-1);
  });

  it('should drop an index', () => {
    const { catalog, hf } = makeCatalog();
    catalog.registerTable('users', schema, hf);
    catalog.registerIndex('idx', 'users', 0, new BPlusTree('idx'));
    expect(catalog.dropIndex('users', 'idx')).toBe(true);
    expect(catalog.getIndexes('users').length).toBe(0);
  });
});
