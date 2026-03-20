import { describe, it, expect } from 'vitest';
import { serializeTuple, deserializeTuple, tupleSize } from './tuple-serializer.js';
import { DataType } from '../types.js';
import type { Schema, Tuple } from '../types.js';

const testSchema: Schema = {
  columns: [
    { name: 'id', type: DataType.INTEGER, nullable: false },
    { name: 'name', type: DataType.VARCHAR, maxLength: 255, nullable: true },
    { name: 'score', type: DataType.FLOAT, nullable: false },
    { name: 'active', type: DataType.BOOLEAN, nullable: false },
  ],
};

describe('TupleSerializer', () => {
  it('should round-trip a tuple with all types', () => {
    const tuple: Tuple = [42, 'hello', 3.14, true];
    const bytes = serializeTuple(testSchema, tuple);
    const result = deserializeTuple(testSchema, bytes);
    expect(result[0]).toBe(42);
    expect(result[1]).toBe('hello');
    expect(result[2]).toBeCloseTo(3.14);
    expect(result[3]).toBe(true);
  });

  it('should handle null values', () => {
    const tuple: Tuple = [1, null, 2.0, false];
    const bytes = serializeTuple(testSchema, tuple);
    const result = deserializeTuple(testSchema, bytes);
    expect(result).toEqual([1, null, 2.0, false]);
  });

  it('should handle empty string', () => {
    const tuple: Tuple = [0, '', 0.0, false];
    const bytes = serializeTuple(testSchema, tuple);
    const result = deserializeTuple(testSchema, bytes);
    expect(result[1]).toBe('');
  });

  it('should handle unicode strings', () => {
    const tuple: Tuple = [1, '日本語テスト', 1.0, true];
    const bytes = serializeTuple(testSchema, tuple);
    const result = deserializeTuple(testSchema, bytes);
    expect(result[1]).toBe('日本語テスト');
  });

  it('should handle negative integers', () => {
    const tuple: Tuple = [-100, 'neg', -0.5, false];
    const bytes = serializeTuple(testSchema, tuple);
    const result = deserializeTuple(testSchema, bytes);
    expect(result[0]).toBe(-100);
    expect(result[2]).toBeCloseTo(-0.5);
  });

  it('should calculate correct tuple size', () => {
    const tuple: Tuple = [42, 'hi', 1.0, true];
    const size = tupleSize(testSchema, tuple);
    const bytes = serializeTuple(testSchema, tuple);
    expect(bytes.byteLength).toBe(size);
  });

  it('should handle all-null tuple', () => {
    const nullableSchema: Schema = {
      columns: [
        { name: 'a', type: DataType.INTEGER, nullable: true },
        { name: 'b', type: DataType.VARCHAR, nullable: true },
      ],
    };
    const tuple: Tuple = [null, null];
    const bytes = serializeTuple(nullableSchema, tuple);
    const result = deserializeTuple(nullableSchema, bytes);
    expect(result).toEqual([null, null]);
  });

  it('should handle integer-only schema', () => {
    const intSchema: Schema = {
      columns: [
        { name: 'a', type: DataType.INTEGER, nullable: false },
        { name: 'b', type: DataType.INTEGER, nullable: false },
        { name: 'c', type: DataType.INTEGER, nullable: false },
      ],
    };
    const tuple: Tuple = [1, 2, 3];
    const bytes = serializeTuple(intSchema, tuple);
    const result = deserializeTuple(intSchema, bytes);
    expect(result).toEqual([1, 2, 3]);
    // 1 byte bitmap + 3 * 4 bytes = 13
    expect(bytes.byteLength).toBe(13);
  });
});
