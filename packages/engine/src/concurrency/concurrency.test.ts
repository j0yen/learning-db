import { describe, it, expect, beforeEach } from 'vitest';
import { Transaction, TransactionState } from './transaction.js';
import { TransactionManager } from './transaction-manager.js';
import { LockManager, LockMode } from './lock-manager.js';
import { DeadlockDetector } from './deadlock-detector.js';
import { MVCCManager } from './mvcc/mvcc-manager.js';
import { IsolationSimulator } from './isolation-simulator.js';
import { ConfigRegistry } from '../config/config-registry.js';
import { ConcurrencyMode, DeadlockStrategy, IsolationLevel } from '../types.js';
import type { RecordId } from '../types.js';

function makeRid(page: number, slot: number): RecordId {
  return { pageId: { fileId: 0, pageNum: page }, slotNum: slot };
}

describe('Transaction', () => {
  it('should have correct initial state', () => {
    const txn = new Transaction(1, 100);
    expect(txn.txnId).toBe(1);
    expect(txn.startTimestamp).toBe(100);
    expect(txn.getState()).toBe(TransactionState.ACTIVE);
    expect(txn.isActive()).toBe(true);
  });

  it('should track state transitions', () => {
    const txn = new Transaction(1, 100);
    txn.setState(TransactionState.COMMITTED);
    expect(txn.getState()).toBe(TransactionState.COMMITTED);
    expect(txn.isActive()).toBe(false);
  });

  it('should track write set', () => {
    const txn = new Transaction(1, 100);
    txn.addWriteRecord({
      table: 'users',
      rid: makeRid(0, 0),
      type: 'insert',
      newTuple: [1, 'alice'],
    });
    expect(txn.getWriteSet().length).toBe(1);
    expect(txn.getWriteSet()[0].table).toBe('users');
  });

  it('should track read set', () => {
    const txn = new Transaction(1, 100);
    txn.addReadRecord({ table: 'users', rid: makeRid(0, 0) });
    txn.addReadRecord({ table: 'users', rid: makeRid(0, 1) });
    expect(txn.getReadSet().length).toBe(2);
  });

  it('should track locks', () => {
    const txn = new Transaction(1, 100);
    txn.addLock('table:users');
    txn.addLock('row:users:0:0');
    expect(txn.getHeldLocks().size).toBe(2);
    txn.removeLock('table:users');
    expect(txn.getHeldLocks().size).toBe(1);
    txn.clearLocks();
    expect(txn.getHeldLocks().size).toBe(0);
  });
});

describe('TransactionManager', () => {
  let config: ConfigRegistry;
  let txnMgr: TransactionManager;

  beforeEach(() => {
    config = new ConfigRegistry();
    txnMgr = new TransactionManager(config);
  });

  it('should begin transactions with incrementing IDs', () => {
    const t1 = txnMgr.begin();
    const t2 = txnMgr.begin();
    expect(t1.txnId).toBe(1);
    expect(t2.txnId).toBe(2);
    expect(txnMgr.getActiveCount()).toBe(2);
  });

  it('should commit a transaction', () => {
    const t1 = txnMgr.begin();
    txnMgr.commit(t1.txnId);
    expect(t1.getState()).toBe(TransactionState.COMMITTED);
    expect(txnMgr.getActiveCount()).toBe(0);
  });

  it('should abort a transaction', () => {
    const t1 = txnMgr.begin();
    txnMgr.abort(t1.txnId);
    expect(t1.getState()).toBe(TransactionState.ABORTED);
    expect(txnMgr.getActiveCount()).toBe(0);
  });

  it('should throw on commit/abort of inactive transaction', () => {
    const t1 = txnMgr.begin();
    txnMgr.commit(t1.txnId);
    expect(() => txnMgr.commit(t1.txnId)).toThrow();
    expect(() => txnMgr.abort(t1.txnId)).toThrow();
  });

  it('should release locks on commit in 2PL mode', () => {
    config.set('concurrencyMode', ConcurrencyMode.TWO_PL);
    const lockMgr = new LockManager(config);
    txnMgr.setLockManager(lockMgr);

    const t1 = txnMgr.begin();
    lockMgr.lock(t1.txnId, 'table:users', LockMode.EXCLUSIVE);

    expect(lockMgr.getLocksForTxn(t1.txnId).length).toBe(1);
    txnMgr.commit(t1.txnId);
    expect(lockMgr.getLocksForTxn(t1.txnId).length).toBe(0);
  });

  it('should list active transactions', () => {
    const t1 = txnMgr.begin();
    const t2 = txnMgr.begin();
    txnMgr.commit(t1.txnId);
    const active = txnMgr.getActiveTransactions();
    expect(active.length).toBe(1);
    expect(active[0].txnId).toBe(t2.txnId);
  });
});

describe('LockManager', () => {
  let config: ConfigRegistry;
  let lockMgr: LockManager;

  beforeEach(() => {
    config = new ConfigRegistry();
    lockMgr = new LockManager(config);
  });

  it('should grant shared lock on empty resource', () => {
    const granted = lockMgr.lock(1, 'table:users', LockMode.SHARED);
    expect(granted).toBe(true);
  });

  it('should grant exclusive lock on empty resource', () => {
    const granted = lockMgr.lock(1, 'table:users', LockMode.EXCLUSIVE);
    expect(granted).toBe(true);
  });

  it('should allow multiple shared locks', () => {
    lockMgr.lock(1, 'table:users', LockMode.SHARED);
    const granted = lockMgr.lock(2, 'table:users', LockMode.SHARED);
    expect(granted).toBe(true);
  });

  it('should block exclusive lock when shared lock held', () => {
    lockMgr.lock(1, 'table:users', LockMode.SHARED);
    const granted = lockMgr.lock(2, 'table:users', LockMode.EXCLUSIVE);
    expect(granted).toBe(false);
  });

  it('should block shared lock when exclusive lock held', () => {
    lockMgr.lock(1, 'table:users', LockMode.EXCLUSIVE);
    const granted = lockMgr.lock(2, 'table:users', LockMode.SHARED);
    expect(granted).toBe(false);
  });

  it('should block exclusive lock when exclusive lock held', () => {
    lockMgr.lock(1, 'table:users', LockMode.EXCLUSIVE);
    const granted = lockMgr.lock(2, 'table:users', LockMode.EXCLUSIVE);
    expect(granted).toBe(false);
  });

  it('should allow same txn to re-acquire same lock', () => {
    lockMgr.lock(1, 'table:users', LockMode.SHARED);
    const granted = lockMgr.lock(1, 'table:users', LockMode.SHARED);
    expect(granted).toBe(true);
  });

  it('should upgrade S → X when sole holder', () => {
    lockMgr.lock(1, 'table:users', LockMode.SHARED);
    const upgraded = lockMgr.lock(1, 'table:users', LockMode.EXCLUSIVE);
    expect(upgraded).toBe(true);
  });

  it('should fail upgrade when other holders exist', () => {
    lockMgr.lock(1, 'table:users', LockMode.SHARED);
    lockMgr.lock(2, 'table:users', LockMode.SHARED);
    const upgraded = lockMgr.lock(1, 'table:users', LockMode.EXCLUSIVE);
    expect(upgraded).toBe(false);
  });

  it('should release lock and grant waiting requests', () => {
    lockMgr.lock(1, 'table:users', LockMode.EXCLUSIVE);
    lockMgr.lock(2, 'table:users', LockMode.SHARED); // Should wait

    const stateBefore = lockMgr.getLockTableState();
    const entry = stateBefore.find(e => e.resource === 'table:users')!;
    expect(entry.waiters.length).toBe(1);

    lockMgr.unlock(1, 'table:users');

    // After release, txn 2 should be granted
    const stateAfter = lockMgr.getLockTableState();
    const entryAfter = stateAfter.find(e => e.resource === 'table:users')!;
    expect(entryAfter.holders.length).toBe(1);
    expect(entryAfter.holders[0].txnId).toBe(2);
    expect(entryAfter.waiters.length).toBe(0);
  });

  it('should release all locks for a transaction', () => {
    lockMgr.lock(1, 'table:users', LockMode.SHARED);
    lockMgr.lock(1, 'table:orders', LockMode.EXCLUSIVE);
    lockMgr.lock(1, LockManager.rowKey('users', 0, 0), LockMode.SHARED);

    expect(lockMgr.getLocksForTxn(1).length).toBe(3);
    lockMgr.releaseAll(1);
    expect(lockMgr.getLocksForTxn(1).length).toBe(0);
  });

  it('should build static key formats', () => {
    expect(LockManager.tableKey('users')).toBe('table:users');
    expect(LockManager.rowKey('users', 1, 3)).toBe('row:users:1:3');
  });

  it('should detect deadlock in waits-for graph', () => {
    // T1 holds X on A, wants S on B
    // T2 holds X on B, wants S on A
    lockMgr.lock(1, 'A', LockMode.EXCLUSIVE);
    lockMgr.lock(2, 'B', LockMode.EXCLUSIVE);

    lockMgr.lock(1, 'B', LockMode.SHARED); // T1 waits for T2
    lockMgr.lock(2, 'A', LockMode.SHARED); // T2 waits for T1

    const cycle = lockMgr.hasDeadlock();
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThanOrEqual(3); // at least [1, 2, 1]
  });

  it('should not detect deadlock when there is none', () => {
    lockMgr.lock(1, 'A', LockMode.EXCLUSIVE);
    lockMgr.lock(2, 'B', LockMode.EXCLUSIVE);
    // No circular wait
    const cycle = lockMgr.hasDeadlock();
    expect(cycle).toBeNull();
  });

  it('should provide lock table state for visualization', () => {
    lockMgr.lock(1, 'table:users', LockMode.SHARED);
    lockMgr.lock(2, 'table:users', LockMode.SHARED);
    const state = lockMgr.getLockTableState();
    expect(state.length).toBe(1);
    expect(state[0].holders.length).toBe(2);
  });
});

describe('DeadlockDetector', () => {
  let config: ConfigRegistry;
  let txnMgr: TransactionManager;
  let lockMgr: LockManager;
  let detector: DeadlockDetector;

  beforeEach(() => {
    config = new ConfigRegistry();
    config.set('concurrencyMode', ConcurrencyMode.TWO_PL);
    txnMgr = new TransactionManager(config);
    lockMgr = new LockManager(config);
    txnMgr.setLockManager(lockMgr);
    detector = new DeadlockDetector(config, txnMgr, lockMgr);
  });

  it('should detect deadlock cycle', () => {
    config.set('deadlockStrategy', DeadlockStrategy.DETECTION);

    const t1 = txnMgr.begin();
    const t2 = txnMgr.begin();

    lockMgr.lock(t1.txnId, 'A', LockMode.EXCLUSIVE);
    lockMgr.lock(t2.txnId, 'B', LockMode.EXCLUSIVE);
    lockMgr.lock(t1.txnId, 'B', LockMode.SHARED);
    lockMgr.lock(t2.txnId, 'A', LockMode.SHARED);

    const result = detector.runDetection();
    expect(result.detected).toBe(true);
    expect(result.victimTxnId).toBeDefined();
  });

  it('should return no deadlock when none exists', () => {
    config.set('deadlockStrategy', DeadlockStrategy.DETECTION);

    const t1 = txnMgr.begin();
    txnMgr.begin();

    lockMgr.lock(t1.txnId, 'A', LockMode.EXCLUSIVE);

    const result = detector.runDetection();
    expect(result.detected).toBe(false);
  });

  it('wait-die: younger txn should die when waiting for older', () => {
    config.set('deadlockStrategy', DeadlockStrategy.WAIT_DIE);

    const t1 = txnMgr.begin(); // older (lower timestamp)
    const t2 = txnMgr.begin(); // younger

    const result = detector.check(t2.txnId, 'A', LockMode.SHARED, [t1.txnId]);
    expect(result.detected).toBe(true);
    expect(result.victimTxnId).toBe(t2.txnId);
  });

  it('wait-die: older txn should wait for younger', () => {
    config.set('deadlockStrategy', DeadlockStrategy.WAIT_DIE);

    const t1 = txnMgr.begin(); // older
    const t2 = txnMgr.begin(); // younger

    const result = detector.check(t1.txnId, 'A', LockMode.SHARED, [t2.txnId]);
    expect(result.detected).toBe(false);
  });

  it('wound-wait: older txn should wound younger holder', () => {
    config.set('deadlockStrategy', DeadlockStrategy.WOUND_WAIT);

    const t1 = txnMgr.begin(); // older
    const t2 = txnMgr.begin(); // younger

    const result = detector.check(t1.txnId, 'A', LockMode.SHARED, [t2.txnId]);
    expect(result.detected).toBe(true);
    expect(result.victimTxnId).toBe(t2.txnId);
  });

  it('wound-wait: younger txn should wait for older holder', () => {
    config.set('deadlockStrategy', DeadlockStrategy.WOUND_WAIT);

    const t1 = txnMgr.begin(); // older
    const t2 = txnMgr.begin(); // younger

    const result = detector.check(t2.txnId, 'A', LockMode.SHARED, [t1.txnId]);
    expect(result.detected).toBe(false);
  });
});

describe('MVCC', () => {
  let mvcc: MVCCManager;
  let config: ConfigRegistry;
  let txnMgr: TransactionManager;

  beforeEach(() => {
    config = new ConfigRegistry();
    config.set('concurrencyMode', ConcurrencyMode.MVCC);
    txnMgr = new TransactionManager(config);
    mvcc = new MVCCManager();
    txnMgr.setMVCCManager(mvcc);
  });

  const rid1 = makeRid(0, 0);
  const rid2 = makeRid(0, 1);

  it('should insert and read a tuple', () => {
    const t1 = txnMgr.begin();
    mvcc.insert(t1, 'users', rid1, [1, 'alice']);
    // Own write should be visible
    const result = mvcc.read(t1, 'users', rid1);
    expect(result).toEqual([1, 'alice']);
    txnMgr.commit(t1.txnId);
  });

  it('should not see uncommitted data from other txn', () => {
    const t1 = txnMgr.begin();
    const t2 = txnMgr.begin();

    mvcc.insert(t1, 'users', rid1, [1, 'alice']);

    // T2 should not see T1's uncommitted insert
    const result = mvcc.read(t2, 'users', rid1);
    expect(result).toBeNull();
  });

  it('should see committed data after commit', () => {
    const t1 = txnMgr.begin();
    mvcc.insert(t1, 'users', rid1, [1, 'alice']);
    txnMgr.commit(t1.txnId);

    const t2 = txnMgr.begin();
    const result = mvcc.read(t2, 'users', rid1);
    expect(result).toEqual([1, 'alice']);
  });

  it('should handle update creating new version', () => {
    const t1 = txnMgr.begin();
    mvcc.insert(t1, 'users', rid1, [1, 'alice']);
    txnMgr.commit(t1.txnId);

    const t2 = txnMgr.begin();
    mvcc.update(t2, 'users', rid1, [1, 'bob']);
    // T2 sees its own update
    const result = mvcc.read(t2, 'users', rid1);
    expect(result).toEqual([1, 'bob']);
    txnMgr.commit(t2.txnId);

    // T3 should see the updated value
    const t3 = txnMgr.begin();
    expect(mvcc.read(t3, 'users', rid1)).toEqual([1, 'bob']);
  });

  it('should handle delete', () => {
    const t1 = txnMgr.begin();
    mvcc.insert(t1, 'users', rid1, [1, 'alice']);
    txnMgr.commit(t1.txnId);

    const t2 = txnMgr.begin();
    mvcc.delete(t2, 'users', rid1);
    txnMgr.commit(t2.txnId);

    const t3 = txnMgr.begin();
    expect(mvcc.read(t3, 'users', rid1)).toBeNull();
  });

  it('should provide snapshot isolation', () => {
    // T1 inserts data and commits
    const t1 = txnMgr.begin();
    mvcc.insert(t1, 'users', rid1, [1, 'alice']);
    txnMgr.commit(t1.txnId);

    // T2 starts and reads
    const t2 = txnMgr.begin();
    const read1 = mvcc.read(t2, 'users', rid1);
    expect(read1).toEqual([1, 'alice']);

    // T3 updates and commits while T2 is still active
    const t3 = txnMgr.begin();
    mvcc.update(t3, 'users', rid1, [1, 'bob']);
    txnMgr.commit(t3.txnId);

    // T2 should still see 'alice' (snapshot isolation)
    const read2 = mvcc.read(t2, 'users', rid1);
    expect(read2).toEqual([1, 'alice']);
  });

  it('should undo changes on abort', () => {
    const t1 = txnMgr.begin();
    mvcc.insert(t1, 'users', rid1, [1, 'alice']);
    txnMgr.commit(t1.txnId);

    const t2 = txnMgr.begin();
    mvcc.update(t2, 'users', rid1, [1, 'bob']);
    txnMgr.abort(t2.txnId);

    // T3 should see the original value
    const t3 = txnMgr.begin();
    expect(mvcc.read(t3, 'users', rid1)).toEqual([1, 'alice']);
  });

  it('should readAll visible tuples', () => {
    const t1 = txnMgr.begin();
    mvcc.insert(t1, 'users', rid1, [1, 'alice']);
    mvcc.insert(t1, 'users', rid2, [2, 'bob']);
    txnMgr.commit(t1.txnId);

    const t2 = txnMgr.begin();
    const rows = mvcc.readAll(t2, 'users');
    expect(rows.length).toBe(2);
  });

  it('should track version chain length', () => {
    const t1 = txnMgr.begin();
    mvcc.insert(t1, 'users', rid1, [1, 'alice']);
    txnMgr.commit(t1.txnId);

    const t2 = txnMgr.begin();
    mvcc.update(t2, 'users', rid1, [1, 'bob']);
    txnMgr.commit(t2.txnId);

    const chain = mvcc.getVersionChain('users', rid1);
    expect(chain.length).toBe(2);
  });

  it('should garbage collect old versions', () => {
    const t1 = txnMgr.begin();
    mvcc.insert(t1, 'users', rid1, [1, 'alice']);
    txnMgr.commit(t1.txnId);

    const t2 = txnMgr.begin();
    mvcc.update(t2, 'users', rid1, [1, 'bob']);
    txnMgr.commit(t2.txnId);

    expect(mvcc.getVersionCount()).toBe(2);

    // GC with no active transactions
    const collected = mvcc.garbageCollect([]);
    expect(collected).toBeGreaterThanOrEqual(1);
    expect(mvcc.getVersionCount()).toBe(1);
  });

  it('should detect write-write conflict', () => {
    const t1 = txnMgr.begin();
    mvcc.insert(t1, 'users', rid1, [1, 'alice']);
    txnMgr.commit(t1.txnId);

    const t2 = txnMgr.begin();
    const t3 = txnMgr.begin();

    // T2 updates the row
    expect(mvcc.update(t2, 'users', rid1, [1, 'bob'])).toBe(true);

    // T3 tries to update the same row — conflict
    expect(mvcc.update(t3, 'users', rid1, [1, 'charlie'])).toBe(false);
  });
});

describe('Isolation Simulator', () => {
  let config: ConfigRegistry;

  beforeEach(() => {
    config = new ConfigRegistry();
  });

  const rid1 = makeRid(0, 0);

  it('READ_UNCOMMITTED: should see dirty reads', () => {
    const sim = new IsolationSimulator(config, IsolationLevel.READ_UNCOMMITTED);

    const t1 = sim.begin();
    const t2 = sim.begin();

    // T1 writes but doesn't commit
    sim.write(t1, 'users', rid1, [1, 'alice']);

    // T2 can read T1's uncommitted data (dirty read)
    const value = sim.read(t2, 'users', rid1);
    expect(value).toEqual([1, 'alice']);

    sim.abort(t1);
    sim.commit(t2);
  });

  it('READ_COMMITTED: should not see dirty reads', () => {
    const sim = new IsolationSimulator(config, IsolationLevel.READ_COMMITTED);

    const t1 = sim.begin();
    const t2 = sim.begin();

    sim.write(t1, 'users', rid1, [1, 'alice']);

    // T2 should NOT see T1's uncommitted data
    const value = sim.read(t2, 'users', rid1);
    expect(value).toBeNull();

    sim.commit(t1);
    sim.commit(t2);
  });

  it('READ_COMMITTED: should see data after commit', () => {
    const sim = new IsolationSimulator(config, IsolationLevel.READ_COMMITTED);

    const t1 = sim.begin();
    sim.write(t1, 'users', rid1, [1, 'alice']);
    sim.commit(t1);

    const t2 = sim.begin();
    const value = sim.read(t2, 'users', rid1);
    expect(value).toEqual([1, 'alice']);
    sim.commit(t2);
  });

  it('REPEATABLE_READ: should see consistent snapshot', () => {
    const sim = new IsolationSimulator(config, IsolationLevel.REPEATABLE_READ);

    const t1 = sim.begin();
    sim.write(t1, 'users', rid1, [1, 'alice']);
    sim.commit(t1);

    const t2 = sim.begin();
    const read1 = sim.read(t2, 'users', rid1);
    expect(read1).toEqual([1, 'alice']);

    // T3 updates and commits
    const t3 = sim.begin();
    sim.write(t3, 'users', rid1, [1, 'bob']);
    sim.commit(t3);

    // T2 re-reads — should still see 'alice' (repeatable read)
    const read2 = sim.read(t2, 'users', rid1);
    expect(read2).toEqual([1, 'alice']);

    sim.commit(t2);
  });

  it('should execute a schedule', () => {
    const sim = new IsolationSimulator(config, IsolationLevel.READ_COMMITTED);

    const t1 = sim.begin();
    const t2 = sim.begin();

    const results = sim.executeSchedule([
      { txnId: t1, type: 'write', table: 'users', rid: rid1, tuple: [1, 'alice'] },
      { txnId: t1, type: 'commit' },
      { txnId: t2, type: 'read', table: 'users', rid: rid1 },
      { txnId: t2, type: 'commit' },
    ]);

    expect(results.length).toBe(4);
    expect(results[0].success).toBe(true); // write
    expect(results[1].success).toBe(true); // commit
    expect(results[2].readValue).toEqual([1, 'alice']); // read
    expect(results[3].success).toBe(true); // commit
  });

  it('SERIALIZABLE: should provide full isolation', () => {
    const sim = new IsolationSimulator(config, IsolationLevel.SERIALIZABLE);

    const t1 = sim.begin();
    sim.write(t1, 'users', rid1, [1, 'alice']);
    sim.commit(t1);

    const t2 = sim.begin();
    const value = sim.read(t2, 'users', rid1);
    expect(value).toEqual([1, 'alice']);

    // T3 updates and commits while T2 is active
    const t3 = sim.begin();
    sim.write(t3, 'users', rid1, [1, 'bob']);
    sim.commit(t3);

    // T2 still sees original (SERIALIZABLE ≈ snapshot isolation here)
    const value2 = sim.read(t2, 'users', rid1);
    expect(value2).toEqual([1, 'alice']);
    sim.commit(t2);
  });

  it('should handle delete in isolation', () => {
    const sim = new IsolationSimulator(config, IsolationLevel.REPEATABLE_READ);

    const t1 = sim.begin();
    sim.write(t1, 'users', rid1, [1, 'alice']);
    sim.commit(t1);

    const t2 = sim.begin();
    sim.delete(t2, 'users', rid1);
    sim.commit(t2);

    const t3 = sim.begin();
    expect(sim.read(t3, 'users', rid1)).toBeNull();
    sim.commit(t3);
  });
});
