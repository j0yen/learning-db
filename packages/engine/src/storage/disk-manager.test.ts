import { describe, it, expect } from 'vitest';
import { MemoryDiskManager } from './disk-manager.js';

describe('MemoryDiskManager', () => {
  it('should allocate pages with sequential page numbers', () => {
    const dm = new MemoryDiskManager(4096);
    expect(dm.allocatePage()).toBe(0);
    expect(dm.allocatePage()).toBe(1);
    expect(dm.allocatePage()).toBe(2);
    expect(dm.getNumPages()).toBe(3);
  });

  it('should read/write pages correctly', () => {
    const dm = new MemoryDiskManager(4096);
    const pageNum = dm.allocatePage();

    const writeData = new Uint8Array(4096);
    writeData[0] = 0xde;
    writeData[1] = 0xad;
    writeData[4095] = 0xff;
    dm.writePage(pageNum, writeData);

    const readData = new Uint8Array(4096);
    dm.readPage(pageNum, readData);
    expect(readData[0]).toBe(0xde);
    expect(readData[1]).toBe(0xad);
    expect(readData[4095]).toBe(0xff);
  });

  it('should throw on reading non-existent page', () => {
    const dm = new MemoryDiskManager(4096);
    const buf = new Uint8Array(4096);
    expect(() => dm.readPage(99, buf)).toThrow('Page 99 does not exist');
  });

  it('should throw on writing non-existent page', () => {
    const dm = new MemoryDiskManager(4096);
    const buf = new Uint8Array(4096);
    expect(() => dm.writePage(99, buf)).toThrow('Page 99 does not exist');
  });

  it('should deallocate and reuse pages', () => {
    const dm = new MemoryDiskManager(4096);
    const p0 = dm.allocatePage();
    const p1 = dm.allocatePage();
    dm.deallocatePage(p0);
    expect(dm.getNumPages()).toBe(1);

    // Should reuse page 0
    const p2 = dm.allocatePage();
    expect(p2).toBe(p0);
  });

  it('should throw on deallocating non-existent page', () => {
    const dm = new MemoryDiskManager(4096);
    expect(() => dm.deallocatePage(99)).toThrow();
  });

  it('should initialize pages with zeros', () => {
    const dm = new MemoryDiskManager(4096);
    const pageNum = dm.allocatePage();
    const buf = new Uint8Array(4096);
    dm.readPage(pageNum, buf);
    for (let i = 0; i < 4096; i++) {
      expect(buf[i]).toBe(0);
    }
  });

  it('should support different page sizes', () => {
    const dm = new MemoryDiskManager(8192);
    expect(dm.pageSize).toBe(8192);
    const pageNum = dm.allocatePage();
    const buf = new Uint8Array(8192);
    dm.readPage(pageNum, buf);
    expect(buf.byteLength).toBe(8192);
  });
});
