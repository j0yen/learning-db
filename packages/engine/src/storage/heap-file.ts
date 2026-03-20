/**
 * HeapFile: Unordered collection of pages with a page directory.
 *
 * The page directory tracks which pages have free space for inserts.
 * HeapFile operates on raw pages via a DiskManager (or BufferPoolManager).
 */

import type { RecordId, Schema, Tuple } from '../types.js';
import type { PageSize } from '../types.js';
import type { DiskManager } from './disk-manager.js';
import { SlottedPage } from './slotted-page.js';
import { serializeTuple, deserializeTuple, tupleSize } from './tuple-serializer.js';

export interface PageDirectoryEntry {
  pageNum: number;
  freeSpace: number;
}

export class HeapFile {
  private diskManager: DiskManager;
  private schema: Schema;
  private fileId: number;
  private directory: PageDirectoryEntry[] = [];
  private pageSize: PageSize;

  constructor(diskManager: DiskManager, schema: Schema, fileId: number) {
    this.diskManager = diskManager;
    this.schema = schema;
    this.fileId = fileId;
    this.pageSize = diskManager.pageSize as PageSize;
  }

  /** Insert a tuple, returns the RecordId. */
  insertTuple(tuple: Tuple): RecordId {
    const serialized = serializeTuple(this.schema, tuple);

    // Find a page with enough free space
    for (const entry of this.directory) {
      if (entry.freeSpace >= serialized.byteLength + 4) {
        // +4 for slot entry
        const page = this.readPage(entry.pageNum);
        const slotNum = page.insertTuple(serialized);
        if (slotNum !== -1) {
          this.writePage(entry.pageNum, page);
          entry.freeSpace = page.getFreeSpace();
          return {
            pageId: { fileId: this.fileId, pageNum: entry.pageNum },
            slotNum,
          };
        }
      }
    }

    // No page with enough space — allocate a new one
    const pageNum = this.diskManager.allocatePage();
    const buffer = new Uint8Array(this.pageSize);
    const page = SlottedPage.init(buffer, this.pageSize, pageNum);
    const slotNum = page.insertTuple(serialized);

    if (slotNum === -1) {
      throw new Error('Tuple too large for a single page');
    }

    this.writePage(pageNum, page);
    this.directory.push({ pageNum, freeSpace: page.getFreeSpace() });

    return {
      pageId: { fileId: this.fileId, pageNum },
      slotNum,
    };
  }

  /** Get a tuple by RecordId. */
  getTuple(rid: RecordId): Tuple | null {
    const page = this.readPage(rid.pageId.pageNum);
    const data = page.getTuple(rid.slotNum);
    if (!data) return null;
    return deserializeTuple(this.schema, data);
  }

  /** Delete a tuple by RecordId. */
  deleteTuple(rid: RecordId): boolean {
    const page = this.readPage(rid.pageId.pageNum);
    const result = page.deleteTuple(rid.slotNum);
    if (result) {
      this.writePage(rid.pageId.pageNum, page);
      this.updateDirectoryEntry(rid.pageId.pageNum, page.getFreeSpace());
    }
    return result;
  }

  /** Update a tuple in-place (delete + reinsert if size changes). */
  updateTuple(rid: RecordId, newTuple: Tuple): RecordId {
    const serialized = serializeTuple(this.schema, newTuple);
    const page = this.readPage(rid.pageId.pageNum);
    const oldData = page.getTuple(rid.slotNum);

    if (!oldData) {
      throw new Error('Tuple not found for update');
    }

    if (serialized.byteLength === oldData.byteLength) {
      // In-place update
      page.updateTuple(rid.slotNum, serialized);
      this.writePage(rid.pageId.pageNum, page);
      return rid;
    }

    // Different size: delete and reinsert
    this.deleteTuple(rid);
    return this.insertTuple(newTuple);
  }

  /** Scan all tuples in the heap file. Yields [RecordId, Tuple]. */
  *scan(): Generator<[RecordId, Tuple]> {
    for (const entry of this.directory) {
      const page = this.readPage(entry.pageNum);
      for (const [slotNum, data] of page.iterTuples()) {
        const tuple = deserializeTuple(this.schema, data);
        const rid: RecordId = {
          pageId: { fileId: this.fileId, pageNum: entry.pageNum },
          slotNum,
        };
        yield [rid, tuple];
      }
    }
  }

  /** Get the number of pages in this heap file. */
  getNumPages(): number {
    return this.directory.length;
  }

  /** Get the schema. */
  getSchema(): Schema {
    return this.schema;
  }

  /** Estimate the number of tuples (scans directory, not exact). */
  estimateTupleCount(): number {
    let count = 0;
    for (const entry of this.directory) {
      const page = this.readPage(entry.pageNum);
      for (const [_slotNum] of page.iterTuples()) {
        count++;
      }
    }
    return count;
  }

  // ─── Internal Helpers ───────────────────────────────────────────────────

  private readPage(pageNum: number): SlottedPage {
    const buffer = new Uint8Array(this.pageSize);
    this.diskManager.readPage(pageNum, buffer);
    return SlottedPage.fromData(buffer, this.pageSize);
  }

  private writePage(pageNum: number, page: SlottedPage): void {
    this.diskManager.writePage(pageNum, page.getData());
  }

  private updateDirectoryEntry(pageNum: number, freeSpace: number): void {
    const entry = this.directory.find((e) => e.pageNum === pageNum);
    if (entry) {
      entry.freeSpace = freeSpace;
    }
  }
}
