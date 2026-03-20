/**
 * Deadlock Detection and Prevention Strategies.
 *
 * - DETECTION: Uses waits-for graph with DFS cycle detection.
 *   When a cycle is found, the youngest transaction is aborted.
 *
 * - WAIT_DIE: Older transactions wait for younger ones; younger ones die (abort)
 *   if they would need to wait for an older one. Non-preemptive.
 *
 * - WOUND_WAIT: Older transactions wound (abort) younger ones holding the lock;
 *   younger transactions wait for older ones. Preemptive.
 */

import type { TransactionId } from './transaction.js';
import type { TransactionManager } from './transaction-manager.js';
import type { LockManager, LockMode } from './lock-manager.js';
import { DeadlockStrategy, EngineEventType } from '../types.js';
import type { ConfigRegistry } from '../config/config-registry.js';

export interface DeadlockResult {
  detected: boolean;
  cycle?: TransactionId[];
  victimTxnId?: TransactionId;
}

export class DeadlockDetector {
  private config: ConfigRegistry;
  private txnManager: TransactionManager;
  private lockManager: LockManager;

  constructor(
    config: ConfigRegistry,
    txnManager: TransactionManager,
    lockManager: LockManager,
  ) {
    this.config = config;
    this.txnManager = txnManager;
    this.lockManager = lockManager;
  }

  /**
   * Check if a lock request would cause a deadlock or should be rejected.
   * Returns the victim transaction to abort, or null if the request is safe.
   *
   * For DETECTION: checks after adding to wait queue.
   * For WAIT_DIE/WOUND_WAIT: checks before granting.
   */
  check(
    requestingTxnId: TransactionId,
    _resourceKey: string,
    _mode: LockMode,
    holdingTxnIds: TransactionId[],
  ): DeadlockResult {
    const strategy = this.config.get('deadlockStrategy') as DeadlockStrategy;

    switch (strategy) {
      case DeadlockStrategy.DETECTION:
        return this.detectCycle(requestingTxnId);

      case DeadlockStrategy.WAIT_DIE:
        return this.waitDie(requestingTxnId, holdingTxnIds);

      case DeadlockStrategy.WOUND_WAIT:
        return this.woundWait(requestingTxnId, holdingTxnIds);

      default:
        return { detected: false };
    }
  }

  /** Run periodic deadlock detection on the waits-for graph. */
  runDetection(): DeadlockResult {
    const cycle = this.lockManager.hasDeadlock();
    if (!cycle) return { detected: false };

    // Pick the youngest transaction (highest txnId) as victim
    const victimTxnId = Math.max(...cycle.filter((id, i, arr) => i < arr.length - 1));

    this.config.emitEvent({
      type: EngineEventType.DEADLOCK_DETECTED,
      timestamp: Date.now(),
      data: { cycle, victimTxnId },
    });

    return { detected: true, cycle, victimTxnId };
  }

  private detectCycle(requestingTxnId: TransactionId): DeadlockResult {
    const cycle = this.lockManager.detectDeadlock(requestingTxnId);
    if (!cycle) return { detected: false };

    // Pick youngest in cycle as victim
    const uniqueTxns = [...new Set(cycle.slice(0, -1))];
    const victimTxnId = Math.max(...uniqueTxns);

    this.config.emitEvent({
      type: EngineEventType.DEADLOCK_DETECTED,
      timestamp: Date.now(),
      data: { cycle, victimTxnId },
    });

    return { detected: true, cycle, victimTxnId };
  }

  /**
   * Wait-Die (non-preemptive):
   * - If requesting txn is OLDER (lower id) than holder → WAIT
   * - If requesting txn is YOUNGER (higher id) than holder → DIE (abort self)
   */
  private waitDie(
    requestingTxnId: TransactionId,
    holdingTxnIds: TransactionId[],
  ): DeadlockResult {
    const requestingTxn = this.txnManager.getTransaction(requestingTxnId);
    if (!requestingTxn) return { detected: false };

    for (const holderId of holdingTxnIds) {
      if (holderId === requestingTxnId) continue;
      const holderTxn = this.txnManager.getTransaction(holderId);
      if (!holderTxn) continue;

      // Younger requesting → must die
      if (requestingTxn.startTimestamp > holderTxn.startTimestamp) {
        return {
          detected: true,
          victimTxnId: requestingTxnId,
        };
      }
    }

    // Older requesting → allowed to wait
    return { detected: false };
  }

  /**
   * Wound-Wait (preemptive):
   * - If requesting txn is OLDER (lower id) than holder → WOUND (abort holder)
   * - If requesting txn is YOUNGER (higher id) than holder → WAIT
   */
  private woundWait(
    requestingTxnId: TransactionId,
    holdingTxnIds: TransactionId[],
  ): DeadlockResult {
    const requestingTxn = this.txnManager.getTransaction(requestingTxnId);
    if (!requestingTxn) return { detected: false };

    for (const holderId of holdingTxnIds) {
      if (holderId === requestingTxnId) continue;
      const holderTxn = this.txnManager.getTransaction(holderId);
      if (!holderTxn) continue;

      // Older requesting → wound the younger holder
      if (requestingTxn.startTimestamp < holderTxn.startTimestamp) {
        return {
          detected: true,
          victimTxnId: holderId,
        };
      }
    }

    // Younger requesting → allowed to wait
    return { detected: false };
  }
}
