/**
 * Isolation Level Simulator: Demonstrates anomalies at different isolation levels.
 *
 * Simulates concurrent transaction interleaving to show:
 * - Dirty reads (READ_UNCOMMITTED allows, READ_COMMITTED prevents)
 * - Non-repeatable reads (READ_COMMITTED allows, REPEATABLE_READ prevents)
 * - Phantom reads (REPEATABLE_READ allows, SERIALIZABLE prevents)
 *
 * Uses a deterministic scheduler to interleave operations from multiple
 * transactions in a controlled manner.
 */

import { IsolationLevel } from '../types.js';
import type { Tuple, RecordId } from '../types.js';
import type { Transaction, TransactionId } from './transaction.js';
import { TransactionManager } from './transaction-manager.js';
import { MVCCManager } from './mvcc/mvcc-manager.js';
import type { ConfigRegistry } from '../config/config-registry.js';

export type OpType = 'read' | 'write' | 'delete' | 'commit' | 'abort';

export interface SimOp {
  txnId: TransactionId;
  type: OpType;
  table?: string;
  rid?: RecordId;
  tuple?: Tuple;
}

export interface SimResult {
  txnId: TransactionId;
  op: OpType;
  readValue?: Tuple | null;
  success: boolean;
  note?: string;
}

/**
 * Simulates executing a schedule of operations under a given isolation level.
 * Uses MVCC internally, adjusting visibility rules based on isolation level.
 */
export class IsolationSimulator {
  private txnManager: TransactionManager;
  private mvcc: MVCCManager;
  private txnMap: Map<TransactionId, Transaction> = new Map();
  private isolationLevel: IsolationLevel;

  constructor(config: ConfigRegistry, isolationLevel: IsolationLevel) {
    this.txnManager = new TransactionManager(config);
    this.mvcc = new MVCCManager();
    // Don't wire mvcc to txnManager — we manage MVCC hooks directly
    this.isolationLevel = isolationLevel;
  }

  /** Begin a transaction and return its ID. */
  begin(): TransactionId {
    const txn = this.txnManager.begin();
    this.txnMap.set(txn.txnId, txn);
    return txn.txnId;
  }

  /** Read a row. Behavior depends on isolation level. */
  read(txnId: TransactionId, table: string, rid: RecordId): Tuple | null {
    const txn = this.getTxn(txnId);

    if (this.isolationLevel === IsolationLevel.READ_UNCOMMITTED) {
      // Can see uncommitted data — read the latest version regardless
      return this.readLatest(table, rid);
    }

    // READ_COMMITTED, REPEATABLE_READ, SERIALIZABLE all use MVCC visibility
    // For READ_COMMITTED, we take a fresh snapshot per read
    if (this.isolationLevel === IsolationLevel.READ_COMMITTED) {
      // Create a temporary "fresh snapshot" transaction for reading
      const freshTxn = this.txnManager.begin();
      const result = this.mvcc.read(freshTxn, table, rid);
      // We don't commit this temporary txn, just use it for snapshot
      this.txnManager.abort(freshTxn.txnId);
      return result;
    }

    // REPEATABLE_READ and SERIALIZABLE use the txn's own snapshot
    return this.mvcc.read(txn, table, rid);
  }

  /** Write (insert or update) a row. */
  write(txnId: TransactionId, table: string, rid: RecordId, tuple: Tuple): boolean {
    const txn = this.getTxn(txnId);

    // Check for existing version
    const chain = this.mvcc.getVersionChain(table, rid);
    if (chain.length === 0) {
      return this.mvcc.insert(txn, table, rid, tuple);
    }
    return this.mvcc.update(txn, table, rid, tuple);
  }

  /** Delete a row. */
  delete(txnId: TransactionId, table: string, rid: RecordId): boolean {
    const txn = this.getTxn(txnId);
    return this.mvcc.delete(txn, table, rid);
  }

  /** Commit a transaction. */
  commit(txnId: TransactionId): void {
    const txn = this.txnMap.get(txnId)!;
    this.mvcc.onCommit(txn);
    this.txnManager.commit(txnId);
  }

  /** Abort a transaction. */
  abort(txnId: TransactionId): void {
    const txn = this.txnMap.get(txnId)!;
    this.mvcc.onAbort(txn);
    this.txnManager.abort(txnId);
  }

  /**
   * Execute a schedule of operations and return results.
   */
  executeSchedule(operations: SimOp[]): SimResult[] {
    const results: SimResult[] = [];

    for (const op of operations) {
      let result: SimResult;

      switch (op.type) {
        case 'read':
          {
            const value = this.read(op.txnId, op.table!, op.rid!);
            result = { txnId: op.txnId, op: 'read', readValue: value, success: true };
          }
          break;

        case 'write':
          {
            const ok = this.write(op.txnId, op.table!, op.rid!, op.tuple!);
            result = { txnId: op.txnId, op: 'write', success: ok };
            if (!ok) result.note = 'write-write conflict';
          }
          break;

        case 'delete':
          {
            const ok = this.delete(op.txnId, op.table!, op.rid!);
            result = { txnId: op.txnId, op: 'delete', success: ok };
          }
          break;

        case 'commit':
          this.commit(op.txnId);
          result = { txnId: op.txnId, op: 'commit', success: true };
          break;

        case 'abort':
          this.abort(op.txnId);
          result = { txnId: op.txnId, op: 'abort', success: true };
          break;

        default:
          result = { txnId: op.txnId, op: op.type, success: false, note: 'unknown operation' };
      }

      results.push(result);
    }

    return results;
  }

  private getTxn(txnId: TransactionId): Transaction {
    const txn = this.txnMap.get(txnId);
    if (!txn) throw new Error(`Transaction ${txnId} not found`);
    return txn;
  }

  /**
   * Read the latest version of a row regardless of visibility (for READ_UNCOMMITTED).
   */
  private readLatest(table: string, rid: RecordId): Tuple | null {
    const chain = this.mvcc.getVersionChain(table, rid);
    if (chain.length === 0) return null;
    // Return the newest version that hasn't been deleted
    const live = chain.find(v => v.deletedBy === null);
    return live?.tuple ?? null;
  }
}
