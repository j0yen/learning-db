// Core types
export * from './types.js';

// Config
export { ConfigRegistry } from './config/config-registry.js';
export type { ConfigKey, ConfigChangeListener } from './config/config-registry.js';

// Storage
export { MemoryDiskManager } from './storage/disk-manager.js';
export type { DiskManager } from './storage/disk-manager.js';
export { SlottedPage } from './storage/slotted-page.js';
export { HeapFile } from './storage/heap-file.js';
export { serializeTuple, deserializeTuple, tupleSize } from './storage/tuple-serializer.js';

// Buffer Pool
export { BufferPoolManager } from './buffer/buffer-pool-manager.js';
export type { BufferPoolStats } from './buffer/buffer-pool-manager.js';
export { LRUReplacer } from './buffer/replacement/lru-replacer.js';
export { ClockReplacer } from './buffer/replacement/clock-replacer.js';
export { LRUKReplacer } from './buffer/replacement/lru-k-replacer.js';
export type { Replacer } from './buffer/replacement/replacer.js';

// Catalog
export { Catalog } from './catalog/catalog.js';
export type { TableInfo, IndexInfo } from './catalog/catalog.js';
export { TableStatistics } from './catalog/table-statistics.js';
export type { ColumnStats, Histogram } from './catalog/table-statistics.js';

// Index
export { compareValues, hashValue, ridEquals } from './index/index.js';
export type { Index } from './index/index.js';
export { BPlusTree } from './index/btree/bplus-tree.js';
export type { BTreeVizNode } from './index/btree/bplus-tree.js';
export { ChainedHashIndex } from './index/hash/chained-hash-index.js';
export { LinearProbeHashIndex } from './index/hash/linear-probe-hash-index.js';
export { ExtendibleHashIndex } from './index/hash/extendible-hash-index.js';
export { SkipList } from './index/skip-list.js';
export { BloomFilter } from './index/bloom-filter.js';

// SQL
export { Lexer } from './sql/lexer.js';
export { TokenType } from './sql/lexer.js';
export type { Token } from './sql/lexer.js';
export { Parser } from './sql/parser.js';
export type {
  Statement, SelectStatement, InsertStatement, UpdateStatement,
  DeleteStatement, CreateTableStatement, CreateIndexStatement,
  Expr, ColumnRef, LiteralExpr, BinaryExpr, FunctionCall,
  SelectItem, FromClause, TableRef, JoinClause, OrderByItem,
} from './sql/ast.js';
export type {
  LogicalPlan, ScanNode, FilterNode, ProjectNode, JoinNode,
  SortNode, AggregateNode, LimitNode,
} from './sql/plan.js';
export { Planner } from './sql/planner.js';

// Execution
export { Executor } from './execution/executor.js';
export type { ExecutionResult } from './execution/executor.js';
export { evaluate, buildRowContext } from './execution/expression-evaluator.js';
export type { Operator, Row, ColumnMeta } from './execution/operators/operator.js';
export { SeqScan } from './execution/operators/seq-scan.js';
export { Filter } from './execution/operators/filter.js';
export { Project } from './execution/operators/project.js';
export { NestedLoopJoin } from './execution/operators/nested-loop-join.js';
export { HashJoin } from './execution/operators/hash-join.js';
export { SortMergeJoin } from './execution/operators/sort-merge-join.js';
export { Sort } from './execution/operators/sort.js';
export { HashAggregate } from './execution/operators/hash-aggregate.js';
export { Limit } from './execution/operators/limit.js';

// Optimizer
export { Optimizer } from './optimizer/optimizer.js';
export { CostModel } from './optimizer/cost/cost-model.js';
export type { PlanCost } from './optimizer/cost/cost-model.js';
export { predicatePushdown } from './optimizer/rules/predicate-pushdown.js';
export { joinReorder, estimateCardinality } from './optimizer/rules/join-reorder.js';
export { systemROptimize } from './optimizer/system-r.js';
export { VolcanoOptimizer } from './optimizer/volcano-optimizer.js';
export { explainPlan, formatExplain, exprToString } from './optimizer/explain.js';
export type { ExplainNode } from './optimizer/explain.js';

// Processing Models
export { MaterializationWrapper, materializeTree } from './execution/processing-model/materialization.js';
export { VectorizedWrapper, VectorizedToRowAdapter, collectVectorized } from './execution/processing-model/vectorized.js';
export type { Batch, VectorizedOperator } from './execution/processing-model/vectorized.js';

// Concurrency Control
export { Transaction, TransactionState } from './concurrency/transaction.js';
export type { TransactionId, WriteRecord, ReadRecord } from './concurrency/transaction.js';
export { TransactionManager } from './concurrency/transaction-manager.js';
export { LockManager, LockMode } from './concurrency/lock-manager.js';
export type { LockRequest } from './concurrency/lock-manager.js';
export { DeadlockDetector } from './concurrency/deadlock-detector.js';
export type { DeadlockResult } from './concurrency/deadlock-detector.js';
export { MVCCManager } from './concurrency/mvcc/mvcc-manager.js';
export type { VersionRecord } from './concurrency/mvcc/mvcc-manager.js';
export { IsolationSimulator } from './concurrency/isolation-simulator.js';
export type { SimOp, SimResult, OpType } from './concurrency/isolation-simulator.js';
