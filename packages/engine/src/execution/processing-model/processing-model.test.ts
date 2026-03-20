import { describe, it, expect } from 'vitest';
import { MaterializationWrapper } from './materialization.js';
import { VectorizedWrapper, VectorizedToRowAdapter, collectVectorized } from './vectorized.js';
import { SeqScan } from '../operators/seq-scan.js';
import { Filter } from '../operators/filter.js';
import { MemoryDiskManager } from '../../storage/disk-manager.js';
import { HeapFile } from '../../storage/heap-file.js';
import { DataType } from '../../types.js';
import type { Schema, Expr } from '../../index.js';

const schema: Schema = {
  columns: [
    { name: 'id', type: DataType.INTEGER, nullable: false },
    { name: 'value', type: DataType.INTEGER, nullable: false },
  ],
};

function setupTable(n: number) {
  const dm = new MemoryDiskManager(4096);
  const hf = new HeapFile(dm, schema, 0);
  for (let i = 0; i < n; i++) {
    hf.insertTuple([i, i * 10]);
  }
  return hf;
}

describe('Materialization Model', () => {
  it('should materialize all results', () => {
    const hf = setupTable(50);
    const scan = new SeqScan(hf, 'test');
    const mat = new MaterializationWrapper(scan);

    mat.open();
    const rows = [];
    let row;
    while ((row = mat.next())) rows.push(row);
    mat.close();

    expect(rows.length).toBe(50);
  });

  it('should work with filter', () => {
    const hf = setupTable(100);
    const scan = new SeqScan(hf, 'test');
    const pred: Expr = {
      type: 'binary', op: '<',
      left: { type: 'column_ref', column: 'id' },
      right: { type: 'literal', value: 10, dataType: 'number' },
    };
    const filter = new Filter(scan, pred);
    const mat = new MaterializationWrapper(filter);

    mat.open();
    const rows = [];
    let row;
    while ((row = mat.next())) rows.push(row);
    mat.close();

    expect(rows.length).toBe(10);
  });

  it('should return all rows via getAllRows', () => {
    const hf = setupTable(20);
    const scan = new SeqScan(hf, 'test');
    const mat = new MaterializationWrapper(scan);

    mat.open();
    expect(mat.getAllRows().length).toBe(20);
    mat.close();
  });
});

describe('Vectorized Model', () => {
  it('should produce batches', () => {
    const hf = setupTable(50);
    const scan = new SeqScan(hf, 'test');
    const vec = new VectorizedWrapper(scan, 10);

    vec.open();
    const batch1 = vec.nextBatch();
    expect(batch1.size).toBe(10);
    expect(batch1.eof).toBe(false);

    const batch2 = vec.nextBatch();
    expect(batch2.size).toBe(10);

    // Drain remaining
    let total = batch1.size + batch2.size;
    while (true) {
      const b = vec.nextBatch();
      total += b.size;
      if (b.eof) break;
    }
    vec.close();

    expect(total).toBe(50);
  });

  it('should handle last partial batch', () => {
    const hf = setupTable(15);
    const scan = new SeqScan(hf, 'test');
    const vec = new VectorizedWrapper(scan, 10);

    vec.open();
    const batch1 = vec.nextBatch();
    expect(batch1.size).toBe(10);
    expect(batch1.eof).toBe(false);

    const batch2 = vec.nextBatch();
    expect(batch2.size).toBe(5);
    expect(batch2.eof).toBe(true);
    vec.close();
  });

  it('should handle empty input', () => {
    const hf = setupTable(0);
    const scan = new SeqScan(hf, 'test');
    const vec = new VectorizedWrapper(scan, 10);

    vec.open();
    const batch = vec.nextBatch();
    expect(batch.size).toBe(0);
    expect(batch.eof).toBe(true);
    vec.close();
  });

  it('should report batch size', () => {
    const hf = setupTable(10);
    const scan = new SeqScan(hf, 'test');
    const vec = new VectorizedWrapper(scan, 256);
    expect(vec.getBatchSize()).toBe(256);
  });

  it('should collect all rows', () => {
    const hf = setupTable(35);
    const scan = new SeqScan(hf, 'test');
    const vec = new VectorizedWrapper(scan, 10);

    const rows = collectVectorized(vec);
    expect(rows.length).toBe(35);
  });

  it('should adapt to row-at-a-time via adapter', () => {
    const hf = setupTable(25);
    const scan = new SeqScan(hf, 'test');
    const vec = new VectorizedWrapper(scan, 10);
    const adapter = new VectorizedToRowAdapter(vec);

    adapter.open();
    const rows = [];
    let row;
    while ((row = adapter.next())) rows.push(row);
    adapter.close();

    expect(rows.length).toBe(25);
  });
});
