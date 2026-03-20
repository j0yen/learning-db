import { describe, it, expect } from 'vitest';
import { HeapFile } from './heap-file.js';
import { MemoryDiskManager } from './disk-manager.js';
import { DataType } from '../types.js';
import type { Schema, Tuple } from '../types.js';

const schema: Schema = {
  columns: [
    { name: 'id', type: DataType.INTEGER, nullable: false },
    { name: 'name', type: DataType.VARCHAR, maxLength: 100, nullable: false },
    { name: 'value', type: DataType.FLOAT, nullable: true },
  ],
};

function createHeapFile(): HeapFile {
  const dm = new MemoryDiskManager(4096);
  return new HeapFile(dm, schema, 0);
}

describe('HeapFile', () => {
  it('should insert and retrieve a tuple', () => {
    const hf = createHeapFile();
    const tuple: Tuple = [1, 'alice', 3.14];
    const rid = hf.insertTuple(tuple);

    const result = hf.getTuple(rid);
    expect(result).not.toBeNull();
    expect(result![0]).toBe(1);
    expect(result![1]).toBe('alice');
    expect(result![2]).toBeCloseTo(3.14);
  });

  it('should insert multiple tuples', () => {
    const hf = createHeapFile();
    const rids = [];
    for (let i = 0; i < 50; i++) {
      rids.push(hf.insertTuple([i, `name_${i}`, i * 0.1]));
    }

    for (let i = 0; i < 50; i++) {
      const t = hf.getTuple(rids[i]);
      expect(t![0]).toBe(i);
      expect(t![1]).toBe(`name_${i}`);
    }
  });

  it('should delete a tuple', () => {
    const hf = createHeapFile();
    const rid = hf.insertTuple([1, 'delete-me', null]);
    expect(hf.deleteTuple(rid)).toBe(true);
    expect(hf.getTuple(rid)).toBeNull();
  });

  it('should update a same-size tuple in place', () => {
    const hf = createHeapFile();
    const rid = hf.insertTuple([1, 'aaa', 1.0]);
    const newRid = hf.updateTuple(rid, [2, 'bbb', 2.0]);

    const result = hf.getTuple(newRid);
    expect(result![0]).toBe(2);
    expect(result![1]).toBe('bbb');
  });

  it('should scan all tuples', () => {
    const hf = createHeapFile();
    for (let i = 0; i < 10; i++) {
      hf.insertTuple([i, `row_${i}`, null]);
    }

    const results = [...hf.scan()];
    expect(results.length).toBe(10);

    const ids = results.map(([_rid, tuple]) => tuple[0] as number).sort((a, b) => a - b);
    expect(ids).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('should scan correctly after deletes', () => {
    const hf = createHeapFile();
    const rids = [];
    for (let i = 0; i < 5; i++) {
      rids.push(hf.insertTuple([i, `row_${i}`, null]));
    }

    hf.deleteTuple(rids[1]);
    hf.deleteTuple(rids[3]);

    const results = [...hf.scan()];
    expect(results.length).toBe(3);
    const ids = results.map(([_r, t]) => t[0] as number).sort((a, b) => a - b);
    expect(ids).toEqual([0, 2, 4]);
  });

  it('should allocate new pages when current page is full', () => {
    const hf = createHeapFile();
    // Insert enough tuples to fill multiple pages
    for (let i = 0; i < 200; i++) {
      hf.insertTuple([i, `name_${i}_with_some_extra_text`, i * 0.5]);
    }

    expect(hf.getNumPages()).toBeGreaterThan(1);
    expect(hf.estimateTupleCount()).toBe(200);
  });

  it('should handle null values', () => {
    const hf = createHeapFile();
    const rid = hf.insertTuple([1, 'test', null]);
    const result = hf.getTuple(rid);
    expect(result![2]).toBeNull();
  });

  it('should return schema', () => {
    const hf = createHeapFile();
    expect(hf.getSchema()).toBe(schema);
  });
});
