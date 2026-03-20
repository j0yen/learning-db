/**
 * Lock Manager: Manages shared (S) and exclusive (X) locks with Strict 2PL.
 *
 * Lock compatibility matrix:
 *        | S-LOCK | X-LOCK
 * S-LOCK |  Yes   |  No
 * X-LOCK |  No    |  No
 *
 * Strict 2PL: All locks held until transaction commits or aborts.
 * Supports lock upgrade (S → X) when the transaction is the only holder.
 */

import type { TransactionId } from './transaction.js';
import { EngineEventType } from '../types.js';
import type { ConfigRegistry } from '../config/config-registry.js';

export enum LockMode {
  SHARED = 'SHARED',
  EXCLUSIVE = 'EXCLUSIVE',
}

export interface LockRequest {
  txnId: TransactionId;
  mode: LockMode;
  granted: boolean;
}

interface LockEntry {
  /** Granted lock holders. */
  holders: Map<TransactionId, LockMode>;
  /** Waiting queue (FIFO). */
  waitQueue: LockRequest[];
}

export class LockManager {
  private lockTable: Map<string, LockEntry> = new Map();
  /** Maps txnId → set of lock keys held. */
  private txnLocks: Map<TransactionId, Set<string>> = new Map();
  /** Maps txnId → set of txnIds it's waiting on (for deadlock detection). */
  private waitForGraph: Map<TransactionId, Set<TransactionId>> = new Map();
  private config: ConfigRegistry;

  constructor(config: ConfigRegistry) {
    this.config = config;
  }

  /**
   * Build a resource key from table + optional record identifier.
   * Table-level: "table:users", Row-level: "row:users:1:3"
   */
  static tableKey(table: string): string {
    return `table:${table}`;
  }

  static rowKey(table: string, pageNum: number, slotNum: number): string {
    return `row:${table}:${pageNum}:${slotNum}`;
  }

  /**
   * Acquire a lock. Returns true if granted immediately, false if must wait.
   * Throws if deadlock would occur (in detection mode).
   */
  lock(txnId: TransactionId, resourceKey: string, mode: LockMode): boolean {
    let entry = this.lockTable.get(resourceKey);
    if (!entry) {
      entry = { holders: new Map(), waitQueue: [] };
      this.lockTable.set(resourceKey, entry);
    }

    // Already hold this lock?
    const currentMode = entry.holders.get(txnId);
    if (currentMode !== undefined) {
      if (currentMode === mode || currentMode === LockMode.EXCLUSIVE) {
        // Already have sufficient lock
        return true;
      }
      // Need upgrade: S → X
      if (mode === LockMode.EXCLUSIVE && currentMode === LockMode.SHARED) {
        return this.tryUpgrade(txnId, resourceKey, entry);
      }
    }

    // Try to grant immediately
    if (this.isCompatible(entry, txnId, mode)) {
      this.grantLock(txnId, resourceKey, entry, mode);
      return true;
    }

    // Must wait — add to queue
    const request: LockRequest = { txnId, mode, granted: false };
    entry.waitQueue.push(request);
    this.addWaitEdges(txnId, entry);

    this.config.emitEvent({
      type: EngineEventType.LOCK_WAIT,
      timestamp: Date.now(),
      data: { txnId, resourceKey, mode },
    });

    return false;
  }

  /**
   * Try to grant waiting requests after a lock release.
   */
  private processWaitQueue(resourceKey: string): void {
    const entry = this.lockTable.get(resourceKey);
    if (!entry) return;

    const stillWaiting: LockRequest[] = [];

    for (const request of entry.waitQueue) {
      if (this.isCompatible(entry, request.txnId, request.mode)) {
        request.granted = true;
        this.grantLock(request.txnId, resourceKey, entry, request.mode);
        this.removeWaitEdges(request.txnId);
      } else {
        stillWaiting.push(request);
      }
    }

    entry.waitQueue = stillWaiting;
  }

  /** Release a specific lock. */
  unlock(txnId: TransactionId, resourceKey: string): void {
    const entry = this.lockTable.get(resourceKey);
    if (!entry) return;

    entry.holders.delete(txnId);

    const txnSet = this.txnLocks.get(txnId);
    if (txnSet) txnSet.delete(resourceKey);

    this.config.emitEvent({
      type: EngineEventType.LOCK_RELEASE,
      timestamp: Date.now(),
      data: { txnId, resourceKey },
    });

    this.processWaitQueue(resourceKey);

    // Clean up empty entries
    if (entry.holders.size === 0 && entry.waitQueue.length === 0) {
      this.lockTable.delete(resourceKey);
    }
  }

  /** Release all locks held by a transaction (called on commit/abort). */
  releaseAll(txnId: TransactionId): void {
    const keys = this.txnLocks.get(txnId);
    if (!keys) return;

    for (const key of Array.from(keys)) {
      this.unlock(txnId, key);
    }
    this.txnLocks.delete(txnId);
    this.removeWaitEdges(txnId);
    // Also remove this txn from others' wait edges
    for (const [, waitingOn] of this.waitForGraph) {
      waitingOn.delete(txnId);
    }
  }

  /** Check if a deadlock exists from txnId. Returns the cycle if found. */
  detectDeadlock(txnId: TransactionId): TransactionId[] | null {
    const visited = new Set<TransactionId>();
    const path: TransactionId[] = [];

    const dfs = (current: TransactionId): TransactionId[] | null => {
      if (path.includes(current)) {
        // Found cycle — return the cycle portion
        const cycleStart = path.indexOf(current);
        return path.slice(cycleStart).concat(current);
      }
      if (visited.has(current)) return null;

      visited.add(current);
      path.push(current);

      const neighbors = this.waitForGraph.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          const cycle = dfs(neighbor);
          if (cycle) return cycle;
        }
      }

      path.pop();
      return null;
    };

    return dfs(txnId);
  }

  /** Check for deadlock involving any waiting transaction. */
  hasDeadlock(): TransactionId[] | null {
    for (const txnId of this.waitForGraph.keys()) {
      const cycle = this.detectDeadlock(txnId);
      if (cycle) return cycle;
    }
    return null;
  }

  /** Get the waits-for graph for visualization. */
  getWaitForGraph(): Map<TransactionId, Set<TransactionId>> {
    return new Map(this.waitForGraph);
  }

  /** Get lock table state for visualization. */
  getLockTableState(): Array<{
    resource: string;
    holders: Array<{ txnId: TransactionId; mode: LockMode }>;
    waiters: Array<{ txnId: TransactionId; mode: LockMode }>;
  }> {
    const result = [];
    for (const [resource, entry] of this.lockTable) {
      result.push({
        resource,
        holders: Array.from(entry.holders.entries()).map(([txnId, mode]) => ({ txnId, mode })),
        waiters: entry.waitQueue.map(r => ({ txnId: r.txnId, mode: r.mode })),
      });
    }
    return result;
  }

  /** Get all locks held by a transaction. */
  getLocksForTxn(txnId: TransactionId): string[] {
    return Array.from(this.txnLocks.get(txnId) ?? []);
  }

  private tryUpgrade(txnId: TransactionId, resourceKey: string, entry: LockEntry): boolean {
    // Can upgrade S→X if we're the only holder
    if (entry.holders.size === 1 && entry.holders.has(txnId)) {
      entry.holders.set(txnId, LockMode.EXCLUSIVE);

      this.config.emitEvent({
        type: EngineEventType.LOCK_ACQUIRE,
        timestamp: Date.now(),
        data: { txnId, resourceKey, mode: LockMode.EXCLUSIVE, upgrade: true },
      });

      return true;
    }

    // Cannot upgrade — would deadlock with other S-lock holders
    return false;
  }

  private isCompatible(entry: LockEntry, txnId: TransactionId, mode: LockMode): boolean {
    if (entry.holders.size === 0) return true;

    for (const [holderId, holderMode] of entry.holders) {
      if (holderId === txnId) continue; // Don't conflict with self

      if (mode === LockMode.EXCLUSIVE || holderMode === LockMode.EXCLUSIVE) {
        return false;
      }
    }

    // Also check: no one in the wait queue should be ahead of us
    // This prevents starvation — first-come-first-served
    if (entry.waitQueue.length > 0 && !entry.waitQueue.some(r => r.txnId === txnId)) {
      // There are waiters before us, but we only need to wait if there's an X-lock waiting
      // (prevents S-lock starvation)
      if (entry.waitQueue.some(r => r.mode === LockMode.EXCLUSIVE)) {
        return false;
      }
    }

    return true;
  }

  private grantLock(
    txnId: TransactionId,
    resourceKey: string,
    entry: LockEntry,
    mode: LockMode,
  ): void {
    entry.holders.set(txnId, mode);

    let txnSet = this.txnLocks.get(txnId);
    if (!txnSet) {
      txnSet = new Set();
      this.txnLocks.set(txnId, txnSet);
    }
    txnSet.add(resourceKey);

    this.config.emitEvent({
      type: EngineEventType.LOCK_ACQUIRE,
      timestamp: Date.now(),
      data: { txnId, resourceKey, mode },
    });
  }

  private addWaitEdges(txnId: TransactionId, entry: LockEntry): void {
    let edges = this.waitForGraph.get(txnId);
    if (!edges) {
      edges = new Set();
      this.waitForGraph.set(txnId, edges);
    }
    for (const holderId of entry.holders.keys()) {
      if (holderId !== txnId) {
        edges.add(holderId);
      }
    }
  }

  private removeWaitEdges(txnId: TransactionId): void {
    this.waitForGraph.delete(txnId);
  }
}
