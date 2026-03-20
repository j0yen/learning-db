import { describe, it, expect } from 'vitest';
import { SlottedPage } from './slotted-page.js';

const PAGE_SIZE = 4096 as const;

function createPage(id = 0): SlottedPage {
  const data = new Uint8Array(PAGE_SIZE);
  return SlottedPage.init(data, PAGE_SIZE, id);
}

describe('SlottedPage', () => {
  it('should initialize with correct header values', () => {
    const page = createPage(5);
    expect(page.getNumSlots()).toBe(0);
    expect(page.getFreeSpace()).toBe(PAGE_SIZE - 8); // 8-byte header
    expect(page.getPageId()).toBe(5);
  });

  it('should insert and retrieve a tuple', () => {
    const page = createPage();
    const tupleData = new Uint8Array([1, 2, 3, 4, 5]);
    const slot = page.insertTuple(tupleData);
    expect(slot).toBe(0);

    const retrieved = page.getTuple(0);
    expect(retrieved).not.toBeNull();
    expect(Array.from(retrieved!)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should insert multiple tuples', () => {
    const page = createPage();
    const s0 = page.insertTuple(new Uint8Array([10, 20]));
    const s1 = page.insertTuple(new Uint8Array([30, 40, 50]));
    expect(s0).toBe(0);
    expect(s1).toBe(1);
    expect(page.getNumSlots()).toBe(2);

    expect(Array.from(page.getTuple(0)!)).toEqual([10, 20]);
    expect(Array.from(page.getTuple(1)!)).toEqual([30, 40, 50]);
  });

  it('should return null for empty/invalid slots', () => {
    const page = createPage();
    expect(page.getTuple(0)).toBeNull();
    expect(page.getTuple(999)).toBeNull();
  });

  it('should delete a tuple', () => {
    const page = createPage();
    page.insertTuple(new Uint8Array([1, 2, 3]));
    expect(page.deleteTuple(0)).toBe(true);
    expect(page.getTuple(0)).toBeNull();
    expect(page.isSlotEmpty(0)).toBe(true);
  });

  it('should return false when deleting empty slot', () => {
    const page = createPage();
    expect(page.deleteTuple(0)).toBe(false);
  });

  it('should reuse deleted slots', () => {
    const page = createPage();
    page.insertTuple(new Uint8Array([1]));
    page.insertTuple(new Uint8Array([2]));
    page.deleteTuple(0);

    const s = page.insertTuple(new Uint8Array([3]));
    expect(s).toBe(0); // Reused slot 0
    expect(Array.from(page.getTuple(0)!)).toEqual([3]);
  });

  it('should return -1 when page is full', () => {
    const page = createPage();
    // Fill the page with large tuples
    const bigTuple = new Uint8Array(1000);
    while (true) {
      const slot = page.insertTuple(bigTuple);
      if (slot === -1) break;
    }
    // Try one more
    expect(page.insertTuple(bigTuple)).toBe(-1);
  });

  it('should iterate over live tuples', () => {
    const page = createPage();
    page.insertTuple(new Uint8Array([1]));
    page.insertTuple(new Uint8Array([2]));
    page.insertTuple(new Uint8Array([3]));
    page.deleteTuple(1);

    const tuples = [...page.iterTuples()];
    expect(tuples.length).toBe(2);
    expect(tuples[0][0]).toBe(0); // slot 0
    expect(tuples[1][0]).toBe(2); // slot 2
  });

  it('should compact and recover fragmented space', () => {
    const page = createPage();
    page.insertTuple(new Uint8Array(100));
    page.insertTuple(new Uint8Array(100));
    page.insertTuple(new Uint8Array(100));

    const freeBeforeDelete = page.getFreeSpace();
    page.deleteTuple(1); // Creates fragmentation
    const freeAfterDelete = page.getFreeSpace();
    expect(freeAfterDelete).toBeGreaterThan(freeBeforeDelete);
    page.compact();

    // After compaction, free space should be at least what it was after delete
    // (fragmented space is consolidated)
    expect(page.getFreeSpace()).toBeGreaterThanOrEqual(freeAfterDelete);

    // Live tuples should still be accessible
    expect(page.getTuple(0)).not.toBeNull();
    expect(page.getTuple(1)).toBeNull(); // Still deleted
    expect(page.getTuple(2)).not.toBeNull();
  });

  it('should wrap existing page data via fromData', () => {
    const data = new Uint8Array(PAGE_SIZE);
    const page1 = SlottedPage.init(data, PAGE_SIZE, 42);
    page1.insertTuple(new Uint8Array([10, 20, 30]));

    const page2 = SlottedPage.fromData(data, PAGE_SIZE);
    expect(page2.getPageId()).toBe(42);
    expect(page2.getNumSlots()).toBe(1);
    expect(Array.from(page2.getTuple(0)!)).toEqual([10, 20, 30]);
  });
});
