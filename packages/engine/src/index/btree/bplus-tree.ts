/**
 * B+Tree: Balanced tree index with all values in leaf nodes.
 *
 * - Internal nodes store keys and child pointers
 * - Leaf nodes store key-RecordId pairs and are linked for range scans
 * - Configurable order (max keys per node)
 * - Supports insert, delete, search, and range scan
 * - Emits visualization-friendly tree structure
 */

import type { RecordId, Value } from '../../types.js';
import { type Index, compareValues, ridEquals } from '../index.js';

// ─── Node Types ──────────────────────────────────────────────────────────────

interface LeafEntry {
  key: Value;
  rid: RecordId;
}

interface LeafNode {
  type: 'leaf';
  entries: LeafEntry[];
  next: LeafNode | null; // Sibling pointer for range scans
}

interface InternalNode {
  type: 'internal';
  keys: Value[];
  children: BTreeNode[];
}

type BTreeNode = LeafNode | InternalNode;

// ─── Visualization Types ─────────────────────────────────────────────────────

export interface BTreeVizNode {
  id: string;
  type: 'leaf' | 'internal';
  keys: Value[];
  children?: BTreeVizNode[];
  entries?: Array<{ key: Value; rid: string }>;
}

// ─── B+Tree Implementation ──────────────────────────────────────────────────

export class BPlusTree implements Index {
  readonly name: string;
  private root: BTreeNode;
  private order: number; // Max keys per node
  private _size = 0;

  constructor(name: string, order: number = 4) {
    if (order < 3) throw new Error('B+Tree order must be >= 3');
    this.name = name;
    this.order = order;
    this.root = { type: 'leaf', entries: [], next: null };
  }

  // ─── Public Interface ──────────────────────────────────────────────────

  insert(key: Value, rid: RecordId): void {
    const result = this.insertInto(this.root, key, rid);
    if (result) {
      // Root was split — create new root
      const newRoot: InternalNode = {
        type: 'internal',
        keys: [result.key],
        children: [this.root, result.node],
      };
      this.root = newRoot;
    }
    this._size++;
  }

  delete(key: Value, rid: RecordId): boolean {
    const deleted = this.deleteFrom(this.root, key, rid);
    if (deleted) {
      this._size--;
      // If root is internal with single child, collapse
      if (this.root.type === 'internal' && this.root.children.length === 1) {
        this.root = this.root.children[0];
      }
    }
    return deleted;
  }

  search(key: Value): RecordId[] {
    const leaf = this.findLeaf(this.root, key);
    const results: RecordId[] = [];
    for (const entry of leaf.entries) {
      if (compareValues(entry.key, key) === 0) {
        results.push(entry.rid);
      }
    }
    return results;
  }

  rangeScan(low: Value, high: Value): Array<{ key: Value; rid: RecordId }> {
    const results: Array<{ key: Value; rid: RecordId }> = [];
    let leaf: LeafNode | null = this.findLeaf(this.root, low);

    while (leaf) {
      for (const entry of leaf.entries) {
        if (compareValues(entry.key, low) >= 0 && compareValues(entry.key, high) <= 0) {
          results.push({ key: entry.key, rid: entry.rid });
        }
        if (compareValues(entry.key, high) > 0) {
          return results;
        }
      }
      leaf = leaf.next;
    }

    return results;
  }

  size(): number {
    return this._size;
  }

  /** Get the tree structure for visualization. */
  toVizData(): BTreeVizNode {
    return this.nodeToViz(this.root, '0');
  }

  /** Get the height of the tree. */
  height(): number {
    let h = 0;
    let node: BTreeNode = this.root;
    while (node.type === 'internal') {
      h++;
      node = node.children[0];
    }
    return h + 1; // Count leaf level
  }

  // ─── Bulk Insert ──────────────────────────────────────────────────────

  /** Insert multiple sorted entries efficiently. */
  bulkInsert(entries: Array<{ key: Value; rid: RecordId }>): void {
    for (const { key, rid } of entries) {
      this.insert(key, rid);
    }
  }

  // ─── Internal: Insert ─────────────────────────────────────────────────

  private insertInto(
    node: BTreeNode,
    key: Value,
    rid: RecordId,
  ): { key: Value; node: BTreeNode } | null {
    if (node.type === 'leaf') {
      return this.insertIntoLeaf(node, key, rid);
    }
    return this.insertIntoInternal(node, key, rid);
  }

  private insertIntoLeaf(
    leaf: LeafNode,
    key: Value,
    rid: RecordId,
  ): { key: Value; node: BTreeNode } | null {
    // Find insertion position (maintain sorted order)
    let pos = 0;
    while (pos < leaf.entries.length && compareValues(leaf.entries[pos].key, key) < 0) {
      pos++;
    }
    leaf.entries.splice(pos, 0, { key, rid });

    // Check for overflow
    if (leaf.entries.length > this.order) {
      return this.splitLeaf(leaf);
    }
    return null;
  }

  private insertIntoInternal(
    node: InternalNode,
    key: Value,
    rid: RecordId,
  ): { key: Value; node: BTreeNode } | null {
    // Find child to descend into
    let childIdx = node.keys.length;
    for (let i = 0; i < node.keys.length; i++) {
      if (compareValues(key, node.keys[i]) < 0) {
        childIdx = i;
        break;
      }
    }

    const result = this.insertInto(node.children[childIdx], key, rid);
    if (!result) return null;

    // Insert the promoted key
    node.keys.splice(childIdx, 0, result.key);
    node.children.splice(childIdx + 1, 0, result.node);

    // Check for overflow
    if (node.keys.length > this.order) {
      return this.splitInternal(node);
    }
    return null;
  }

  // ─── Internal: Split ──────────────────────────────────────────────────

  private splitLeaf(leaf: LeafNode): { key: Value; node: BTreeNode } {
    const mid = Math.ceil(leaf.entries.length / 2);
    const newLeaf: LeafNode = {
      type: 'leaf',
      entries: leaf.entries.splice(mid),
      next: leaf.next,
    };
    leaf.next = newLeaf;

    // Promote copy of first key of new leaf
    return { key: newLeaf.entries[0].key, node: newLeaf };
  }

  private splitInternal(node: InternalNode): { key: Value; node: BTreeNode } {
    const mid = Math.floor(node.keys.length / 2);
    const promotedKey = node.keys[mid];

    const newNode: InternalNode = {
      type: 'internal',
      keys: node.keys.splice(mid + 1),
      children: node.children.splice(mid + 1),
    };
    node.keys.pop(); // Remove the promoted key

    return { key: promotedKey, node: newNode };
  }

  // ─── Internal: Delete ─────────────────────────────────────────────────

  private deleteFrom(node: BTreeNode, key: Value, rid: RecordId): boolean {
    if (node.type === 'leaf') {
      return this.deleteFromLeaf(node, key, rid);
    }
    return this.deleteFromInternal(node, key, rid);
  }

  private deleteFromLeaf(leaf: LeafNode, key: Value, rid: RecordId): boolean {
    const idx = leaf.entries.findIndex(
      (e) => compareValues(e.key, key) === 0 && ridEquals(e.rid, rid),
    );
    if (idx === -1) return false;
    leaf.entries.splice(idx, 1);
    return true;
  }

  private deleteFromInternal(node: InternalNode, key: Value, rid: RecordId): boolean {
    // Find child
    let childIdx = node.keys.length;
    for (let i = 0; i < node.keys.length; i++) {
      if (compareValues(key, node.keys[i]) < 0) {
        childIdx = i;
        break;
      }
    }

    const deleted = this.deleteFrom(node.children[childIdx], key, rid);
    if (!deleted) return false;

    const child = node.children[childIdx];
    const minKeys = Math.floor(this.order / 2);

    // Check if child underflows
    const childSize = child.type === 'leaf' ? child.entries.length : child.keys.length;
    if (childSize < minKeys) {
      this.handleUnderflow(node, childIdx);
    }

    return true;
  }

  private handleUnderflow(parent: InternalNode, childIdx: number): void {
    const child = parent.children[childIdx];

    // Try borrowing from left sibling
    if (childIdx > 0) {
      const leftSibling = parent.children[childIdx - 1];
      if (this.canLend(leftSibling)) {
        this.borrowFromLeft(parent, childIdx);
        return;
      }
    }

    // Try borrowing from right sibling
    if (childIdx < parent.children.length - 1) {
      const rightSibling = parent.children[childIdx + 1];
      if (this.canLend(rightSibling)) {
        this.borrowFromRight(parent, childIdx);
        return;
      }
    }

    // Merge with a sibling
    if (childIdx > 0) {
      this.mergeChildren(parent, childIdx - 1);
    } else if (childIdx < parent.children.length - 1) {
      this.mergeChildren(parent, childIdx);
    }
  }

  private canLend(node: BTreeNode): boolean {
    const minKeys = Math.floor(this.order / 2);
    const count = node.type === 'leaf' ? node.entries.length : node.keys.length;
    return count > minKeys;
  }

  private borrowFromLeft(parent: InternalNode, childIdx: number): void {
    const child = parent.children[childIdx];
    const leftSibling = parent.children[childIdx - 1];

    if (child.type === 'leaf' && leftSibling.type === 'leaf') {
      const borrowed = leftSibling.entries.pop()!;
      child.entries.unshift(borrowed);
      parent.keys[childIdx - 1] = child.entries[0].key;
    } else if (child.type === 'internal' && leftSibling.type === 'internal') {
      child.keys.unshift(parent.keys[childIdx - 1]);
      parent.keys[childIdx - 1] = leftSibling.keys.pop()!;
      child.children.unshift(leftSibling.children.pop()!);
    }
  }

  private borrowFromRight(parent: InternalNode, childIdx: number): void {
    const child = parent.children[childIdx];
    const rightSibling = parent.children[childIdx + 1];

    if (child.type === 'leaf' && rightSibling.type === 'leaf') {
      const borrowed = rightSibling.entries.shift()!;
      child.entries.push(borrowed);
      parent.keys[childIdx] = rightSibling.entries[0].key;
    } else if (child.type === 'internal' && rightSibling.type === 'internal') {
      child.keys.push(parent.keys[childIdx]);
      parent.keys[childIdx] = rightSibling.keys.shift()!;
      child.children.push(rightSibling.children.shift()!);
    }
  }

  private mergeChildren(parent: InternalNode, leftIdx: number): void {
    const left = parent.children[leftIdx];
    const right = parent.children[leftIdx + 1];

    if (left.type === 'leaf' && right.type === 'leaf') {
      left.entries.push(...right.entries);
      left.next = right.next;
    } else if (left.type === 'internal' && right.type === 'internal') {
      left.keys.push(parent.keys[leftIdx]);
      left.keys.push(...right.keys);
      left.children.push(...right.children);
    }

    // Remove the separator key and right child from parent
    parent.keys.splice(leftIdx, 1);
    parent.children.splice(leftIdx + 1, 1);
  }

  // ─── Internal: Search ─────────────────────────────────────────────────

  private findLeaf(node: BTreeNode, key: Value): LeafNode {
    if (node.type === 'leaf') return node;

    let childIdx = node.keys.length;
    for (let i = 0; i < node.keys.length; i++) {
      if (compareValues(key, node.keys[i]) < 0) {
        childIdx = i;
        break;
      }
    }
    return this.findLeaf(node.children[childIdx], key);
  }

  // ─── Visualization ────────────────────────────────────────────────────

  private nodeToViz(node: BTreeNode, id: string): BTreeVizNode {
    if (node.type === 'leaf') {
      return {
        id,
        type: 'leaf',
        keys: node.entries.map((e) => e.key),
        entries: node.entries.map((e) => ({
          key: e.key,
          rid: `${e.rid.pageId.pageNum}:${e.rid.slotNum}`,
        })),
      };
    }

    return {
      id,
      type: 'internal',
      keys: [...node.keys],
      children: node.children.map((child, i) => this.nodeToViz(child, `${id}-${i}`)),
    };
  }
}
