/**
 * Transaction Manager: Manages transaction lifecycle (BEGIN/COMMIT/ABORT).
 *
 * Coordinates with LockManager for 2PL and MVCCManager for MVCC.
 * Emits events for UI visualization.
 */

import { Transaction, TransactionState } from './transaction.js';
import type { TransactionId } from './transaction.js';
import type { LockManager } from './lock-manager.js';
import type { MVCCManager } from './mvcc/mvcc-manager.js';
import { ConcurrencyMode, EngineEventType } from '../types.js';
import type { ConfigRegistry } from '../config/config-registry.js';

export class TransactionManager {
  private nextTxnId: TransactionId = 1;
  private nextTimestamp = 1;
  private activeTransactions: Map<TransactionId, Transaction> = new Map();
  private allTransactions: Map<TransactionId, Transaction> = new Map();
  private lockManager: LockManager | null = null;
  private mvccManager: MVCCManager | null = null;
  private config: ConfigRegistry;

  constructor(config: ConfigRegistry) {
    this.config = config;
  }

  setLockManager(lm: LockManager): void {
    this.lockManager = lm;
  }

  setMVCCManager(mm: MVCCManager): void {
    this.mvccManager = mm;
  }

  /** Begin a new transaction. */
  begin(): Transaction {
    const txnId = this.nextTxnId++;
    const timestamp = this.nextTimestamp++;
    const txn = new Transaction(txnId, timestamp);

    this.activeTransactions.set(txnId, txn);
    this.allTransactions.set(txnId, txn);

    this.config.emitEvent({
      type: EngineEventType.TX_BEGIN,
      timestamp: Date.now(),
      data: { txnId },
    });

    return txn;
  }

  /** Commit a transaction — release all locks. */
  commit(txnId: TransactionId): void {
    const txn = this.getActiveTransaction(txnId);

    txn.setState(TransactionState.COMMITTED);
    this.releaseLocks(txn);

    if (this.mvccManager && this.config.get('concurrencyMode') === ConcurrencyMode.MVCC) {
      this.mvccManager.onCommit(txn);
    }

    this.activeTransactions.delete(txnId);

    this.config.emitEvent({
      type: EngineEventType.TX_COMMIT,
      timestamp: Date.now(),
      data: { txnId },
    });
  }

  /** Abort a transaction — undo writes and release locks. */
  abort(txnId: TransactionId): void {
    const txn = this.getActiveTransaction(txnId);

    txn.setState(TransactionState.ABORTED);

    if (this.mvccManager && this.config.get('concurrencyMode') === ConcurrencyMode.MVCC) {
      this.mvccManager.onAbort(txn);
    }

    this.releaseLocks(txn);
    this.activeTransactions.delete(txnId);

    this.config.emitEvent({
      type: EngineEventType.TX_ABORT,
      timestamp: Date.now(),
      data: { txnId },
    });
  }

  getTransaction(txnId: TransactionId): Transaction | undefined {
    return this.allTransactions.get(txnId);
  }

  getActiveTransaction(txnId: TransactionId): Transaction {
    const txn = this.activeTransactions.get(txnId);
    if (!txn) {
      throw new Error(`Transaction ${txnId} is not active`);
    }
    return txn;
  }

  getActiveTransactions(): Transaction[] {
    return Array.from(this.activeTransactions.values());
  }

  getActiveCount(): number {
    return this.activeTransactions.size;
  }

  /** Generate a new timestamp for MVCC. */
  nextTs(): number {
    return this.nextTimestamp++;
  }

  private releaseLocks(txn: Transaction): void {
    if (this.lockManager && this.config.get('concurrencyMode') === ConcurrencyMode.TWO_PL) {
      this.lockManager.releaseAll(txn.txnId);
    }
    txn.clearLocks();
  }
}
