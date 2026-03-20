/**
 * Tuple serialization/deserialization for slotted pages.
 *
 * Binary format per tuple:
 *   [null_bitmap: ceil(numCols/8) bytes] [col1_data] [col2_data] ...
 *
 * Column encoding:
 *   INTEGER: 4 bytes (Int32, big-endian)
 *   FLOAT:   8 bytes (Float64, big-endian)
 *   BOOLEAN: 1 byte (0 or 1)
 *   VARCHAR: 2 bytes length prefix (Uint16) + UTF-8 bytes
 *   NULL:    no data (indicated by null bitmap)
 */

import type { Schema, Tuple, Value } from '../types.js';
import { DataType } from '../types.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Calculate the serialized size of a tuple. */
export function tupleSize(schema: Schema, tuple: Tuple): number {
  const numCols = schema.columns.length;
  let size = Math.ceil(numCols / 8); // null bitmap

  for (let i = 0; i < numCols; i++) {
    if (tuple[i] === null) continue;
    const col = schema.columns[i];
    switch (col.type) {
      case DataType.INTEGER:
        size += 4;
        break;
      case DataType.FLOAT:
        size += 8;
        break;
      case DataType.BOOLEAN:
        size += 1;
        break;
      case DataType.VARCHAR: {
        const encoded = textEncoder.encode(tuple[i] as string);
        size += 2 + encoded.byteLength;
        break;
      }
      case DataType.NULL:
        break;
    }
  }
  return size;
}

/** Serialize a tuple into a byte array. */
export function serializeTuple(schema: Schema, tuple: Tuple): Uint8Array {
  const size = tupleSize(schema, tuple);
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const numCols = schema.columns.length;
  const bitmapSize = Math.ceil(numCols / 8);

  // Write null bitmap
  for (let i = 0; i < numCols; i++) {
    if (tuple[i] === null) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      bytes[byteIdx] |= 1 << bitIdx;
    }
  }

  let offset = bitmapSize;

  for (let i = 0; i < numCols; i++) {
    if (tuple[i] === null) continue;
    const col = schema.columns[i];
    const val = tuple[i]!;

    switch (col.type) {
      case DataType.INTEGER:
        view.setInt32(offset, val as number);
        offset += 4;
        break;
      case DataType.FLOAT:
        view.setFloat64(offset, val as number);
        offset += 8;
        break;
      case DataType.BOOLEAN:
        view.setUint8(offset, val ? 1 : 0);
        offset += 1;
        break;
      case DataType.VARCHAR: {
        const encoded = textEncoder.encode(val as string);
        view.setUint16(offset, encoded.byteLength);
        offset += 2;
        bytes.set(encoded, offset);
        offset += encoded.byteLength;
        break;
      }
      case DataType.NULL:
        break;
    }
  }

  return bytes;
}

/** Deserialize a tuple from a byte array. */
export function deserializeTuple(schema: Schema, data: Uint8Array): Tuple {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const numCols = schema.columns.length;
  const bitmapSize = Math.ceil(numCols / 8);

  // Read null bitmap
  const isNull = (i: number): boolean => {
    const byteIdx = Math.floor(i / 8);
    const bitIdx = i % 8;
    return (data[byteIdx] & (1 << bitIdx)) !== 0;
  };

  let offset = bitmapSize;
  const tuple: Tuple = [];

  for (let i = 0; i < numCols; i++) {
    if (isNull(i)) {
      tuple.push(null);
      continue;
    }

    const col = schema.columns[i];
    let val: Value;

    switch (col.type) {
      case DataType.INTEGER:
        val = view.getInt32(offset);
        offset += 4;
        break;
      case DataType.FLOAT:
        val = view.getFloat64(offset);
        offset += 8;
        break;
      case DataType.BOOLEAN:
        val = view.getUint8(offset) !== 0;
        offset += 1;
        break;
      case DataType.VARCHAR: {
        const len = view.getUint16(offset);
        offset += 2;
        val = textDecoder.decode(data.subarray(offset, offset + len));
        offset += len;
        break;
      }
      case DataType.NULL:
        val = null;
        break;
      default:
        val = null;
    }

    tuple.push(val);
  }

  return tuple;
}
