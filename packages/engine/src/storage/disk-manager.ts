/**
 * DiskManager: Manages reading and writing fixed-size pages.
 *
 * Two backends:
 *   - MemoryDiskManager: ArrayBuffer-backed, for browser/testing
 *   - FileDiskManager: (future) Node.js fs-backed for CLI
 */

import type { PageSize } from '../types.js';
import { DEFAULT_PAGE_SIZE } from '../types.js';

export interface DiskManager {
  readonly pageSize: PageSize;

  /** Allocate a new page, returns its page number. */
  allocatePage(): number;

  /** Read a page into the provided buffer. */
  readPage(pageNum: number, buffer: Uint8Array): void;

  /** Write a page from the provided buffer. */
  writePage(pageNum: number, data: Uint8Array): void;

  /** Get the total number of allocated pages. */
  getNumPages(): number;

  /** Deallocate a page (mark as free for reuse). */
  deallocatePage(pageNum: number): void;
}

/**
 * In-memory disk manager backed by ArrayBuffer.
 * Suitable for browser and testing.
 */
export class MemoryDiskManager implements DiskManager {
  readonly pageSize: PageSize;
  private pages: Map<number, Uint8Array> = new Map();
  private nextPageNum = 0;
  private freePages: number[] = [];

  constructor(pageSize: PageSize = DEFAULT_PAGE_SIZE) {
    this.pageSize = pageSize;
  }

  allocatePage(): number {
    let pageNum: number;
    if (this.freePages.length > 0) {
      pageNum = this.freePages.pop()!;
    } else {
      pageNum = this.nextPageNum++;
    }
    // Initialize with zeros
    this.pages.set(pageNum, new Uint8Array(this.pageSize));
    return pageNum;
  }

  readPage(pageNum: number, buffer: Uint8Array): void {
    const page = this.pages.get(pageNum);
    if (!page) {
      throw new Error(`Page ${pageNum} does not exist`);
    }
    buffer.set(page);
  }

  writePage(pageNum: number, data: Uint8Array): void {
    const page = this.pages.get(pageNum);
    if (!page) {
      throw new Error(`Page ${pageNum} does not exist`);
    }
    page.set(data);
  }

  getNumPages(): number {
    return this.pages.size;
  }

  deallocatePage(pageNum: number): void {
    if (!this.pages.has(pageNum)) {
      throw new Error(`Page ${pageNum} does not exist`);
    }
    this.pages.delete(pageNum);
    this.freePages.push(pageNum);
  }
}
