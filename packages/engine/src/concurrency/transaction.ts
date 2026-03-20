/**
 * Transaction: Represents a database transaction with state tracking.
 *
 * Tracks transaction state (ACTIVE → COMMITTED/ABORTED), write set
 * for undo operations, and read set for validation.
 */

import type { RecordId, Tuple } from '../types.js';

export enum TransactionState {
  ACTIVE = 'ACTIVE',
  COMMITTED = 'COMMITTED',
  ABORTED = 'ABORTED',
}

export type TransactionId = number;

export interface WriteRecord {
  table: string;
  rid: RecordId;
  type: 'insert' | 'update' | 'delete';
  /** Old tuple (for undo of update/delete). */
  oldTuple?: Tuple;
  /** New tuple (for redo of insert/update). */
  newTuple?: Tuple;
}

export interface ReadRecord {
  table: string;
  rid: RecordId;
}

export class Transaction {
  readonly txnId: TransactionId;
  readonly startTimestamp: number;
  private state: TransactionState = TransactionState.ACTIVE;
  private writeSet: WriteRecord[] = [];
  private readSet: ReadRecord[] = [];
  private heldLocks: Set<string> = new Set();

  constructor(txnId: TransactionId, startTimestamp: number) {
    this.txnId = txnId;
    this.startTimestamp = startTimestamp;
  }

  getState(): TransactionState {
    return this.state;
  }

  isActive(): boolean {
    return this.state === TransactionState.ACTIVE;
  }

  setState(state: TransactionState): void {
    this.state = state;
  }

  // ─── Write Set ──────────────────────────────────────────────────────────────

  addWriteRecord(record: WriteRecord): void {
    this.writeSet.push(record);
  }

  getWriteSet(): readonly WriteRecord[] {
    return this.writeSet;
  }

  // ─── Read Set ───────────────────────────────────────────────────────────────

  addReadRecord(record: ReadRecord): void {
    this.readSet.push(record);
  }

  getReadSet(): readonly ReadRecord[] {
    return this.readSet;
  }

  // ─── Lock Tracking ─────────────────────────────────────────────────────────

  addLock(lockKey: string): void {
    this.heldLocks.add(lockKey);
  }

  removeLock(lockKey: string): void {
    this.heldLocks.delete(lockKey);
  }

  getHeldLocks(): ReadonlySet<string> {
    return this.heldLocks;
  }

  clearLocks(): void {
    this.heldLocks.clear();
  }
}
