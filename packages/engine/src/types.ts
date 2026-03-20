/**
 * Core types for the database engine.
 */

// ─── Data Types ──────────────────────────────────────────────────────────────

export enum DataType {
  INTEGER = 'INTEGER',
  FLOAT = 'FLOAT',
  VARCHAR = 'VARCHAR',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',
}

export interface ColumnDef {
  name: string;
  type: DataType;
  maxLength?: number; // For VARCHAR
  nullable: boolean;
  primaryKey?: boolean;
}

export interface Schema {
  columns: ColumnDef[];
}

// ─── Values ──────────────────────────────────────────────────────────────────

export type Value = number | string | boolean | null;

/** A row of values, ordered by column position. */
export type Tuple = Value[];

// ─── Page / Record IDs ──────────────────────────────────────────────────────

/** Identifies a page on disk. */
export interface PageId {
  fileId: number;
  pageNum: number;
}

/** Identifies a specific tuple within a page. */
export interface RecordId {
  pageId: PageId;
  slotNum: number;
}

// ─── Page Constants ──────────────────────────────────────────────────────────

export const PAGE_SIZES = [4096, 8192, 16384] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 4096;

// ─── Buffer Pool ─────────────────────────────────────────────────────────────

export type FrameId = number;

export enum ReplacementPolicy {
  LRU = 'LRU',
  CLOCK = 'CLOCK',
  LRU_K = 'LRU_K',
}

// ─── Index ───────────────────────────────────────────────────────────────────

export enum IndexType {
  BTREE = 'BTREE',
  LINEAR_PROBE_HASH = 'LINEAR_PROBE_HASH',
  EXTENDIBLE_HASH = 'EXTENDIBLE_HASH',
  CHAINED_HASH = 'CHAINED_HASH',
  SKIP_LIST = 'SKIP_LIST',
}

// ─── Join ────────────────────────────────────────────────────────────────────

export enum JoinAlgorithm {
  NESTED_LOOP = 'NESTED_LOOP',
  BLOCK_NESTED_LOOP = 'BLOCK_NESTED_LOOP',
  INDEX_NESTED_LOOP = 'INDEX_NESTED_LOOP',
  SORT_MERGE = 'SORT_MERGE',
  HASH_JOIN = 'HASH_JOIN',
  GRACE_HASH_JOIN = 'GRACE_HASH_JOIN',
}

// ─── Processing Model ────────────────────────────────────────────────────────

export enum ProcessingModel {
  VOLCANO = 'VOLCANO',
  MATERIALIZATION = 'MATERIALIZATION',
  VECTORIZED = 'VECTORIZED',
}

// ─── Optimizer ───────────────────────────────────────────────────────────────

export enum OptimizerType {
  HEURISTIC = 'HEURISTIC',
  SYSTEM_R = 'SYSTEM_R',
  VOLCANO = 'VOLCANO',
}

// ─── Concurrency ─────────────────────────────────────────────────────────────

export enum ConcurrencyMode {
  NONE = 'NONE',
  TWO_PL = 'TWO_PL',
  MVCC = 'MVCC',
}

export enum IsolationLevel {
  READ_UNCOMMITTED = 'READ_UNCOMMITTED',
  READ_COMMITTED = 'READ_COMMITTED',
  REPEATABLE_READ = 'REPEATABLE_READ',
  SERIALIZABLE = 'SERIALIZABLE',
}

export enum DeadlockStrategy {
  DETECTION = 'DETECTION',
  WAIT_DIE = 'WAIT_DIE',
  WOUND_WAIT = 'WOUND_WAIT',
}

// ─── Engine Configuration ────────────────────────────────────────────────────

export interface EngineConfig {
  // Storage
  pageSize: PageSize;

  // Buffer Pool
  bufferPoolSize: number; // Number of frames
  replacementPolicy: ReplacementPolicy;
  lruKValue: number; // K for LRU-K

  // Index
  defaultIndexType: IndexType;
  btreeOrder: number;

  // Execution
  joinAlgorithm: JoinAlgorithm;
  processingModel: ProcessingModel;
  vectorizedBatchSize: number;

  // Optimizer
  optimizerType: OptimizerType;
  enablePredicatePushdown: boolean;
  enableProjectionPushdown: boolean;
  enableJoinReorder: boolean;

  // Concurrency
  concurrencyMode: ConcurrencyMode;
  isolationLevel: IsolationLevel;
  deadlockStrategy: DeadlockStrategy;

  // Recovery
  enableWAL: boolean;
  groupCommit: boolean;
  checkpointInterval: number; // In number of transactions

  // Simulation
  simulatedIOLatencyMs: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  pageSize: DEFAULT_PAGE_SIZE,
  bufferPoolSize: 16,
  replacementPolicy: ReplacementPolicy.LRU,
  lruKValue: 2,
  defaultIndexType: IndexType.BTREE,
  btreeOrder: 4,
  joinAlgorithm: JoinAlgorithm.NESTED_LOOP,
  processingModel: ProcessingModel.VOLCANO,
  vectorizedBatchSize: 1024,
  optimizerType: OptimizerType.HEURISTIC,
  enablePredicatePushdown: true,
  enableProjectionPushdown: true,
  enableJoinReorder: true,
  concurrencyMode: ConcurrencyMode.NONE,
  isolationLevel: IsolationLevel.SERIALIZABLE,
  deadlockStrategy: DeadlockStrategy.DETECTION,
  enableWAL: true,
  groupCommit: false,
  checkpointInterval: 100,
  simulatedIOLatencyMs: 0,
};

// ─── Events ──────────────────────────────────────────────────────────────────

export enum EngineEventType {
  PAGE_READ = 'PAGE_READ',
  PAGE_WRITE = 'PAGE_WRITE',
  BUFFER_HIT = 'BUFFER_HIT',
  BUFFER_MISS = 'BUFFER_MISS',
  BUFFER_EVICT = 'BUFFER_EVICT',
  TUPLE_INSERT = 'TUPLE_INSERT',
  TUPLE_DELETE = 'TUPLE_DELETE',
  TUPLE_UPDATE = 'TUPLE_UPDATE',
  INDEX_INSERT = 'INDEX_INSERT',
  INDEX_DELETE = 'INDEX_DELETE',
  INDEX_SEARCH = 'INDEX_SEARCH',
  INDEX_SPLIT = 'INDEX_SPLIT',
  INDEX_MERGE = 'INDEX_MERGE',
  LOCK_ACQUIRE = 'LOCK_ACQUIRE',
  LOCK_RELEASE = 'LOCK_RELEASE',
  LOCK_WAIT = 'LOCK_WAIT',
  DEADLOCK_DETECTED = 'DEADLOCK_DETECTED',
  TX_BEGIN = 'TX_BEGIN',
  TX_COMMIT = 'TX_COMMIT',
  TX_ABORT = 'TX_ABORT',
  WAL_WRITE = 'WAL_WRITE',
  CHECKPOINT = 'CHECKPOINT',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
}

export interface EngineEvent {
  type: EngineEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export type EventListener = (event: EngineEvent) => void;
