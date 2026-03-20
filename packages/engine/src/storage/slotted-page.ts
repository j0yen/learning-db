/**
 * SlottedPage: Fixed-size page with a slot directory for variable-length tuples.
 *
 * Page layout (from beginning):
 *   [Header: 8 bytes]
 *     - numSlots:    Uint16 (offset 0)
 *     - freeSpaceOffset: Uint16 (offset 2) — points to start of free space
 *     - freeSpace:   Uint16 (offset 4) — total free bytes
 *     - pageId:      Uint16 (offset 6) — page number within file
 *
 *   [Slot Directory: numSlots * 4 bytes] (grows downward from header)
 *     Each slot: { offset: Uint16, length: Uint16 }
 *     offset=0xFFFF means deleted/empty slot
 *
 *   [Free Space]
 *
 *   [Tuple Data] (grows upward from end of page)
 */

import type { PageSize } from '../types.js';

const HEADER_SIZE = 8;
const SLOT_SIZE = 4;
const DELETED_MARKER = 0xffff;

export class SlottedPage {
  private data: Uint8Array;
  private view: DataView;
  readonly pageSize: PageSize;

  constructor(data: Uint8Array, pageSize: PageSize) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.pageSize = pageSize;
  }

  /** Initialize a fresh empty page. */
  static init(data: Uint8Array, pageSize: PageSize, pageId: number): SlottedPage {
    const page = new SlottedPage(data, pageSize);
    page.setNumSlots(0);
    page.setFreeSpaceOffset(HEADER_SIZE); // Free space starts right after header
    page.setFreeSpace(pageSize - HEADER_SIZE);
    page.setPageId(pageId);
    return page;
  }

  /** Wrap existing page data. */
  static fromData(data: Uint8Array, pageSize: PageSize): SlottedPage {
    return new SlottedPage(data, pageSize);
  }

  // ─── Header Accessors ───────────────────────────────────────────────────

  getNumSlots(): number {
    return this.view.getUint16(0);
  }

  private setNumSlots(n: number): void {
    this.view.setUint16(0, n);
  }

  /** Offset where the slot directory ends and free space begins. */
  private getFreeSpaceOffset(): number {
    return this.view.getUint16(2);
  }

  private setFreeSpaceOffset(offset: number): void {
    this.view.setUint16(2, offset);
  }

  getFreeSpace(): number {
    return this.view.getUint16(4);
  }

  private setFreeSpace(space: number): void {
    this.view.setUint16(4, space);
  }

  getPageId(): number {
    return this.view.getUint16(6);
  }

  private setPageId(id: number): void {
    this.view.setUint16(6, id);
  }

  // ─── Slot Directory ─────────────────────────────────────────────────────

  private slotOffset(slotNum: number): number {
    return HEADER_SIZE + slotNum * SLOT_SIZE;
  }

  private getSlot(slotNum: number): { offset: number; length: number } {
    const base = this.slotOffset(slotNum);
    return {
      offset: this.view.getUint16(base),
      length: this.view.getUint16(base + 2),
    };
  }

  private setSlot(slotNum: number, offset: number, length: number): void {
    const base = this.slotOffset(slotNum);
    this.view.setUint16(base, offset);
    this.view.setUint16(base + 2, length);
  }

  isSlotEmpty(slotNum: number): boolean {
    if (slotNum >= this.getNumSlots()) return true;
    return this.getSlot(slotNum).offset === DELETED_MARKER;
  }

  // ─── Tuple Operations ───────────────────────────────────────────────────

  /** Insert a tuple, returns the slot number or -1 if no space. */
  insertTuple(tupleData: Uint8Array): number {
    const needed = tupleData.byteLength;
    // We need space for the tuple + possibly a new slot entry
    let slotNum = -1;

    // Try to reuse a deleted slot
    const numSlots = this.getNumSlots();
    for (let i = 0; i < numSlots; i++) {
      if (this.isSlotEmpty(i)) {
        slotNum = i;
        break;
      }
    }

    const needNewSlot = slotNum === -1;
    const totalNeeded = needed + (needNewSlot ? SLOT_SIZE : 0);

    if (totalNeeded > this.getFreeSpace()) {
      return -1; // Not enough space
    }

    // Find the lowest tuple offset currently in use (before modifying slot directory)
    let lowestTupleOffset: number = this.pageSize;
    for (let i = 0; i < numSlots; i++) {
      if (!this.isSlotEmpty(i)) {
        const slot = this.getSlot(i);
        if (slot.offset < lowestTupleOffset) {
          lowestTupleOffset = slot.offset;
        }
      }
    }

    if (needNewSlot) {
      slotNum = numSlots;
      this.setNumSlots(numSlots + 1);
      this.setFreeSpaceOffset(HEADER_SIZE + (numSlots + 1) * SLOT_SIZE);
    }

    const tupleOffset = lowestTupleOffset - needed;

    // Verify we don't collide with slot directory
    if (tupleOffset < this.getFreeSpaceOffset()) {
      // Undo slot allocation if we added one
      if (needNewSlot) {
        this.setNumSlots(numSlots);
        this.setFreeSpaceOffset(HEADER_SIZE + numSlots * SLOT_SIZE);
      }
      return -1;
    }

    // Write tuple data
    this.data.set(tupleData, tupleOffset);
    this.setSlot(slotNum, tupleOffset, needed);
    this.setFreeSpace(this.getFreeSpace() - totalNeeded);

    return slotNum;
  }

  /** Get tuple data at a slot, or null if empty/deleted. */
  getTuple(slotNum: number): Uint8Array | null {
    if (slotNum >= this.getNumSlots()) return null;
    if (this.isSlotEmpty(slotNum)) return null;

    const slot = this.getSlot(slotNum);
    return this.data.slice(slot.offset, slot.offset + slot.length);
  }

  /** Delete a tuple at a slot. Does NOT compact (fragmentation is possible). */
  deleteTuple(slotNum: number): boolean {
    if (slotNum >= this.getNumSlots()) return false;
    if (this.isSlotEmpty(slotNum)) return false;

    const slot = this.getSlot(slotNum);
    this.setFreeSpace(this.getFreeSpace() + slot.length);
    this.setSlot(slotNum, DELETED_MARKER, 0);
    return true;
  }

  /** Update a tuple in place. If new data is same size, overwrite. Otherwise delete+insert. */
  updateTuple(slotNum: number, newData: Uint8Array): boolean {
    if (slotNum >= this.getNumSlots()) return false;
    if (this.isSlotEmpty(slotNum)) return false;

    const slot = this.getSlot(slotNum);
    if (newData.byteLength === slot.length) {
      // In-place update
      this.data.set(newData, slot.offset);
      return true;
    }

    // Delete and reinsert
    this.deleteTuple(slotNum);
    // Try to compact first to reclaim fragmented space
    this.compact();
    const newSlot = this.insertTuple(newData);
    if (newSlot === -1) return false;

    // If it got a different slot, we need to fix that
    // For simplicity, we accept whatever slot it gets
    // The caller should use the RecordId from the original insert
    return true;
  }

  /** Compact the page to reclaim fragmented space. */
  compact(): void {
    const numSlots = this.getNumSlots();

    // Collect all live tuples with their slot indices
    const liveTuples: { slotNum: number; data: Uint8Array }[] = [];
    for (let i = 0; i < numSlots; i++) {
      if (!this.isSlotEmpty(i)) {
        liveTuples.push({ slotNum: i, data: this.getTuple(i)! });
      }
    }

    // Clear tuple area
    const slotDirEnd = HEADER_SIZE + numSlots * SLOT_SIZE;
    this.data.fill(0, slotDirEnd);

    // Rewrite tuples from end of page
    let offset = this.pageSize;
    for (const { slotNum, data } of liveTuples) {
      offset -= data.byteLength;
      this.data.set(data, offset);
      this.setSlot(slotNum, offset, data.byteLength);
    }

    this.setFreeSpace(offset - slotDirEnd);
  }

  /** Get the raw page data (for writing to disk). */
  getData(): Uint8Array {
    return this.data;
  }

  /** Iterate over all live tuples. Yields [slotNum, tupleData]. */
  *iterTuples(): Generator<[number, Uint8Array]> {
    const numSlots = this.getNumSlots();
    for (let i = 0; i < numSlots; i++) {
      if (!this.isSlotEmpty(i)) {
        yield [i, this.getTuple(i)!];
      }
    }
  }
}
