/**
 * MVCC Manager: Multi-Version Concurrency Control with version chains.
 *
 * Each row can have multiple versions. Each version has:
 * - createdBy: txn that created this version
 * - deletedBy: txn that deleted/replaced this version (null if live)
 * - beginTs: timestamp when visible
 * - endTs: timestamp when no longer visible (Infinity if current)
 *
 * Reads see a snapshot: all versions where beginTs <= txn.startTs < endTs.
 * Writes create new versions (insert/update) or mark deletedBy (delete).
 *
 * Garbage collection removes versions not visible to any active transaction.
 */

import type { Tuple, RecordId } from '../../types.js';
import type { Transaction, TransactionId } from '../transaction.js';

export interface VersionRecord {
  /** The tuple data. */
  tuple: Tuple;
  /** Transaction that created this version. */
  createdBy: TransactionId;
  /** Transaction that deleted/replaced this version, or null. */
  deletedBy: TransactionId | null;
  /** Timestamp from which this version is visible. */
  beginTs: number;
  /** Timestamp until which this version is visible (Infinity if current). */
  endTs: number;
}

/** Key for identifying a logical row (table + original RID). */
function versionKey(table: string, rid: RecordId): string {
  return `${table}:${rid.pageId.pageNum}:${rid.slotNum}`;
}

export class MVCCManager {
  /**
   * Version store: maps logical row key → version chain (newest first).
   */
  private versionStore: Map<string, VersionRecord[]> = new Map();
  /** Track committed transaction timestamps for visibility. */
  private committedTimestamps: Map<TransactionId, number> = new Map();
  private nextCommitTs = 1;

  /**
   * Read a tuple visible to the given transaction.
   * Returns the visible version or null if no visible version exists.
   */
  read(txn: Transaction, table: string, rid: RecordId): Tuple | null {
    const key = versionKey(table, rid);
    const chain = this.versionStore.get(key);
    if (!chain) return null;

    for (const version of chain) {
      if (this.isVisible(version, txn)) {
        return version.tuple;
      }
    }
    return null;
  }

  /**
   * Read all visible tuples for a table scan.
   */
  readAll(txn: Transaction, table: string): Array<{ rid: RecordId; tuple: Tuple }> {
    const results: Array<{ rid: RecordId; tuple: Tuple }> = [];

    for (const [key, chain] of this.versionStore) {
      if (!key.startsWith(table + ':')) continue;

      for (const version of chain) {
        if (this.isVisible(version, txn)) {
          // Parse RID from key
          const parts = key.split(':');
          const pageNum = parseInt(parts[1], 10);
          const slotNum = parseInt(parts[2], 10);
          results.push({
            rid: { pageId: { fileId: 0, pageNum }, slotNum },
            tuple: version.tuple,
          });
          break; // Only the first visible version per chain
        }
      }
    }

    return results;
  }

  /**
   * Insert a new tuple — creates first version in chain.
   * Returns false if a write conflict is detected.
   */
  insert(txn: Transaction, table: string, rid: RecordId, tuple: Tuple): boolean {
    const key = versionKey(table, rid);
    const chain = this.versionStore.get(key) ?? [];

    const version: VersionRecord = {
      tuple,
      createdBy: txn.txnId,
      deletedBy: null,
      beginTs: txn.startTimestamp,
      endTs: Infinity,
    };

    chain.unshift(version); // Newest first
    this.versionStore.set(key, chain);
    return true;
  }

  /**
   * Update a tuple — mark old version as deleted and create new version.
   * Returns false if write-write conflict detected.
   */
  update(
    txn: Transaction,
    table: string,
    rid: RecordId,
    newTuple: Tuple,
  ): boolean {
    const key = versionKey(table, rid);
    const chain = this.versionStore.get(key);
    if (!chain) return false;

    // Find the current visible version
    const currentIdx = chain.findIndex(v => this.isVisible(v, txn));
    if (currentIdx === -1) return false;

    const current = chain[currentIdx];

    // Write-write conflict: another uncommitted txn modified this
    if (current.createdBy !== txn.txnId && !this.committedTimestamps.has(current.createdBy)) {
      return false;
    }
    if (current.deletedBy !== null && current.deletedBy !== txn.txnId) {
      return false;
    }

    // Mark old version as deleted by this txn
    current.deletedBy = txn.txnId;
    current.endTs = txn.startTimestamp;

    // Create new version
    const newVersion: VersionRecord = {
      tuple: newTuple,
      createdBy: txn.txnId,
      deletedBy: null,
      beginTs: txn.startTimestamp,
      endTs: Infinity,
    };

    chain.unshift(newVersion);
    return true;
  }

  /**
   * Delete a tuple — mark current version as deleted.
   * Returns false if write-write conflict detected.
   */
  delete(txn: Transaction, table: string, rid: RecordId): boolean {
    const key = versionKey(table, rid);
    const chain = this.versionStore.get(key);
    if (!chain) return false;

    const currentIdx = chain.findIndex(v => this.isVisible(v, txn));
    if (currentIdx === -1) return false;

    const current = chain[currentIdx];

    // Write-write conflict
    if (current.deletedBy !== null && current.deletedBy !== txn.txnId) {
      return false;
    }

    current.deletedBy = txn.txnId;
    current.endTs = txn.startTimestamp;
    return true;
  }

  /** Called when a transaction commits — finalize version timestamps. */
  onCommit(txn: Transaction): void {
    const commitTs = this.nextCommitTs++;
    this.committedTimestamps.set(txn.txnId, commitTs);

    // Update all versions created by this txn to use commit timestamp
    for (const chain of this.versionStore.values()) {
      for (const version of chain) {
        if (version.createdBy === txn.txnId) {
          version.beginTs = commitTs;
        }
        if (version.deletedBy === txn.txnId) {
          version.endTs = commitTs;
        }
      }
    }
  }

  /** Called when a transaction aborts — remove its uncommitted versions. */
  onAbort(txn: Transaction): void {
    for (const [key, chain] of this.versionStore) {
      // Remove versions created by aborted txn
      const filtered = chain.filter(v => v.createdBy !== txn.txnId);

      // Un-delete versions that were deleted by aborted txn
      for (const version of filtered) {
        if (version.deletedBy === txn.txnId) {
          version.deletedBy = null;
          version.endTs = Infinity;
        }
      }

      if (filtered.length === 0) {
        this.versionStore.delete(key);
      } else {
        this.versionStore.set(key, filtered);
      }
    }
  }

  /**
   * Garbage collection: remove versions not visible to any active transaction.
   * A version can be GC'd if its endTs < the minimum active transaction timestamp.
   */
  garbageCollect(activeTransactions: Transaction[]): number {
    if (activeTransactions.length === 0) {
      // No active transactions — can GC everything except the latest committed version
      let collected = 0;
      for (const [key, chain] of this.versionStore) {
        if (chain.length > 1) {
          // Keep only the latest committed version
          const latest = chain.find(v =>
            v.deletedBy === null && this.committedTimestamps.has(v.createdBy),
          );
          if (latest) {
            const removed = chain.length - 1;
            this.versionStore.set(key, [latest]);
            collected += removed;
          }
        }
      }
      return collected;
    }

    const minActiveTs = Math.min(...activeTransactions.map(t => t.startTimestamp));
    let collected = 0;

    for (const [key, chain] of this.versionStore) {
      const kept: VersionRecord[] = [];
      let foundVisible = false;

      for (const version of chain) {
        // Keep if version might still be visible to any active txn
        if (version.endTs > minActiveTs || !foundVisible) {
          kept.push(version);
          if (version.endTs > minActiveTs) foundVisible = true;
        } else {
          collected++;
        }
      }

      if (kept.length === 0) {
        this.versionStore.delete(key);
      } else {
        this.versionStore.set(key, kept);
      }
    }

    return collected;
  }

  /** Get version chain for a logical row (for debugging/visualization). */
  getVersionChain(table: string, rid: RecordId): VersionRecord[] {
    const key = versionKey(table, rid);
    return this.versionStore.get(key) ?? [];
  }

  /** Get total number of versions in the store. */
  getVersionCount(): number {
    let count = 0;
    for (const chain of this.versionStore.values()) {
      count += chain.length;
    }
    return count;
  }

  private isVisible(version: VersionRecord, txn: Transaction): boolean {
    // Own writes are always visible
    if (version.createdBy === txn.txnId && version.deletedBy === null) {
      return true;
    }
    if (version.deletedBy === txn.txnId) {
      return false;
    }

    // Snapshot isolation: version must have been committed before txn started
    const creatorCommitTs = this.committedTimestamps.get(version.createdBy);

    // If creator hasn't committed, not visible (unless it's our own write, handled above)
    if (creatorCommitTs === undefined) return false;

    // Version is visible if: committed strictly before our snapshot start
    if (creatorCommitTs >= txn.startTimestamp) return false;

    // Check if it was deleted strictly before our snapshot
    if (version.deletedBy !== null) {
      const deleterCommitTs = this.committedTimestamps.get(version.deletedBy);
      if (deleterCommitTs !== undefined && deleterCommitTs < txn.startTimestamp) {
        return false; // Was deleted before our snapshot
      }
    }

    return true;
  }
}
