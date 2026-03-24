# Product Requirements Document: database0

## An Educational, Configurable Database Management System

**Version:** 1.0
**Date:** 2026-03-24
**Author:** Product Management
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Architecture Overview](#3-architecture-overview)
4. [Configuration System](#4-configuration-system)
5. [Subsystem Specifications](#5-subsystem-specifications)
6. [Observability and Instrumentation](#6-observability-and-instrumentation)
7. [SQL Interface](#7-sql-interface)
8. [Benchmarking and Experimentation Framework](#8-benchmarking-and-experimentation-framework)
9. [Implementation Phases](#9-implementation-phases)
10. [Technical Decisions](#10-technical-decisions)

---

## 1. Executive Summary

### Problem Statement

Students and engineers studying database internals face a fundamental gap between theory and practice. Courses like CMU 15-445/645 teach dozens of algorithms, data structures, and policies -- buffer replacement strategies, join algorithms, concurrency control protocols, recovery mechanisms -- but learners have no way to see these choices play out side by side in a real, running system. Existing open-source databases are production-oriented: their internals are fixed at compile time, buried under layers of abstraction, and hostile to experimentation. The result is that learners memorize trade-offs from slides ("hash join is usually faster than sort-merge join") without ever observing them firsthand.

### Proposed Solution

**database0** is a fully functional, disk-oriented DBMS written in Rust whose every major subsystem is a configurable, swappable option. Users select implementations via a TOML configuration file at startup and via runtime SQL commands (`SET` statements). The system exposes rich telemetry -- I/O counts, latch contention, cache hit rates, CPU cycles per operator -- so that users can run identical workloads under different configurations and directly observe how algorithmic choices affect performance, correctness, and resource usage.

The system is not a toy. It implements a meaningful subset of SQL, full ACID transactions, crash recovery, and concurrent execution. But it optimizes for clarity, configurability, and instrumentation over raw throughput. Every line of code is intended to be read, understood, and modified.

### Success Metrics

| Metric | Target |
|---|---|
| Configurable options across all subsystems | >= 120 distinct settings |
| Subsystems with runtime-swappable implementations | >= 8 of 14 |
| Time for a new user to run first A/B comparison | < 15 minutes |
| Correctness test suite pass rate | 100% across all valid configuration combinations |
| Code readability (avg function length) | < 50 lines |
| Documentation coverage (public API) | 100% |

### Target Release and Milestones

| Milestone | Target |
|---|---|
| Phase 1: Storage + Buffer Pool + Basic SQL | Month 0-4 |
| Phase 2: Indexes + Sorting + Joins | Month 4-7 |
| Phase 3: Query Processing + Optimization | Month 7-10 |
| Phase 4: Concurrency Control + MVCC | Month 10-14 |
| Phase 5: Recovery + WAL | Month 14-17 |
| Phase 6: Distributed (Stretch) | Month 17-22 |

---

## 2. Goals and Non-Goals

### Goals

1. **Deep, experiential learning.** A user who works through database0 should emerge with stronger intuition about database internals than from any textbook alone. The system should make abstract trade-offs concrete and observable.

2. **Side-by-side comparison.** The system must make it trivial to run the same query or workload under two different configurations and compare results -- wall-clock time, I/O count, memory usage, latch contention, and correctness behavior.

3. **Full coverage of CMU 15-445/645.** Every major topic from Lectures 1-24 should map to at least one configurable option. The system is a companion to the course.

4. **Correctness under all configurations.** Every valid combination of settings must produce correct results. The system must never silently corrupt data, even when running with exotic configurations (e.g., STEAL + NO-FORCE with logical logging).

5. **Readable, well-documented code.** The codebase is a learning artifact. Functions should be short, names should be descriptive, and every non-obvious design choice should carry an inline comment referencing the relevant lecture or textbook section.

6. **Safe experimentation.** Users should be able to change configurations, crash the system, corrupt state, and recover -- without fear. The system should make it easy to reset to a known state.

### Non-Goals

1. **Production use.** database0 is not designed to serve real applications. It will not compete with SQLite, DuckDB, or PostgreSQL on performance, reliability, or feature completeness.

2. **Full SQL compliance.** We implement enough SQL to exercise every subsystem (DDL, DML, aggregations, joins, subqueries, transactions) but do not target SQL:2023 compliance. Features like views, triggers, stored procedures, and user-defined functions are out of scope.

3. **Horizontal scalability.** The distributed subsystem (Phase 6) is a stretch goal for learning, not a production-grade distributed database.

4. **Ecosystem integrations.** No JDBC/ODBC drivers, no ORM compatibility, no wire-protocol compatibility with existing databases.

5. **Performance optimization.** We choose clarity over speed. Where a 10x faster implementation exists but is harder to understand, we choose the clearer one and document the production alternative.

---

## 3. Architecture Overview

### Design Principles

**Trait-based polymorphism.** Every swappable subsystem is defined by a Rust trait. Concrete implementations are selected at startup (via configuration) and, where safe, at runtime (via SQL `SET` commands). This is the single most important architectural decision.

**Layered architecture.** The system is organized into clean layers with well-defined interfaces:

```
+-------------------------------------------------------------------+
|                        SQL Frontend                                |
|  Parser -> Binder -> Logical Planner -> Optimizer -> Physical Plan |
+-------------------------------------------------------------------+
|                     Execution Engine                               |
|  Processing Model (Iterator/Materialization/Vectorized)            |
|  Operators: Scan, Filter, Project, Join, Sort, Aggregate           |
+-------------------------------------------------------------------+
|                    Access Methods                                   |
|  Sequential Scan | Index Scan (B+Tree, Hash, Skip List, Trie)     |
+-------------------------------------------------------------------+
|                  Concurrency Control                               |
|  Lock Manager | Timestamp Manager | MVCC Version Store             |
+-------------------------------------------------------------------+
|                    Buffer Pool Manager                              |
|  Replacement Policy | Pre-fetching | Multiple Pools               |
+-------------------------------------------------------------------+
|                    Storage Engine                                   |
|  Page Layout | Storage Model (NSM/DSM/PAX) | Compression           |
|  Heap Files | Log-Structured Storage (LSM)                         |
+-------------------------------------------------------------------+
|                    Recovery Manager                                 |
|  WAL | Checkpointing | ARIES Recovery                             |
+-------------------------------------------------------------------+
|                    Disk Manager                                     |
|  File I/O | Direct I/O | OS Cache                                  |
+-------------------------------------------------------------------+
```

**Registry pattern.** A global `SubsystemRegistry` holds trait objects for each active implementation. When a user changes a configuration at runtime, the registry swaps the trait object (with appropriate synchronization). Components obtain their dependencies from the registry, never by direct construction.

**Instrumentation as a first-class citizen.** Every subsystem emits structured metrics through a shared telemetry bus. Metrics are zero-cost when disabled (compile-time feature flag for production-like benchmarking).

### Data Flow

1. **Client** sends SQL text over a simple TCP or Unix socket protocol.
2. **Parser** produces an AST.
3. **Binder** resolves names against the catalog, producing a bound AST.
4. **Logical Planner** converts the bound AST into a logical plan (relational algebra tree).
5. **Optimizer** applies logical rewrites (predicate pushdown, projection pushdown, constant folding) and then physical plan selection (access method choice, join algorithm, processing model).
6. **Execution Engine** executes the physical plan. Operators call into access methods, which call into the buffer pool, which calls into the disk manager.
7. **Concurrency Control** interposes on every read/write to enforce isolation.
8. **Recovery Manager** logs every modification before it reaches disk.
9. **Results** flow back to the client.

### Thread Model

The system uses a configurable thread model:

- **Thread-per-connection** (default): Each client connection gets a dedicated worker thread. Simple and debuggable.
- **Embedded mode**: The DBMS runs in-process, callable as a Rust library. The application manages its own threads.

A shared thread pool handles background tasks: WAL flushing, dirty page writing, garbage collection, compaction, and statistics collection.

---

## 4. Configuration System

### Configuration Sources (in priority order)

1. **Runtime SQL commands** (`SET` statements) -- highest priority
2. **Environment variables** (prefixed `DATABASE0_`)
3. **TOML configuration file** (`database0.toml`)
4. **Compiled defaults** -- lowest priority

### TOML Configuration File

The configuration file is organized by subsystem, mirroring the system architecture. Every option includes an inline comment documenting what it does, valid values, and which lecture it relates to.

```toml
# database0.toml -- Educational DBMS Configuration
# Every option maps to a concept from CMU 15-445/645.

[storage]
# Lecture 3-5: Page layout for tuple-oriented storage
page_layout = "slotted"          # "slotted" | "log_structured"
storage_model = "nsm"            # "nsm" (row) | "dsm" (column) | "pax" (hybrid)
page_size = 4096                 # bytes: 4096 | 8192 | 16384 | 65536
tuple_storage = "heap"           # "heap" | "index_organized"
record_id_size = 8               # bytes: 4 | 6 | 8 | 10

[lsm]
# Lecture 5: Log-Structured Merge Tree
enabled = false                  # Enable LSM storage engine
memtable_structure = "skip_list" # "skip_list" | "red_black_tree" | "hash_map"
compaction_strategy = "level"    # "universal" | "level"
sstable_block_size = 4096        # bytes
bloom_filter_enabled = true
bloom_filter_fpr = 0.01          # false positive rate (0.0 - 1.0)
wal_for_memtable = true          # WAL for MemTable recovery

[buffer_pool]
# Lecture 4-5: Buffer Pool Manager
size = 1024                      # number of frames
replacement_policy = "lru_k"     # "lru" | "clock" | "lru_k" | "arc"
lru_k = 2                        # K parameter for LRU-K
num_pools = 1                    # 1 = single pool; >1 = multiple pools
pool_assignment = "hash"         # "hash" | "per_table" | "per_database"
background_writing = true        # periodic dirty page flushing
prefetching = "sequential"       # "none" | "sequential" | "index_based"
scan_sharing = false             # attach new scans to existing cursors
direct_io = true                 # O_DIRECT bypass of OS cache

[compression]
# Lecture 6: Storage Models & Compression
algorithm = "none"               # "none" | "lz4" | "snappy" | "zstd"
columnar_encoding = "none"       # "none" | "rle" | "bit_packing" | "delta" |
                                 # "dictionary" | "bitmap"
granularity = "block"            # "block" | "tuple" | "attribute" | "columnar"
late_materialization = false     # operate on compressed data

[index]
# Lectures 8-9: Indexes & Filters
primary_type = "btree"           # "btree" | "skip_list" | "hash" | "trie"

[index.btree]
# Lecture 8: B+Tree Design Choices
node_size = 4096                 # bytes
merge_threshold = "eager"        # "eager" | "lazy"
variable_key_handling = "key_map" # "padding" | "key_map"
intra_node_search = "binary"     # "linear" | "binary" | "interpolation"
prefix_compression = true
deduplication = true
suffix_truncation = true
pointer_swizzling = false
bulk_insert = false
write_optimized = false          # B-epsilon tree mode

[index.hash]
# Lecture 7: Hash Tables
hash_table_type = "linear_probe" # "linear_probe" | "cuckoo" | "chained" |
                                 # "extendible" | "linear_hashing"
hash_function = "xxhash3"        # "crc32" | "murmurhash3" | "xxhash3"

[index.filter]
# Lecture 9: Filters
type = "bloom"                   # "bloom" | "cuckoo" | "none"
bloom_bits_per_key = 10
bloom_num_hashes = 7

[index.concurrency]
# Lecture 10: Index Concurrency Control
latch_type = "rw_latch"          # "spin" | "os_mutex" | "rw_latch"
btree_protocol = "crabbing"      # "crabbing" | "optimistic"
hash_latching = "page"           # "page" | "slot" | "latch_free"

[sorting]
# Lecture 11: Sorting & Aggregation
in_memory_sort = "quicksort"     # "quicksort" | "radix_sort"
external_sort = "k_way_merge"    # "two_way_merge" | "k_way_merge"
double_buffering = true
code_specialization = false
suffix_truncation = true
key_normalization = false

[aggregation]
# Lecture 11: Aggregation
strategy = "hash"                # "sort" | "hash"
external_hash_partitions = 128   # partition count for external hashing

[join]
# Lecture 12: Join Algorithms
algorithm = "hash"               # "nested_loop_naive" | "nested_loop_block" |
                                 # "nested_loop_index" | "sort_merge" |
                                 # "hash_basic" | "hash_grace"
output_mode = "early"            # "early" (materialization) | "late"
bloom_filter_optimization = true # sideways information passing
hash_recursive_partitioning = 2  # max recursion depth for Grace hash join

[query_processing]
# Lecture 13: Query Processing
processing_model = "volcano"     # "volcano" | "materialization" | "vectorized"
processing_direction = "top_down" # "top_down" (pull) | "bottom_up" (push)
vector_size = 1024               # batch size for vectorized model
scan_optimization = "zone_maps"  # "none" | "zone_maps" | "buffer_bypass" |
                                 # "prefetch" | "late_materialization"

[optimizer]
# Lectures 15-16: Query Planning & Optimization
type = "hybrid"                  # "heuristic" | "cost_based" | "hybrid"
plan_enumeration = "bottom_up"   # "bottom_up" (System R) | "top_down" (Volcano/Cascades)
cost_weight_cpu = 1.0
cost_weight_io = 10.0
cost_weight_memory = 0.5
statistics_type = "histogram"    # "histogram" | "sketch" | "sampling"
histogram_type = "equi_depth"    # "equi_width" | "equi_depth"
predicate_pushdown = true
projection_pushdown = true
constant_folding = true
search_termination = "exhaustion" # "wall_clock" | "cost_threshold" |
                                  # "exhaustion" | "transformation_count"
search_timeout_ms = 5000         # for wall_clock termination
join_ordering = "left_deep"      # "left_deep" | "bushy"

[concurrency]
# Lectures 17-19: Concurrency Control
protocol = "mvcc"                # "2pl" | "timestamp" | "occ" | "mvcc"
twopl_variant = "ss2pl"         # "basic" | "ss2pl"
deadlock_handling = "detection"  # "detection" | "wait_die" | "wound_wait"
lock_granularity = "tuple"       # "table" | "page" | "tuple"
intention_locks = true
lock_escalation = false
escalation_threshold = 1000      # locks before escalation
timestamp_allocation = "hybrid"  # "system_clock" | "logical" | "hybrid"
isolation_level = "serializable" # "read_uncommitted" | "read_committed" |
                                 # "repeatable_read" | "serializable"
phantom_protection = "index_locking" # "index_locking" | "rescan"

[mvcc]
# Lecture 20: MVCC
version_storage = "delta"        # "append_only_o2n" | "append_only_n2o" |
                                 # "time_travel" | "delta"
garbage_collection = "background" # "background" | "cooperative" | "transaction"
secondary_index_pointers = "logical" # "logical" | "physical"
delete_strategy = "flag"         # "flag" | "tombstone"
snapshot_isolation = true
write_skew_detection = true

[recovery]
# Lectures 21-22: Recovery
approach = "wal"                 # "shadow_paging" | "wal" | "journal"
buffer_policy = "steal_no_force" # "steal_force" | "steal_no_force" |
                                 # "no_steal_force" | "no_steal_no_force"
logging_scheme = "physiological" # "physical" | "logical" | "physiological"
checkpoint_strategy = "fuzzy"    # "blocking" | "non_fuzzy" | "fuzzy"
group_commit = true
group_commit_batch_size = 64
group_commit_timeout_us = 1000   # microseconds
aries_recovery = true            # full Analysis/Redo/Undo

[distributed]
# Lectures 23-24: Distributed Databases (Stretch Goal)
enabled = false
process_model = "thread_per_worker" # "thread_per_worker" | "embedded"
intra_query_parallelism = "intra_operator" # "intra_operator" | "inter_operator" | "bushy"
partitioning = "hash"            # "hash" | "range" | "consistent" | "rendezvous"
coordinator = "centralized"      # "centralized" | "decentralized"
atomic_commit = "two_phase"      # "two_phase" | "paxos" | "raft"
cap_mode = "cp"                  # "cp" | "ap"

[telemetry]
enabled = true
output = "embedded"              # "embedded" | "prometheus" | "csv"
sample_rate = 1.0                # 0.0 to 1.0
trace_queries = true
trace_buffer_pool = true
trace_wal = true
trace_latches = true
```

### Runtime Configuration via SQL

Users can change many settings at runtime using `SET` commands. This is critical for the learning experience -- users should be able to switch algorithms mid-session and immediately observe the impact.

```sql
-- Switch buffer pool replacement policy
SET buffer_pool.replacement_policy = 'clock';

-- Switch join algorithm
SET join.algorithm = 'sort_merge';

-- Change isolation level for current session
SET concurrency.isolation_level = 'read_committed';

-- View current configuration
SHOW CONFIG;
SHOW CONFIG buffer_pool;
SHOW CONFIG join.algorithm;

-- View which options support runtime changes
SHOW CONFIG MUTABLE;
```

### Mutability Rules

Each configuration option is classified as one of:

| Mutability | Meaning | Example |
|---|---|---|
| **Runtime** | Can change at any time via `SET` | `join.algorithm`, `buffer_pool.replacement_policy` |
| **Session** | Takes effect for new sessions only | `concurrency.isolation_level` |
| **Restart** | Requires DBMS restart | `storage.page_size`, `storage.storage_model` |
| **Init-only** | Can only be set at database creation time | `storage.record_id_size` |

The rationale: options that affect on-disk format (page size, storage model, record ID format) cannot change at runtime without a full data migration. Options that affect in-memory algorithms (replacement policy, join algorithm, processing model) can change freely.

---

## 5. Subsystem Specifications

### 5.1 Storage Engine

**Trait: `StorageEngine`**

```rust
pub trait StorageEngine: Send + Sync {
    fn read_tuple(&self, rid: RecordId) -> Result<Tuple>;
    fn insert_tuple(&self, table_id: TableId, tuple: &Tuple) -> Result<RecordId>;
    fn update_tuple(&self, rid: RecordId, tuple: &Tuple) -> Result<()>;
    fn delete_tuple(&self, rid: RecordId) -> Result<()>;
    fn scan(&self, table_id: TableId) -> Result<Box<dyn TupleIterator>>;
    fn page_layout(&self) -> PageLayout;
    fn storage_model(&self) -> StorageModel;
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `page_layout` | `slotted`, `log_structured` | `slotted` | Restart | 3 |
| `storage_model` | `nsm`, `dsm`, `pax` | `nsm` | Restart | 6 |
| `page_size` | 4096, 8192, 16384, 65536 | 4096 | Init-only | 3 |
| `tuple_storage` | `heap`, `index_organized` | `heap` | Restart | 5 |
| `record_id_size` | 4, 6, 8, 10 | 8 | Init-only | 3 |

**Observable Metrics:**

- `storage.pages_read` -- total pages read from disk
- `storage.pages_written` -- total pages written to disk
- `storage.sequential_reads` -- sequential I/O count
- `storage.random_reads` -- random I/O count
- `storage.page_splits` -- number of page splits (slotted pages)
- `storage.fragmentation_ratio` -- percentage of wasted space in pages
- `storage.bytes_per_tuple_avg` -- average bytes per stored tuple (reveals NSM vs DSM overhead)
- `storage.columns_read_per_query` -- columns accessed vs total columns (shows DSM advantage)

### 5.2 Log-Structured Storage (LSM)

**Trait: `LsmEngine`**

```rust
pub trait MemTable: Send + Sync {
    fn get(&self, key: &[u8]) -> Option<Vec<u8>>;
    fn put(&mut self, key: Vec<u8>, value: Vec<u8>);
    fn delete(&mut self, key: &[u8]);
    fn scan(&self, start: &[u8], end: &[u8]) -> Box<dyn Iterator<Item = (Vec<u8>, Vec<u8>)>>;
    fn size(&self) -> usize;
    fn flush(&self) -> SSTable;
}

pub trait CompactionStrategy: Send + Sync {
    fn should_compact(&self, levels: &[Vec<SSTable>]) -> Option<CompactionTask>;
    fn compact(&self, tables: Vec<SSTable>) -> Vec<SSTable>;
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `memtable_structure` | `skip_list`, `red_black_tree`, `hash_map` | `skip_list` | Restart | 5, 9 |
| `compaction_strategy` | `universal`, `level` | `level` | Runtime | 5 |
| `sstable_block_size` | 1024 - 65536 | 4096 | Restart | 5 |
| `bloom_filter_enabled` | true, false | true | Runtime | 9 |
| `bloom_filter_fpr` | 0.001 - 0.1 | 0.01 | Runtime | 9 |
| `wal_for_memtable` | true, false | true | Runtime | 21 |

**Observable Metrics:**

- `lsm.memtable_size` -- current MemTable size in bytes
- `lsm.memtable_flush_count` -- number of MemTable flushes
- `lsm.sstable_count_per_level` -- SSTable count at each level
- `lsm.compaction_count` -- total compactions performed
- `lsm.compaction_bytes_read` -- bytes read during compaction (write amplification indicator)
- `lsm.compaction_bytes_written` -- bytes written during compaction
- `lsm.write_amplification` -- ratio of physical writes to logical writes
- `lsm.read_amplification` -- average SSTables checked per read
- `lsm.bloom_filter_true_positive` -- bloom filter hits
- `lsm.bloom_filter_false_positive` -- bloom filter false positives (validates FPR setting)
- `lsm.bloom_filter_true_negative` -- bloom filter correct rejections

### 5.3 Buffer Pool Manager

**Trait: `BufferPoolManager`**

```rust
pub trait ReplacementPolicy: Send + Sync {
    fn record_access(&mut self, frame_id: FrameId, access_type: AccessType);
    fn evict(&mut self) -> Option<FrameId>;
    fn pin(&mut self, frame_id: FrameId);
    fn unpin(&mut self, frame_id: FrameId);
    fn name(&self) -> &str;
}

pub trait BufferPool: Send + Sync {
    fn fetch_page(&self, page_id: PageId) -> Result<PageGuard>;
    fn new_page(&self) -> Result<(PageId, PageGuard)>;
    fn flush_page(&self, page_id: PageId) -> Result<()>;
    fn flush_all(&self) -> Result<()>;
    fn unpin_page(&self, page_id: PageId, is_dirty: bool) -> Result<()>;
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `size` | 64 - 1048576 | 1024 | Restart | 4 |
| `replacement_policy` | `lru`, `clock`, `lru_k`, `arc` | `lru_k` | Runtime | 4 |
| `lru_k` | 1 - 10 | 2 | Runtime | 4 |
| `num_pools` | 1 - 16 | 1 | Restart | 5 |
| `pool_assignment` | `hash`, `per_table`, `per_database` | `hash` | Restart | 5 |
| `background_writing` | true, false | true | Runtime | 4 |
| `prefetching` | `none`, `sequential`, `index_based` | `sequential` | Runtime | 5 |
| `scan_sharing` | true, false | false | Runtime | 5 |
| `direct_io` | true, false | true | Runtime | 5 |

**Observable Metrics:**

- `buffer_pool.hit_rate` -- cache hit ratio (the single most important metric for this subsystem)
- `buffer_pool.miss_rate` -- cache miss ratio
- `buffer_pool.evictions` -- total evictions
- `buffer_pool.dirty_evictions` -- evictions requiring disk write
- `buffer_pool.pin_count_distribution` -- histogram of pin counts across frames
- `buffer_pool.prefetch_hits` -- prefetched pages that were subsequently accessed
- `buffer_pool.prefetch_waste` -- prefetched pages evicted without being accessed
- `buffer_pool.disk_reads` -- physical disk reads
- `buffer_pool.disk_writes` -- physical disk writes
- `buffer_pool.scan_sharing_joins` -- times a scan attached to an existing cursor
- `buffer_pool.sequential_flood_events` -- detected sequential flooding incidents

### 5.4 Compression

**Trait: `CompressionEngine`**

```rust
pub trait BlockCompressor: Send + Sync {
    fn compress(&self, data: &[u8]) -> Result<Vec<u8>>;
    fn decompress(&self, data: &[u8]) -> Result<Vec<u8>>;
    fn name(&self) -> &str;
    fn ratio(&self) -> f64; // running average compression ratio
}

pub trait ColumnarEncoder: Send + Sync {
    fn encode(&self, column: &ColumnData) -> Result<EncodedColumn>;
    fn decode(&self, encoded: &EncodedColumn) -> Result<ColumnData>;
    fn supports_predicate_evaluation(&self) -> bool; // late materialization
    fn evaluate_predicate(&self, encoded: &EncodedColumn, pred: &Predicate)
        -> Result<BitVec>;
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `algorithm` | `none`, `lz4`, `snappy`, `zstd` | `none` | Runtime | 6 |
| `columnar_encoding` | `none`, `rle`, `bit_packing`, `delta`, `dictionary`, `bitmap` | `none` | Restart | 6 |
| `granularity` | `block`, `tuple`, `attribute`, `columnar` | `block` | Restart | 6 |
| `late_materialization` | true, false | false | Runtime | 6 |

**Observable Metrics:**

- `compression.ratio` -- overall compression ratio (uncompressed / compressed)
- `compression.compress_time_us` -- time spent compressing
- `compression.decompress_time_us` -- time spent decompressing
- `compression.bytes_saved` -- total bytes saved by compression
- `compression.late_materialization_skipped_bytes` -- bytes avoided by operating on compressed data
- `compression.dict_size` -- dictionary size for dictionary compression
- `compression.encoding_cardinality` -- distinct values per column (helps explain encoding choice)

### 5.5 Index Structures

**Trait: `Index`**

```rust
pub trait Index: Send + Sync {
    fn insert(&self, key: &IndexKey, rid: RecordId) -> Result<()>;
    fn delete(&self, key: &IndexKey, rid: RecordId) -> Result<()>;
    fn search(&self, key: &IndexKey) -> Result<Vec<RecordId>>;
    fn range_scan(&self, start: &IndexKey, end: &IndexKey)
        -> Result<Box<dyn Iterator<Item = (IndexKey, RecordId)>>>;
    fn index_type(&self) -> IndexType;
}

pub trait HashIndex: Index {
    fn hash_function(&self) -> &dyn HashFunction;
    fn load_factor(&self) -> f64;
    fn bucket_count(&self) -> usize;
}

pub trait BTreeIndex: Index {
    fn height(&self) -> usize;
    fn node_count(&self) -> usize;
    fn leaf_count(&self) -> usize;
    fn fill_factor(&self) -> f64;
}

pub trait Filter: Send + Sync {
    fn insert(&mut self, key: &[u8]);
    fn may_contain(&self, key: &[u8]) -> bool;
    fn false_positive_rate(&self) -> f64;
    fn memory_usage(&self) -> usize;
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `primary_type` | `btree`, `skip_list`, `hash`, `trie` | `btree` | Restart | 8, 9 |
| `btree.node_size` | 512 - 65536 | 4096 | Restart | 8 |
| `btree.merge_threshold` | `eager`, `lazy` | `eager` | Runtime | 8 |
| `btree.variable_key_handling` | `padding`, `key_map` | `key_map` | Restart | 8 |
| `btree.intra_node_search` | `linear`, `binary`, `interpolation` | `binary` | Runtime | 8 |
| `btree.prefix_compression` | true, false | true | Restart | 8 |
| `btree.deduplication` | true, false | true | Restart | 8 |
| `btree.suffix_truncation` | true, false | true | Restart | 8 |
| `btree.pointer_swizzling` | true, false | false | Runtime | 8 |
| `btree.bulk_insert` | true, false | false | Runtime | 8 |
| `btree.write_optimized` | true, false | false | Restart | 8 |
| `hash.hash_table_type` | `linear_probe`, `cuckoo`, `chained`, `extendible`, `linear_hashing` | `linear_probe` | Restart | 7 |
| `hash.hash_function` | `crc32`, `murmurhash3`, `xxhash3` | `xxhash3` | Restart | 7 |
| `filter.type` | `bloom`, `cuckoo`, `none` | `bloom` | Runtime | 9 |
| `filter.bloom_bits_per_key` | 4 - 32 | 10 | Restart | 9 |
| `filter.bloom_num_hashes` | 1 - 16 | 7 | Restart | 9 |

**Observable Metrics:**

- `index.btree.height` -- tree height
- `index.btree.node_count` -- total nodes
- `index.btree.fill_factor` -- average node fill factor
- `index.btree.splits` -- node splits during inserts
- `index.btree.merges` -- node merges during deletes
- `index.btree.traversal_depth_avg` -- average nodes visited per lookup
- `index.btree.intra_node_comparisons` -- comparisons within a node (reveals linear vs binary cost)
- `index.hash.load_factor` -- hash table load factor
- `index.hash.collisions` -- total collisions
- `index.hash.resize_count` -- hash table resize events
- `index.hash.probe_length_avg` -- average probe chain length
- `index.filter.queries` -- total filter queries
- `index.filter.false_positives` -- empirical false positive count
- `index.filter.memory_bytes` -- filter memory usage

### 5.6 Index Concurrency Control

**Trait: `Latch`**

```rust
pub trait Latch: Send + Sync {
    fn acquire_shared(&self);
    fn acquire_exclusive(&self);
    fn release_shared(&self);
    fn release_exclusive(&self);
    fn try_acquire_shared(&self) -> bool;
    fn try_acquire_exclusive(&self) -> bool;
}

pub trait BTreeConcurrencyProtocol: Send + Sync {
    fn begin_traversal(&self, root: PageId, mode: TraversalMode) -> TraversalContext;
    fn descend(&self, ctx: &mut TraversalContext, child: PageId) -> Result<()>;
    fn at_leaf(&self, ctx: &mut TraversalContext) -> Result<()>;
    fn finish(&self, ctx: TraversalContext);
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `latch_type` | `spin`, `os_mutex`, `rw_latch` | `rw_latch` | Restart | 10 |
| `btree_protocol` | `crabbing`, `optimistic` | `crabbing` | Runtime | 10 |
| `hash_latching` | `page`, `slot`, `latch_free` | `page` | Restart | 10 |

**Observable Metrics:**

- `latch.acquisitions` -- total latch acquisitions
- `latch.contentions` -- times a latch was contended (not immediately acquired)
- `latch.spin_cycles` -- CPU cycles spent spinning (spin latches)
- `latch.wait_time_us` -- total time spent waiting for latches
- `latch.shared_vs_exclusive_ratio` -- read vs write latch ratio
- `btree.protocol_restarts` -- optimistic protocol restarts (key metric for comparing protocols)
- `btree.latches_held_max` -- peak concurrent latches per traversal (shows crabbing cost)

### 5.7 Sorting and Aggregation

**Trait: `SortEngine`**

```rust
pub trait Sorter: Send + Sync {
    fn sort(&self, input: &mut [Tuple], comparator: &dyn Comparator) -> Result<()>;
    fn external_sort(
        &self,
        input: Box<dyn TupleIterator>,
        comparator: &dyn Comparator,
        mem_budget: usize,
    ) -> Result<Box<dyn TupleIterator>>;
}

pub trait Aggregator: Send + Sync {
    fn aggregate(
        &self,
        input: Box<dyn TupleIterator>,
        group_by: &[ColumnRef],
        aggregates: &[AggregateExpr],
        mem_budget: usize,
    ) -> Result<Box<dyn TupleIterator>>;
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `in_memory_sort` | `quicksort`, `radix_sort` | `quicksort` | Runtime | 11 |
| `external_sort` | `two_way_merge`, `k_way_merge` | `k_way_merge` | Runtime | 11 |
| `double_buffering` | true, false | true | Runtime | 11 |
| `code_specialization` | true, false | false | Runtime | 11 |
| `suffix_truncation` | true, false | true | Runtime | 11 |
| `key_normalization` | true, false | false | Runtime | 11 |
| `aggregation.strategy` | `sort`, `hash` | `hash` | Runtime | 11 |
| `aggregation.external_hash_partitions` | 16 - 4096 | 128 | Runtime | 11 |

**Observable Metrics:**

- `sort.comparisons` -- total key comparisons
- `sort.passes` -- merge passes for external sort
- `sort.disk_io_pages` -- pages read/written during external sort
- `sort.memory_peak_bytes` -- peak memory usage
- `sort.prefetch_hits` -- double buffering effectiveness
- `aggregation.partitions_created` -- partitions in external hashing
- `aggregation.partition_spills` -- partitions that spilled to disk
- `aggregation.hash_table_size` -- in-memory hash table size

### 5.8 Join Algorithms

**Trait: `JoinExecutor`**

```rust
pub trait JoinExecutor: Send + Sync {
    fn execute(
        &self,
        left: Box<dyn TupleIterator>,
        right: Box<dyn TupleIterator>,
        condition: &JoinCondition,
        join_type: JoinType,
    ) -> Result<Box<dyn TupleIterator>>;
    fn name(&self) -> &str;
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `algorithm` | `nested_loop_naive`, `nested_loop_block`, `nested_loop_index`, `sort_merge`, `hash_basic`, `hash_grace` | `hash_basic` | Runtime | 12 |
| `output_mode` | `early`, `late` | `early` | Runtime | 12 |
| `bloom_filter_optimization` | true, false | true | Runtime | 12 |
| `hash_recursive_partitioning` | 0 - 5 | 2 | Runtime | 12 |

**Observable Metrics:**

- `join.tuples_compared` -- total tuple comparisons
- `join.tuples_produced` -- output tuple count
- `join.disk_io_pages` -- pages read/written
- `join.build_time_us` -- time building hash table or sorting
- `join.probe_time_us` -- time probing or merging
- `join.memory_peak_bytes` -- peak memory usage
- `join.partitions_spilled` -- partitions that exceeded memory (Grace hash join)
- `join.bloom_filter_rejects` -- tuples rejected by Bloom filter before probe
- `join.block_nested_loop_blocks` -- blocks processed (block NLJ)

### 5.9 Query Processing

**Trait: `ExecutionEngine`**

```rust
pub trait Operator: Send {
    /// Iterator model: return one tuple at a time
    fn next(&mut self) -> Result<Option<Tuple>>;

    /// Materialization model: produce all output at once
    fn execute(&mut self) -> Result<Vec<Tuple>> {
        // default: call next() repeatedly
    }

    /// Vectorized model: return a batch of tuples
    fn next_batch(&mut self, batch_size: usize) -> Result<TupleBatch> {
        // default: call next() batch_size times
    }

    fn schema(&self) -> &Schema;
    fn children(&self) -> Vec<&dyn Operator>;
    fn name(&self) -> &str;
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `processing_model` | `volcano`, `materialization`, `vectorized` | `volcano` | Runtime | 13 |
| `processing_direction` | `top_down`, `bottom_up` | `top_down` | Runtime | 13 |
| `vector_size` | 64 - 8192 | 1024 | Runtime | 13 |
| `scan_optimization` | `none`, `zone_maps`, `buffer_bypass`, `prefetch`, `late_materialization` | `zone_maps` | Runtime | 13 |

**Observable Metrics:**

- `execution.tuples_processed` -- total tuples processed
- `execution.batches_processed` -- batches processed (vectorized mode)
- `execution.operator_time_us` -- per-operator execution time
- `execution.pipeline_breakers` -- number of pipeline-breaking operators
- `execution.next_calls` -- total next() calls (Iterator model overhead indicator)
- `execution.materialized_bytes` -- intermediate result size (materialization model)
- `execution.simd_operations` -- SIMD instructions used (vectorized model)
- `execution.zone_map_skips` -- pages skipped via zone maps
- `execution.buffer_bypass_pages` -- pages processed without entering buffer pool

### 5.10 Query Optimization

**Trait: `QueryOptimizer`**

```rust
pub trait QueryOptimizer: Send + Sync {
    fn optimize(&self, logical_plan: LogicalPlan) -> Result<PhysicalPlan>;
    fn explain(&self, logical_plan: &LogicalPlan) -> Result<ExplainOutput>;
}

pub trait CostModel: Send + Sync {
    fn estimate_cost(&self, plan: &PhysicalPlan, stats: &Statistics) -> Cost;
    fn estimate_cardinality(&self, plan: &LogicalPlan, stats: &Statistics) -> f64;
}

pub trait StatisticsProvider: Send + Sync {
    fn get_table_stats(&self, table_id: TableId) -> Result<TableStatistics>;
    fn get_column_stats(&self, table_id: TableId, col: &str) -> Result<ColumnStatistics>;
    fn refresh(&self, table_id: TableId) -> Result<()>;
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `type` | `heuristic`, `cost_based`, `hybrid` | `hybrid` | Runtime | 15 |
| `plan_enumeration` | `bottom_up`, `top_down` | `bottom_up` | Runtime | 15 |
| `cost_weight_cpu` | 0.0 - 100.0 | 1.0 | Runtime | 15 |
| `cost_weight_io` | 0.0 - 100.0 | 10.0 | Runtime | 15 |
| `cost_weight_memory` | 0.0 - 100.0 | 0.5 | Runtime | 15 |
| `statistics_type` | `histogram`, `sketch`, `sampling` | `histogram` | Runtime | 16 |
| `histogram_type` | `equi_width`, `equi_depth` | `equi_depth` | Runtime | 16 |
| `predicate_pushdown` | true, false | true | Runtime | 15 |
| `projection_pushdown` | true, false | true | Runtime | 15 |
| `constant_folding` | true, false | true | Runtime | 15 |
| `search_termination` | `wall_clock`, `cost_threshold`, `exhaustion`, `transformation_count` | `exhaustion` | Runtime | 15 |
| `search_timeout_ms` | 100 - 60000 | 5000 | Runtime | 15 |
| `join_ordering` | `left_deep`, `bushy` | `left_deep` | Runtime | 16 |

**Observable Metrics:**

- `optimizer.plans_enumerated` -- total plans considered
- `optimizer.plans_pruned` -- plans eliminated before full costing
- `optimizer.optimization_time_us` -- total optimization time
- `optimizer.cost_estimate_vs_actual` -- estimated vs actual I/O, CPU (post-execution validation)
- `optimizer.cardinality_estimate_vs_actual` -- estimated vs actual row counts per operator
- `optimizer.rules_applied` -- logical rewrite rules triggered
- `optimizer.predicate_pushdowns` -- predicates pushed below joins
- `optimizer.join_orders_considered` -- join orderings evaluated

### 5.11 Concurrency Control

**Trait: `ConcurrencyControl`**

```rust
pub trait ConcurrencyControl: Send + Sync {
    fn begin_transaction(&self) -> Result<TransactionId>;
    fn read(&self, txn: TransactionId, rid: RecordId) -> Result<Option<Tuple>>;
    fn write(&self, txn: TransactionId, rid: RecordId, tuple: &Tuple) -> Result<()>;
    fn delete(&self, txn: TransactionId, rid: RecordId) -> Result<()>;
    fn commit(&self, txn: TransactionId) -> Result<()>;
    fn abort(&self, txn: TransactionId) -> Result<()>;
    fn protocol_name(&self) -> &str;
}

pub trait LockManager: Send + Sync {
    fn lock_shared(&self, txn: TransactionId, rid: RecordId) -> Result<()>;
    fn lock_exclusive(&self, txn: TransactionId, rid: RecordId) -> Result<()>;
    fn unlock(&self, txn: TransactionId, rid: RecordId) -> Result<()>;
    fn detect_deadlocks(&self) -> Vec<TransactionId>; // victims
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `protocol` | `2pl`, `timestamp`, `occ`, `mvcc` | `mvcc` | Restart | 17-19 |
| `twopl_variant` | `basic`, `ss2pl` | `ss2pl` | Restart | 18 |
| `deadlock_handling` | `detection`, `wait_die`, `wound_wait` | `detection` | Runtime | 18 |
| `lock_granularity` | `table`, `page`, `tuple` | `tuple` | Restart | 18 |
| `intention_locks` | true, false | true | Runtime | 18 |
| `lock_escalation` | true, false | false | Runtime | 18 |
| `escalation_threshold` | 100 - 100000 | 1000 | Runtime | 18 |
| `timestamp_allocation` | `system_clock`, `logical`, `hybrid` | `hybrid` | Restart | 19 |
| `isolation_level` | `read_uncommitted`, `read_committed`, `repeatable_read`, `serializable` | `serializable` | Session | 19 |
| `phantom_protection` | `index_locking`, `rescan` | `index_locking` | Restart | 19 |

**Observable Metrics:**

- `concurrency.transactions_committed` -- successful commits
- `concurrency.transactions_aborted` -- aborts (total, and by reason: deadlock, validation failure, timeout)
- `concurrency.deadlocks_detected` -- deadlock detection events
- `concurrency.deadlock_victims` -- transactions chosen as victims
- `concurrency.lock_wait_time_us` -- total time spent waiting for locks
- `concurrency.locks_held_max` -- peak concurrent locks per transaction
- `concurrency.lock_escalations` -- escalation events
- `concurrency.occ_validation_failures` -- OCC validation phase failures
- `concurrency.timestamp_restarts` -- T/O protocol restarts
- `concurrency.phantom_detections` -- phantom read prevention triggers
- `concurrency.abort_rate` -- aborts / (commits + aborts)

### 5.12 Multi-Version Concurrency Control (MVCC)

**Trait: `VersionStore`**

```rust
pub trait VersionStore: Send + Sync {
    fn create_version(&self, txn: TransactionId, rid: RecordId, tuple: &Tuple) -> Result<()>;
    fn get_visible_version(&self, txn: TransactionId, rid: RecordId) -> Result<Option<Tuple>>;
    fn get_version_chain(&self, rid: RecordId) -> Result<Vec<Version>>;
    fn storage_type(&self) -> VersionStorageType;
}

pub trait GarbageCollector: Send + Sync {
    fn collect(&self) -> Result<GcStats>;
    fn reclaimable_versions(&self) -> usize;
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `version_storage` | `append_only_o2n`, `append_only_n2o`, `time_travel`, `delta` | `delta` | Restart | 20 |
| `garbage_collection` | `background`, `cooperative`, `transaction` | `background` | Runtime | 20 |
| `secondary_index_pointers` | `logical`, `physical` | `logical` | Restart | 20 |
| `delete_strategy` | `flag`, `tombstone` | `flag` | Restart | 20 |
| `snapshot_isolation` | true, false | true | Runtime | 20 |
| `write_skew_detection` | true, false | true | Runtime | 20 |

**Observable Metrics:**

- `mvcc.versions_created` -- total versions created
- `mvcc.versions_garbage_collected` -- versions reclaimed
- `mvcc.version_chain_length_avg` -- average chain traversal length (key performance indicator)
- `mvcc.version_chain_length_max` -- longest chain
- `mvcc.gc_cycles` -- garbage collection rounds
- `mvcc.gc_bytes_reclaimed` -- storage freed
- `mvcc.snapshot_reads` -- reads served from snapshot
- `mvcc.write_skew_detections` -- write skew anomalies caught
- `mvcc.index_updates_per_write` -- secondary index pointer updates (physical vs logical comparison)
- `mvcc.delta_reconstruct_time_us` -- time to reconstruct tuple from deltas

### 5.13 Recovery / Write-Ahead Logging

**Trait: `RecoveryManager`**

```rust
pub trait RecoveryManager: Send + Sync {
    fn log_begin(&self, txn: TransactionId) -> Result<Lsn>;
    fn log_write(&self, txn: TransactionId, rid: RecordId,
                 before: &Tuple, after: &Tuple) -> Result<Lsn>;
    fn log_commit(&self, txn: TransactionId) -> Result<Lsn>;
    fn log_abort(&self, txn: TransactionId) -> Result<Lsn>;
    fn checkpoint(&self) -> Result<Lsn>;
    fn recover(&self) -> Result<RecoveryStats>;
    fn flush(&self) -> Result<()>;
}

pub trait LogWriter: Send + Sync {
    fn append(&self, record: &LogRecord) -> Result<Lsn>;
    fn flush_to(&self, lsn: Lsn) -> Result<()>;
    fn read(&self, lsn: Lsn) -> Result<LogRecord>;
    fn truncate(&self, lsn: Lsn) -> Result<()>;
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `approach` | `shadow_paging`, `wal`, `journal` | `wal` | Restart | 21 |
| `buffer_policy` | `steal_force`, `steal_no_force`, `no_steal_force`, `no_steal_no_force` | `steal_no_force` | Restart | 21 |
| `logging_scheme` | `physical`, `logical`, `physiological` | `physiological` | Restart | 21 |
| `checkpoint_strategy` | `blocking`, `non_fuzzy`, `fuzzy` | `fuzzy` | Runtime | 21-22 |
| `group_commit` | true, false | true | Runtime | 21 |
| `group_commit_batch_size` | 1 - 1024 | 64 | Runtime | 21 |
| `group_commit_timeout_us` | 100 - 100000 | 1000 | Runtime | 21 |
| `aries_recovery` | true, false | true | Restart | 22 |

**Observable Metrics:**

- `recovery.wal_bytes_written` -- total WAL bytes
- `recovery.wal_flushes` -- WAL flush events
- `recovery.wal_flush_latency_us` -- per-flush latency
- `recovery.group_commit_batch_size_avg` -- average batch size (indicates group commit effectiveness)
- `recovery.group_commit_wait_time_us` -- time transactions wait for batch
- `recovery.checkpoint_duration_us` -- time per checkpoint
- `recovery.checkpoint_pages_flushed` -- dirty pages written per checkpoint
- `recovery.recovery_time_us` -- total crash recovery duration
- `recovery.recovery_analysis_lsns` -- log records scanned in analysis phase
- `recovery.recovery_redo_lsns` -- log records replayed in redo phase
- `recovery.recovery_undo_lsns` -- log records undone in undo phase
- `recovery.log_file_size_bytes` -- current WAL file size
- `recovery.shadow_page_copies` -- pages copied (shadow paging mode)

### 5.14 Parallel and Distributed (Stretch Goals)

**Trait: `DistributedEngine`**

```rust
pub trait Partitioner: Send + Sync {
    fn partition(&self, key: &[u8], num_nodes: usize) -> NodeId;
    fn rebalance(&self, old_nodes: &[NodeId], new_nodes: &[NodeId])
        -> Vec<(KeyRange, NodeId, NodeId)>; // (range, from, to)
}

pub trait AtomicCommitProtocol: Send + Sync {
    fn prepare(&self, txn: TransactionId, participants: &[NodeId]) -> Result<PrepareResult>;
    fn commit(&self, txn: TransactionId) -> Result<()>;
    fn abort(&self, txn: TransactionId) -> Result<()>;
}
```

**Configurable Options:**

| Option | Values | Default | Mutability | Lecture |
|---|---|---|---|---|
| `process_model` | `thread_per_worker`, `embedded` | `thread_per_worker` | Restart | 14 |
| `intra_query_parallelism` | `intra_operator`, `inter_operator`, `bushy` | `intra_operator` | Runtime | 14 |
| `partitioning` | `hash`, `range`, `consistent`, `rendezvous` | `hash` | Restart | 23 |
| `coordinator` | `centralized`, `decentralized` | `centralized` | Restart | 23 |
| `atomic_commit` | `two_phase`, `paxos`, `raft` | `two_phase` | Restart | 24 |
| `cap_mode` | `cp`, `ap` | `cp` | Restart | 24 |

**Observable Metrics:**

- `distributed.messages_sent` -- inter-node messages
- `distributed.message_latency_us` -- per-message latency
- `distributed.partitions_shuffled` -- data movement during repartitioning
- `distributed.commit_latency_us` -- atomic commit protocol latency
- `distributed.prepare_votes` -- prepare phase vote count
- `distributed.coordinator_failures` -- simulated coordinator failures
- `distributed.data_skew` -- partition size variance (measures partitioning quality)

---

## 6. Observability and Instrumentation

### Design Philosophy

Observability is the primary mechanism through which database0 delivers educational value. The system does not merely expose metrics -- it narrates what is happening internally, connecting runtime behavior to the theoretical concepts from the course.

### 6.1 Metrics System

Every metric listed in Section 5 is collected by a lightweight, lock-free metrics aggregator. Metrics are organized hierarchically by subsystem and accessible via SQL.

```sql
-- View all metrics
SELECT * FROM db0_metrics;

-- View metrics for a specific subsystem
SELECT * FROM db0_metrics WHERE subsystem = 'buffer_pool';

-- View a specific metric over time
SELECT timestamp, value FROM db0_metric_history
WHERE name = 'buffer_pool.hit_rate'
ORDER BY timestamp DESC LIMIT 100;

-- Reset all metrics (for clean experiment runs)
CALL db0_reset_metrics();

-- Reset metrics for a subsystem
CALL db0_reset_metrics('buffer_pool');
```

### 6.2 Query Tracing

Every query execution produces a structured trace that shows exactly what happened at each stage.

```sql
-- Enable detailed tracing for the next query
SET trace = true;

SELECT * FROM orders JOIN customers ON orders.cust_id = customers.id
WHERE customers.country = 'US';

-- View the trace
SHOW TRACE;
```

Example trace output:

```
Query: SELECT * FROM orders JOIN customers ON ...
Plan:  HashJoin(IndexScan(customers), SeqScan(orders))
Config: join.algorithm=hash_basic, processing_model=volcano, isolation=serializable

Optimizer:
  Plans enumerated:    12
  Selected plan cost:  1,847 (I/O: 1,200 | CPU: 647)
  Optimization time:   2.3 ms
  Rules applied:       predicate_pushdown, projection_pushdown

Execution:
  +-- HashJoin (hash_basic)
  |   Build time:       4.2 ms
  |   Probe time:       8.7 ms
  |   Tuples compared:  15,847
  |   Tuples produced:  3,201
  |   Memory peak:      256 KB
  |   Bloom rejects:    12,646
  |
  +-- IndexScan (customers, idx_country)
  |   Index lookups:    1
  |   Tuples returned:  847
  |   Pages accessed:   3
  |
  +-- SeqScan (orders)
      Pages scanned:    150
      Zone map skips:   12 pages
      Tuples returned:  15,000

Buffer Pool:
  Hit rate:            87.3%
  Pages fetched:       153
  Pages evicted:       20
  Disk reads:          20
  Disk writes:         0

Concurrency:
  Locks acquired:      3,201 (S)
  Lock wait time:      0 us
  Version chain avg:   1.2

Total wall time:       15.4 ms
Total I/O time:        8.1 ms
Total CPU time:        7.3 ms
```

### 6.3 EXPLAIN Variants

```sql
-- Logical plan (relational algebra)
EXPLAIN LOGICAL SELECT ...;

-- Physical plan with algorithm choices
EXPLAIN PHYSICAL SELECT ...;

-- Physical plan with cost estimates
EXPLAIN COST SELECT ...;

-- Execute and show actual vs estimated stats
EXPLAIN ANALYZE SELECT ...;

-- Full trace with all subsystem metrics
EXPLAIN TRACE SELECT ...;
```

### 6.4 Visualization Dashboard (Enhancement)

A built-in web-based dashboard (served on a configurable port) provides real-time visualization:

- **Buffer Pool Heatmap:** Visual representation of frame contents, pin states, dirty flags, and access patterns.
- **B+Tree Viewer:** Interactive visualization of the tree structure, showing node contents, splits, and merges as they happen.
- **WAL Timeline:** Scrollable timeline of log records with color coding by transaction.
- **Lock Graph:** Real-time visualization of the waits-for graph for deadlock detection.
- **Version Chain Inspector:** Visual representation of MVCC version chains per tuple.
- **Query Plan Visualizer:** Tree rendering of logical and physical plans with per-operator metrics.
- **Metric Charts:** Time-series charts for any metric, with support for overlaying multiple configurations.

### 6.5 Metric Export

```toml
[telemetry]
output = "prometheus"  # "embedded" | "prometheus" | "csv"
```

- **Embedded:** Query metrics via SQL virtual tables. Default for interactive use.
- **Prometheus:** Expose `/metrics` endpoint for Prometheus scraping. Useful for Grafana dashboards.
- **CSV:** Write periodic snapshots to CSV files. Useful for offline analysis and Jupyter notebook plotting.

---

## 7. SQL Interface

### 7.1 Supported SQL Subset

The SQL interface supports enough functionality to exercise every subsystem. The target is a practical subset of SQL-92 with selected modern extensions.

**Data Definition Language (DDL):**

```sql
CREATE TABLE table_name (
    column_name data_type [PRIMARY KEY] [NOT NULL] [UNIQUE] [DEFAULT expr],
    ...
    [PRIMARY KEY (col1, col2)]
);

DROP TABLE table_name;
ALTER TABLE table_name ADD COLUMN column_name data_type;
ALTER TABLE table_name DROP COLUMN column_name;

CREATE INDEX index_name ON table_name (col1 [ASC|DESC], ...);
CREATE INDEX index_name ON table_name USING {BTREE|HASH|SKIPLIST|TRIE} (col1, ...);
DROP INDEX index_name;
```

**Data Types:**

| Type | Description | Size |
|---|---|---|
| `INTEGER` / `INT` | 32-bit signed integer | 4 bytes |
| `BIGINT` | 64-bit signed integer | 8 bytes |
| `SMALLINT` | 16-bit signed integer | 2 bytes |
| `FLOAT` | IEEE-754 double precision | 8 bytes |
| `DECIMAL(p,s)` | Fixed-point decimal | variable |
| `VARCHAR(n)` | Variable-length string | variable |
| `CHAR(n)` | Fixed-length string | n bytes |
| `BOOLEAN` | true/false | 1 byte |
| `TIMESTAMP` | Microseconds since epoch | 8 bytes |
| `BLOB` | Binary large object | variable |

**Data Manipulation Language (DML):**

```sql
-- INSERT
INSERT INTO table_name (col1, col2) VALUES (val1, val2);
INSERT INTO table_name SELECT ... FROM ...;

-- SELECT (full support)
SELECT [DISTINCT] expr [AS alias], ...
FROM table_name [alias]
    [JOIN table ON condition]
    [LEFT|RIGHT|FULL OUTER JOIN table ON condition]
WHERE condition
GROUP BY expr, ...
HAVING condition
ORDER BY expr [ASC|DESC], ...
LIMIT n OFFSET m;

-- Subqueries
SELECT ... WHERE col IN (SELECT ...);
SELECT ... WHERE EXISTS (SELECT ...);
SELECT ... FROM (SELECT ...) AS sub;

-- CTEs
WITH cte_name AS (SELECT ...) SELECT ... FROM cte_name;

-- Aggregates
COUNT, SUM, AVG, MIN, MAX

-- Window Functions
ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)
RANK() OVER (...)

-- UPDATE
UPDATE table_name SET col1 = expr WHERE condition;

-- DELETE
DELETE FROM table_name WHERE condition;
```

**Transaction Control:**

```sql
BEGIN [TRANSACTION];
COMMIT;
ROLLBACK;
SAVEPOINT name;
ROLLBACK TO SAVEPOINT name;

SET TRANSACTION ISOLATION LEVEL {READ UNCOMMITTED | READ COMMITTED |
    REPEATABLE READ | SERIALIZABLE};
```

### 7.2 Custom Commands for Configuration and Introspection

These are database0-specific extensions for the educational use case.

**Configuration Commands:**

```sql
-- View/set configuration
SET subsystem.option = 'value';
SHOW CONFIG [subsystem[.option]];
SHOW CONFIG MUTABLE;

-- Save current config to file
CALL db0_save_config('/path/to/config.toml');

-- Load config from file (restart-only options deferred)
CALL db0_load_config('/path/to/config.toml');
```

**Introspection Commands:**

```sql
-- System catalog
SELECT * FROM db0_tables;
SELECT * FROM db0_columns WHERE table_name = 'orders';
SELECT * FROM db0_indexes;

-- Buffer pool state
SELECT * FROM db0_buffer_pool;
SELECT page_id, is_dirty, pin_count, last_access FROM db0_buffer_pool_frames;

-- Lock state
SELECT * FROM db0_locks;
SELECT * FROM db0_waits_for_graph;

-- Transaction state
SELECT * FROM db0_transactions;

-- WAL state
SELECT * FROM db0_wal_records ORDER BY lsn DESC LIMIT 20;
SELECT * FROM db0_checkpoint_info;

-- MVCC state
SELECT * FROM db0_version_chains WHERE table_name = 'orders' AND key = 42;

-- Index internals
SELECT * FROM db0_btree_stats WHERE index_name = 'idx_orders_date';
CALL db0_btree_dump('idx_orders_date');  -- prints tree structure

-- Statistics
SELECT * FROM db0_table_statistics;
SELECT * FROM db0_column_histograms WHERE table_name = 'orders';
CALL db0_analyze('orders');  -- refresh statistics
```

### 7.3 Client Interface

The system provides a simple interactive CLI client (`db0`) that connects over TCP or Unix socket.

```
$ db0
database0 v0.1.0 (CMU 15-445/645 Educational DBMS)
Connected to localhost:5445

db0> CREATE TABLE test (id INT PRIMARY KEY, value VARCHAR(100));
OK (0.3 ms)

db0> SET join.algorithm = 'sort_merge';
OK: join.algorithm changed from 'hash_basic' to 'sort_merge'

db0> \config
[current configuration summary]

db0> \metrics buffer_pool
[buffer pool metrics]

db0> \help
[command reference]
```

Special CLI commands (backslash commands):

| Command | Description |
|---|---|
| `\config` | Show current configuration |
| `\metrics [subsystem]` | Show metrics |
| `\trace` | Show last query trace |
| `\reset` | Reset database to empty state |
| `\reset metrics` | Reset all metrics |
| `\load workload.sql` | Load and execute SQL file |
| `\bench tpcc` | Run built-in benchmark |
| `\compare` | Start A/B comparison mode |
| `\help` | Show help |
| `\quit` | Exit |

---

## 8. Benchmarking and Experimentation Framework

### 8.1 Built-in Workload Generators

The system ships with configurable workload generators that produce realistic data and queries for both OLTP and OLAP patterns.

**OLTP Workload Generator (inspired by TPC-C):**

```sql
-- Generate OLTP schema and data
CALL db0_generate_workload('oltp', {
    'warehouses': 10,
    'scale_factor': 1.0
});

-- Run OLTP workload
CALL db0_run_workload('oltp', {
    'duration_seconds': 60,
    'concurrency': 8,
    'mix': {
        'new_order': 0.45,
        'payment': 0.43,
        'order_status': 0.04,
        'delivery': 0.04,
        'stock_level': 0.04
    }
});
```

**OLAP Workload Generator (inspired by TPC-H):**

```sql
-- Generate OLAP schema and data
CALL db0_generate_workload('olap', {
    'scale_factor': 0.1  -- ~100MB
});

-- Run OLAP workload
CALL db0_run_workload('olap', {
    'queries': [1, 3, 5, 6, 9, 12],  -- TPC-H query numbers
    'iterations': 5
});
```

**Micro-Benchmark Workloads:**

```sql
-- Buffer pool stress test
CALL db0_run_workload('buffer_stress', {
    'pattern': 'zipfian',    -- "uniform" | "zipfian" | "sequential" | "hotspot"
    'pages': 10000,
    'operations': 1000000,
    'read_ratio': 0.8
});

-- Join benchmark
CALL db0_run_workload('join_bench', {
    'left_rows': 100000,
    'right_rows': 1000000,
    'selectivity': 0.01,
    'distribution': 'uniform'  -- "uniform" | "skewed" | "correlated"
});

-- Concurrency stress test
CALL db0_run_workload('concurrency_stress', {
    'threads': 16,
    'duration_seconds': 30,
    'contention': 'high',  -- "none" | "low" | "medium" | "high"
    'transaction_size': 5  -- operations per transaction
});

-- Recovery test
CALL db0_run_workload('recovery_test', {
    'operations': 10000,
    'crash_after': 5000,    -- simulate crash
    'verify_after_recovery': true
});
```

### 8.2 A/B Comparison Framework

The core educational feature. Run the same workload under two configurations and compare results side by side.

```sql
-- Define configuration A
CALL db0_experiment_config('A', {
    'buffer_pool.replacement_policy': 'lru',
    'join.algorithm': 'nested_loop_block'
});

-- Define configuration B
CALL db0_experiment_config('B', {
    'buffer_pool.replacement_policy': 'lru_k',
    'join.algorithm': 'hash_basic'
});

-- Run comparison
CALL db0_experiment_run('olap', {
    'scale_factor': 0.1,
    'queries': [3, 5, 9],
    'iterations': 3
});

-- View results
SELECT * FROM db0_experiment_results;
```

Example output:

```
+----------+-------+---------+----------+-----------+---------+------------+
| Query    | Config| Avg(ms) | I/O Pages| BP Hit %  | Joins   | Memory(KB) |
+----------+-------+---------+----------+-----------+---------+------------+
| Q3       | A     | 847.2   | 4,521    | 62.3%     | 15.2M   | 2,048      |
| Q3       | B     | 123.4   | 1,203    | 91.7%     | 0.8M    | 4,096      |
| Q5       | A     | 1,203.1 | 8,932    | 54.1%     | 42.8M   | 2,048      |
| Q5       | B     | 201.7   | 2,104    | 88.4%     | 1.2M    | 8,192      |
| Q9       | A     | 2,451.3 | 12,847   | 48.7%     | 89.3M   | 2,048      |
| Q9       | B     | 412.8   | 3,521    | 85.2%     | 2.4M    | 12,288     |
+----------+-------+---------+----------+-----------+---------+------------+

Observations:
- Config B (LRU-K + Hash Join) is 5.9x faster on average
- Config B uses 73% fewer I/O pages due to better caching
- Config B uses more memory (hash table build phase)
- Config A performs 18x more tuple comparisons (nested loop)
```

### 8.3 Guided Experiments

The system ships with a set of pre-built experiment scripts that walk users through key learning outcomes.

| Experiment | What It Teaches | Config Changes |
|---|---|---|
| `01_lru_vs_clock.sql` | Buffer pool replacement trade-offs | `replacement_policy`: LRU vs CLOCK vs LRU-K |
| `02_sequential_flooding.sql` | Why LRU fails on sequential scans | `replacement_policy` + sequential workload |
| `03_nsm_vs_dsm.sql` | Row vs column store for OLTP/OLAP | `storage_model`: NSM vs DSM |
| `04_join_algorithms.sql` | When each join algorithm wins | All 6 join algorithms |
| `05_index_types.sql` | B+Tree vs Hash vs Skip List | `primary_type` variations |
| `06_btree_tuning.sql` | B+Tree node size, merge policy | `btree.*` options |
| `07_compression.sql` | Compression ratio vs CPU trade-off | `compression.*` options |
| `08_processing_models.sql` | Volcano vs Vectorized | `processing_model` variations |
| `09_isolation_levels.sql` | Anomalies at each isolation level | `isolation_level` variations |
| `10_2pl_vs_occ.sql` | Pessimistic vs optimistic CC | `protocol` variations |
| `11_mvcc_storage.sql` | Version storage trade-offs | `mvcc.version_storage` variations |
| `12_recovery_policies.sql` | STEAL/FORCE combinations + crash | `recovery.*` options |
| `13_optimizer_impact.sql` | Cost-based vs heuristic | `optimizer.*` options |
| `14_concurrency_stress.sql` | Lock contention under load | `concurrency.*` options |

Each experiment script includes:

1. **Background:** 1-2 paragraph explanation of the concepts being tested, with lecture references.
2. **Setup:** Schema creation and data loading.
3. **Experiments:** Multiple runs with different configurations.
4. **Analysis queries:** SQL to compare results from `db0_experiment_results`.
5. **Discussion questions:** Open-ended questions to deepen understanding.

---

## 9. Implementation Phases

### Phase 1: Foundation (Months 0-4)

**Goal:** A working single-threaded database that can store, retrieve, and scan tuples. This phase establishes the foundational abstractions that everything else builds on.

**Deliverables:**

| Priority | Component | Description |
|---|---|---|
| P0 | Disk Manager | File I/O, page read/write, O_DIRECT toggle |
| P0 | Page Layout | Slotted pages with header, slot array, tuple data |
| P0 | Heap File | Page directory, free space tracking, tuple CRUD |
| P0 | Buffer Pool Manager | Single pool, LRU replacement, pin/unpin, dirty page tracking |
| P0 | Storage Model (NSM) | Row-oriented tuple storage |
| P0 | SQL Parser | Parse SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, DROP TABLE |
| P0 | Catalog | System tables for schema metadata |
| P0 | Sequential Scan | Full table scan operator |
| P0 | Filter Operator | WHERE clause evaluation |
| P0 | Projection Operator | Column selection |
| P0 | Simple Executor | Iterator-model execution of single-table queries |
| P0 | TOML Config | Configuration loading, SET/SHOW commands |
| P0 | Metrics Framework | Metric collection, db0_metrics virtual table |
| P0 | CLI Client | Interactive SQL client |
| P1 | CLOCK Replacement | Second replacement policy |
| P1 | LRU-K Replacement | Third replacement policy |
| P1 | Column Store (DSM) | Decomposition storage model |
| P1 | PAX Storage | Hybrid row/column storage |
| P1 | Log-Structured Storage | MemTable, SSTable, basic compaction |
| P1 | Multiple Buffer Pools | Hash-based and per-table assignment |
| P1 | Prefetching | Sequential prefetch |
| P2 | ARC Replacement | Fourth replacement policy |
| P2 | Index-Organized Storage | Tuples stored in B+Tree leaves |
| P2 | Compression (Naive) | LZ4, Snappy, Zstd block compression |
| P2 | Columnar Compression | RLE, bit-packing, delta, dictionary, bitmap |
| P2 | Scan Sharing | Attach cursors to existing scans |

**Exit Criteria:** Can create tables, insert rows, run SELECT with WHERE and projection, observe buffer pool hit rate, and switch between NSM/DSM/PAX via config restart.

### Phase 2: Indexes, Sorting, and Joins (Months 4-7)

**Goal:** The system can execute multi-table queries with joins, sorting, and aggregation. Index structures are configurable.

**Deliverables:**

| Priority | Component | Description |
|---|---|---|
| P0 | B+Tree Index | Full implementation with search, insert, delete, range scan |
| P0 | Hash Index | Linear probe, extendible hashing |
| P0 | In-Memory Sorting | Quicksort with comparator |
| P0 | External Merge Sort | K-way merge sort |
| P0 | Nested Loop Join | Naive, block, and index variants |
| P0 | Hash Join | Basic in-memory hash join |
| P0 | Sort-Merge Join | Full implementation |
| P0 | Hash Aggregation | In-memory hash aggregation |
| P0 | Sort Aggregation | Sort-based aggregation |
| P0 | Index Scan | B+Tree and hash index scan operators |
| P1 | Skip List Index | Alternative ordered index |
| P1 | Trie / Radix Tree | Prefix-based index |
| P1 | Cuckoo Hashing | Alternative hash table |
| P1 | Linear Hashing | Dynamic hash table |
| P1 | Bloom Filter | Configurable false positive rate |
| P1 | Cuckoo Filter | Alternative probabilistic filter |
| P1 | Grace Hash Join | Disk-spilling partitioned hash join |
| P1 | B+Tree Optimizations | Prefix compression, deduplication, suffix truncation, pointer swizzling, bulk insert |
| P1 | Sort Optimizations | Double buffering, suffix truncation, key normalization |
| P2 | B-epsilon Tree | Write-optimized B+Tree variant |
| P2 | Inverted Index | Full-text search |
| P2 | Chained Hashing | Dynamic hash table variant |

**Exit Criteria:** Can run multi-table joins, switch between join algorithms at runtime, observe join cost differences in metrics, create and use indexes.

### Phase 3: Query Processing and Optimization (Months 7-10)

**Goal:** The system has a real query optimizer that selects access methods, join algorithms, and join ordering. Users can compare optimizer strategies.

**Deliverables:**

| Priority | Component | Description |
|---|---|---|
| P0 | Logical Planner | Convert parsed SQL to relational algebra tree |
| P0 | Heuristic Optimizer | Predicate pushdown, projection pushdown, constant folding |
| P0 | Cost Model | I/O and CPU cost estimation |
| P0 | Statistics Collector | Table and column statistics, histograms |
| P0 | Physical Plan Generator | Select access methods and algorithms |
| P0 | EXPLAIN Command | LOGICAL, PHYSICAL, COST, ANALYZE variants |
| P0 | Materialization Model | Alternative processing model |
| P0 | Vectorized Model | Batch processing model |
| P1 | Cost-Based Optimizer | Bottom-up (System R) plan enumeration |
| P1 | Top-Down Optimizer | Volcano/Cascades-style |
| P1 | Join Ordering | Left-deep and bushy tree enumeration |
| P1 | Equi-Width Histograms | Basic histogram type |
| P1 | Equi-Depth Histograms | Improved histogram type |
| P1 | Sampling-Based Statistics | Alternative statistics approach |
| P1 | Zone Maps | Per-page min/max for scan optimization |
| P1 | Buffer Pool Bypass | Avoid pollution on sequential scans |
| P2 | Count-Min Sketch | Approximate frequency statistics |
| P2 | HyperLogLog | Approximate distinct count |
| P2 | Search Termination Strategies | Wall-clock, cost threshold, exhaustion |
| P2 | Multi-Index Scan | Combine results from multiple indexes |

**Exit Criteria:** `EXPLAIN ANALYZE` shows estimated vs actual costs. Users can switch between optimizer strategies and observe plan quality differences.

### Phase 4: Concurrency Control and MVCC (Months 10-14)

**Goal:** Full ACID transaction support with multiple concurrency control protocols. Users can observe and compare isolation anomalies.

**Deliverables:**

| Priority | Component | Description |
|---|---|---|
| P0 | Lock Manager | Shared/exclusive locks, lock table |
| P0 | Two-Phase Locking (SS2PL) | Strong strict 2PL |
| P0 | Deadlock Detection | Waits-for graph, cycle detection |
| P0 | Transaction Manager | BEGIN, COMMIT, ROLLBACK |
| P0 | Isolation Levels | All four standard levels |
| P0 | Index Concurrency | Latch crabbing for B+Tree |
| P1 | Basic 2PL | Non-strict variant (to demonstrate cascading aborts) |
| P1 | Deadlock Prevention | Wait-Die and Wound-Wait |
| P1 | Lock Granularity | Table, page, tuple levels |
| P1 | Intention Locks | IS, IX, SIX |
| P1 | Lock Escalation | Automatic escalation with threshold |
| P1 | Optimistic CC (OCC) | Three-phase validation |
| P1 | Timestamp Ordering | Basic T/O protocol |
| P1 | MVCC (Delta Storage) | Default version storage |
| P1 | Snapshot Isolation | Read snapshots, write conflict detection |
| P1 | Optimistic B+Tree Protocol | Alternative to latch crabbing |
| P2 | MVCC (Append-Only) | O2N and N2O variants |
| P2 | MVCC (Time-Travel) | Separate version table |
| P2 | Garbage Collection | Background, cooperative, transaction-level |
| P2 | Write Skew Detection | Serializable snapshot isolation |
| P2 | Phantom Protection | Index locking, rescan |
| P2 | Spin Latch | TAS-based latch |
| P2 | Hash Table Concurrency | Page, slot, and latch-free variants |

**Exit Criteria:** Concurrent transactions execute correctly under all isolation levels. Users can trigger and observe deadlocks, dirty reads, phantom reads, and write skew by switching protocols and isolation levels.

### Phase 5: Recovery (Months 14-17)

**Goal:** Crash recovery that correctly restores the database after simulated failures. Users can compare recovery approaches.

**Deliverables:**

| Priority | Component | Description |
|---|---|---|
| P0 | Write-Ahead Log | Sequential log writing, flushing |
| P0 | ARIES Recovery | Full Analysis/Redo/Undo |
| P0 | Fuzzy Checkpointing | Non-blocking checkpoints with ATT and DPT |
| P0 | Crash Simulation | `CALL db0_simulate_crash()` |
| P0 | Recovery Verification | Automatic consistency checks after recovery |
| P1 | Group Commit | Batched log flushing |
| P1 | Physiological Logging | Default logging scheme |
| P1 | Physical Logging | Byte-level logging alternative |
| P1 | Logical Logging | Operation-level logging alternative |
| P1 | Shadow Paging | Copy-on-write recovery approach |
| P1 | Journal File | SQLite-style journal recovery |
| P1 | Blocking Checkpoint | Simple checkpoint variant |
| P2 | STEAL/FORCE Combinations | All four buffer pool policy combinations |
| P2 | CLR (Compensation Log Records) | Correct undo during recovery |
| P2 | Non-Fuzzy Checkpoint | Intermediate checkpoint variant |

**Exit Criteria:** After a simulated crash, the system recovers to a consistent state. Users can observe the analysis/redo/undo phases in real-time via metrics. Switching between recovery approaches produces correct results.

### Phase 6: Distributed (Stretch, Months 17-22)

**Goal:** Basic distributed operation across simulated nodes. This phase is optional and focused on demonstrating distributed concepts rather than production-grade distribution.

**Deliverables:**

| Priority | Component | Description |
|---|---|---|
| P1 | Simulated Node Manager | Multiple "nodes" as threads with network-simulated latency |
| P1 | Hash Partitioning | Basic horizontal partitioning |
| P1 | Two-Phase Commit | Distributed atomic commit |
| P1 | Centralized Coordinator | Query routing through coordinator |
| P1 | Intra-Operator Parallelism | Parallel sequential scans |
| P2 | Range Partitioning | Alternative partitioning scheme |
| P2 | Consistent Hashing | Low-churn rebalancing |
| P2 | Rendezvous Hashing | Stable partition assignment |
| P2 | Decentralized Coordinator | Peer-to-peer query routing |
| P2 | Paxos/Raft Consensus | Alternative atomic commit |
| P2 | Inter-Operator Parallelism | Pipelined parallel execution |
| P2 | CP vs AP Mode | CAP trade-off demonstration |

**Exit Criteria:** Queries execute correctly across multiple simulated nodes. Users can observe data movement, commit protocol messages, and partition rebalancing via metrics.

---

## 10. Technical Decisions

### 10.1 Why Rust

| Reason | Elaboration |
|---|---|
| **Memory safety without GC** | A DBMS must manage its own memory (buffer pool). Rust's ownership model prevents use-after-free and data races without a garbage collector interfering with memory management. |
| **Zero-cost abstractions** | Trait objects and generics compile to efficient code. The configurable subsystem pattern (trait-based dispatch) incurs minimal overhead. |
| **Concurrency safety** | The `Send` and `Sync` traits make it a compile-time error to share data unsafely across threads. This is essential for a system with concurrent transactions, background writers, and shared buffer pools. |
| **Performance** | Close to C/C++ performance. Important because users will be comparing algorithm performance -- the language should not be the bottleneck. |
| **Ecosystem** | Strong crate ecosystem for I/O, serialization, hashing, and testing. |
| **Educational value** | Rust forces the developer to think about ownership, lifetimes, and concurrency -- the same concerns that dominate DBMS implementation. Learning Rust while building a DBMS is synergistic. |

### 10.2 Key Crates

| Crate | Purpose | Reason |
|---|---|---|
| `sqlparser` | SQL parsing | Production-grade SQL parser. Avoids building a parser from scratch (not the learning objective). |
| `tokio` | Async runtime | For network I/O (client connections), background tasks. Not for core query execution (which is synchronous). |
| `serde` + `toml` | Configuration | Deserialize TOML config files into typed Rust structs. |
| `xxhash-rust` | Hashing | XXHash3 implementation (state-of-the-art per course notes). |
| `crossbeam` | Concurrent data structures | Lock-free queues, epoch-based GC. Used for internal infrastructure, not the configurable data structures themselves. |
| `parking_lot` | Synchronization | Faster mutexes and RW locks than std. Used as the OS mutex latch implementation. |
| `criterion` | Benchmarking | Statistically rigorous microbenchmarks for individual subsystems. |
| `tracing` | Structured logging | Structured spans and events for query tracing. |
| `metrics` | Metrics collection | Lock-free metrics primitives (counters, gauges, histograms). |
| `proptest` | Property testing | Generate random configurations and verify correctness invariants. |
| `lz4_flex` / `snap` / `zstd` | Compression | Implementations of naive compression algorithms. |
| `axum` | Web dashboard | Lightweight web framework for the visualization dashboard. |

### 10.3 Testing Strategy

Testing is critical because database0 must produce correct results under every valid configuration combination. The testing strategy operates at multiple levels.

**Unit Tests:**

Every subsystem implementation has unit tests that verify its behavior in isolation. For example, each replacement policy is tested against a common test suite that verifies the basic eviction contract.

```rust
#[test_case(LruPolicy::new(4))]
#[test_case(ClockPolicy::new(4))]
#[test_case(LruKPolicy::new(4, 2))]
#[test_case(ArcPolicy::new(4))]
fn test_eviction_contract(mut policy: impl ReplacementPolicy) {
    // Fill all frames
    for i in 0..4 {
        policy.record_access(i, AccessType::Read);
    }
    // Evict should return a frame
    assert!(policy.evict().is_some());
    // Pinned frames should never be evicted
    policy.pin(0);
    for _ in 0..10 {
        assert_ne!(policy.evict(), Some(0));
    }
}
```

**Integration Tests:**

End-to-end SQL tests that run queries and verify results. Each test is parameterized over configuration options.

```rust
#[test_matrix(
    storage_model = ["nsm", "dsm", "pax"],
    join_algorithm = ["hash_basic", "sort_merge", "nested_loop_block"],
    processing_model = ["volcano", "materialization", "vectorized"]
)]
fn test_join_correctness(config: TestConfig) {
    let db = Database::new(config);
    db.execute("CREATE TABLE a (id INT, val INT)");
    db.execute("CREATE TABLE b (id INT, name VARCHAR(10))");
    // ... insert data ...
    let result = db.execute("SELECT a.val, b.name FROM a JOIN b ON a.id = b.id");
    assert_eq!(result, expected_result);
}
```

**Crash Recovery Tests:**

Simulate crashes at various points in transaction execution and verify that recovery produces a consistent state.

```rust
#[test_matrix(
    recovery_approach = ["wal", "shadow_paging", "journal"],
    buffer_policy = ["steal_no_force", "no_steal_force"],
    checkpoint = ["blocking", "fuzzy"]
)]
fn test_crash_recovery(config: TestConfig) {
    let db = Database::new(config);
    // Execute transactions
    // Simulate crash at random point
    // Restart and verify consistency
}
```

**Concurrency Tests:**

Use multiple threads to exercise concurrency control protocols and verify serializability.

```rust
#[test_matrix(
    protocol = ["2pl", "occ", "mvcc"],
    isolation = ["serializable", "repeatable_read"]
)]
fn test_concurrent_transactions(config: TestConfig) {
    let db = Database::new(config);
    // Run concurrent transactions that would conflict
    // Verify serializable outcome
}
```

**Property-Based Tests:**

Use `proptest` to generate random sequences of operations and verify invariants.

```rust
proptest! {
    fn btree_insert_delete_preserves_order(
        ops in vec(btree_op_strategy(), 0..1000)
    ) {
        let mut tree = BTree::new(config);
        let mut reference = BTreeMap::new();
        for op in ops {
            match op {
                Op::Insert(k, v) => { tree.insert(k, v); reference.insert(k, v); }
                Op::Delete(k) => { tree.delete(k); reference.remove(&k); }
            }
        }
        assert_eq!(tree.to_sorted_vec(), reference.into_iter().collect::<Vec<_>>());
    }
}
```

**Configuration Compatibility Matrix:**

A CI job that runs the full test suite across a sample of configuration combinations (exhaustive enumeration is infeasible given the configuration space). Uses a covering-array approach to select combinations that cover all pairwise interactions.

**Performance Regression Tests:**

Track key performance metrics (operations/sec for OLTP workload, query latency for OLAP queries) across commits to detect unintended regressions. These are not correctness tests -- they are observational and produce trend reports rather than pass/fail results.

### 10.4 Project Structure

```
database0/
  Cargo.toml
  database0.toml              # Default configuration
  src/
    main.rs                   # Entry point, CLI server
    config.rs                 # Configuration loading and validation
    catalog/                  # System catalog (tables, columns, indexes)
    storage/
      mod.rs                  # StorageEngine trait
      disk_manager.rs         # File I/O
      page.rs                 # Page layout (slotted, log-structured)
      heap.rs                 # Heap file organization
      nsm.rs                  # N-ary storage model
      dsm.rs                  # Decomposition storage model
      pax.rs                  # PAX hybrid model
      lsm/                    # Log-structured merge tree
        memtable.rs           # MemTable implementations
        sstable.rs            # SSTable format
        compaction.rs         # Compaction strategies
    buffer/
      mod.rs                  # BufferPool trait
      buffer_pool.rs          # Buffer pool manager
      replacement/
        lru.rs
        clock.rs
        lru_k.rs
        arc.rs
    compression/
      mod.rs                  # Compressor traits
      naive.rs                # LZ4, Snappy, Zstd
      columnar.rs             # RLE, bit-packing, delta, dictionary, bitmap
    index/
      mod.rs                  # Index trait
      btree/
        btree.rs              # B+Tree implementation
        node.rs               # Node layout
        optimizations.rs      # Prefix compression, etc.
        concurrency.rs        # Latch crabbing, optimistic
      hash/
        linear_probe.rs
        cuckoo.rs
        chained.rs
        extendible.rs
        linear_hashing.rs
      skip_list.rs
      trie.rs
      filter/
        bloom.rs
        cuckoo_filter.rs
      inverted.rs
    execution/
      mod.rs                  # Operator trait
      operators/
        scan.rs               # SeqScan, IndexScan
        filter.rs
        project.rs
        join.rs               # All join implementations
        sort.rs               # In-memory and external
        aggregate.rs          # Sort-based and hash-based
        insert.rs
        update.rs
        delete.rs
      models/
        volcano.rs
        materialization.rs
        vectorized.rs
    optimizer/
      mod.rs                  # QueryOptimizer trait
      logical_plan.rs
      physical_plan.rs
      heuristic.rs            # Rule-based optimizer
      cost_based.rs           # Cost-based optimizer
      system_r.rs             # Bottom-up enumeration
      volcano_optimizer.rs    # Top-down enumeration
      cost_model.rs
      statistics/
        histogram.rs
        sketch.rs
        sampling.rs
    concurrency/
      mod.rs                  # ConcurrencyControl trait
      lock_manager.rs
      two_phase_locking.rs
      timestamp_ordering.rs
      occ.rs
      mvcc/
        version_store.rs      # Append-only, time-travel, delta
        garbage_collection.rs
        snapshot.rs
    recovery/
      mod.rs                  # RecoveryManager trait
      wal.rs                  # Write-ahead log
      shadow_paging.rs
      journal.rs
      aries.rs                # ARIES recovery
      checkpoint.rs
    distributed/              # Stretch goal
      mod.rs
      partitioning.rs
      coordinator.rs
      two_phase_commit.rs
      consensus.rs            # Paxos, Raft
    sql/
      parser.rs               # SQL parsing (wraps sqlparser crate)
      binder.rs               # Name resolution
      planner.rs              # AST -> LogicalPlan
    telemetry/
      mod.rs                  # Metrics framework
      metrics.rs              # Counters, gauges, histograms
      tracing.rs              # Query tracing
      dashboard.rs            # Web dashboard
    client/
      mod.rs                  # TCP/Unix socket server
      protocol.rs             # Wire protocol
      cli.rs                  # Interactive client
    workloads/
      mod.rs                  # Workload generator framework
      oltp.rs                 # TPC-C-inspired
      olap.rs                 # TPC-H-inspired
      micro.rs                # Micro-benchmarks
      experiment.rs           # A/B comparison framework
  experiments/
    01_lru_vs_clock.sql
    02_sequential_flooding.sql
    ...
  tests/
    integration/
    concurrency/
    recovery/
    property/
```

### 10.5 Code Conventions

1. **Every module starts with a doc comment** linking to the relevant CMU 15-445 lecture.
2. **Every trait method has a doc comment** explaining its contract, preconditions, and postconditions.
3. **No function exceeds 50 lines.** If it does, extract a helper with a descriptive name.
4. **All magic numbers are named constants** with comments explaining their derivation.
5. **Unsafe code is isolated** in clearly marked modules with safety invariants documented.
6. **Error types are specific.** No `anyhow::Error` in core logic -- each subsystem defines its own error enum.
7. **Metrics instrumentation uses compile-time feature flags** so that benchmarks can disable it entirely.

---

## Appendix A: Configuration Option Count by Subsystem

| Subsystem | Options | Runtime | Session | Restart | Init-only |
|---|---|---|---|---|---|
| Storage Engine | 5 | 0 | 0 | 3 | 2 |
| LSM | 6 | 4 | 0 | 2 | 0 |
| Buffer Pool | 9 | 6 | 0 | 3 | 0 |
| Compression | 4 | 2 | 0 | 2 | 0 |
| Index Structures | 16 | 5 | 0 | 11 | 0 |
| Index Concurrency | 3 | 1 | 0 | 2 | 0 |
| Sorting & Aggregation | 8 | 8 | 0 | 0 | 0 |
| Join Algorithms | 4 | 4 | 0 | 0 | 0 |
| Query Processing | 4 | 4 | 0 | 0 | 0 |
| Query Optimization | 12 | 12 | 0 | 0 | 0 |
| Concurrency Control | 10 | 4 | 1 | 5 | 0 |
| MVCC | 6 | 3 | 0 | 3 | 0 |
| Recovery | 8 | 4 | 0 | 4 | 0 |
| Distributed | 6 | 1 | 0 | 5 | 0 |
| Telemetry | 5 | 5 | 0 | 0 | 0 |
| **Total** | **106** | **63** | **1** | **40** | **2** |

Note: Additional options within sub-sections (e.g., `btree.*`, `hash.*`) push the total beyond 120 when counting leaf-level settings individually.

## Appendix B: Lecture-to-Subsystem Mapping

| Lecture | Topic | Primary Subsystem | Configuration Options |
|---|---|---|---|
| 1 | Relational Model | SQL Interface | -- |
| 2 | Modern SQL | SQL Interface | -- |
| 3 | Database Storage I | Storage Engine | `page_layout`, `page_size`, `record_id_size` |
| 4 | Memory & Disk Mgmt | Buffer Pool | `replacement_policy`, `size`, `direct_io` |
| 5 | Database Storage II | Buffer Pool, LSM, Storage | `num_pools`, `prefetching`, `scan_sharing`, `memtable_structure`, `compaction_strategy` |
| 6 | Storage Models & Compression | Storage, Compression | `storage_model`, `algorithm`, `columnar_encoding`, `granularity` |
| 7 | Hash Tables | Index (Hash) | `hash_table_type`, `hash_function` |
| 8 | Indexes & Filters I | Index (B+Tree) | `btree.*` (all options) |
| 9 | Indexes & Filters II | Index (Filter, Skip List, Trie) | `primary_type`, `filter.type`, `filter.bloom_*` |
| 10 | Index Concurrency | Index Concurrency | `latch_type`, `btree_protocol`, `hash_latching` |
| 11 | Sorting & Aggregation | Sorting, Aggregation | `in_memory_sort`, `external_sort`, `aggregation.strategy` |
| 12 | Join Algorithms | Joins | `algorithm`, `output_mode`, `bloom_filter_optimization` |
| 13 | Query Processing I | Execution Engine | `processing_model`, `processing_direction`, `vector_size` |
| 14 | Query Execution II | Distributed | `process_model`, `intra_query_parallelism` |
| 15 | Query Optimization I | Optimizer | `type`, `plan_enumeration`, `predicate_pushdown`, `search_termination` |
| 16 | Query Optimization II | Optimizer | `statistics_type`, `histogram_type`, `join_ordering` |
| 17 | Concurrency Control Theory | Concurrency | `protocol` |
| 18 | Two-Phase Locking | Concurrency | `twopl_variant`, `deadlock_handling`, `lock_granularity`, `intention_locks` |
| 19 | Timestamp Ordering | Concurrency | `timestamp_allocation`, `isolation_level`, `phantom_protection` |
| 20 | MVCC | MVCC | `version_storage`, `garbage_collection`, `snapshot_isolation` |
| 21 | Database Logging | Recovery | `approach`, `buffer_policy`, `logging_scheme`, `group_commit` |
| 22 | Crash Recovery | Recovery | `checkpoint_strategy`, `aries_recovery` |
| 23 | Distributed DBs I | Distributed | `partitioning`, `coordinator` |
| 24 | Distributed DBs II | Distributed | `atomic_commit`, `cap_mode` |

## Appendix C: Enhancement Requests

These are proposed enhancements beyond the core educational feature set. Each is designed to deepen the learning experience or expand the system's utility.

### E-001: Time-Travel Debugging

**Description:** Allow users to step forward and backward through query execution, inspecting the state of every subsystem at each step. Like a debugger, but for the DBMS internals.

**User Value Hypothesis:** The single biggest barrier to understanding database internals is that everything happens too fast. Slowing execution to human speed and making state visible at each step would dramatically accelerate learning.

**Effort:** XL (4-6 weeks)
**Recommended Priority:** P2 (after core subsystems are stable)

### E-002: Configuration Recipes

**Description:** Pre-built configuration profiles that model real-world databases: "PostgreSQL-like" (NSM, B+Tree, 2PL, WAL), "RocksDB-like" (LSM, level compaction, skip list), "DuckDB-like" (DSM, vectorized, hash joins).

**User Value Hypothesis:** Helps users connect abstract options to real systems they have heard of. Provides good starting points for experimentation.

**Effort:** S (1-2 days per recipe)
**Recommended Priority:** P1

### E-003: Jupyter Notebook Integration

**Description:** A Python client library (`pydb0`) that connects to database0 and returns results as pandas DataFrames. Includes helper functions for running experiments and plotting results with matplotlib.

**User Value Hypothesis:** Many learners are comfortable in Jupyter. Plotting metric comparisons in Python is more flexible than built-in dashboards.

**Effort:** M (2-3 weeks)
**Recommended Priority:** P1

### E-004: Fault Injection Framework

**Description:** Beyond simple crash simulation, allow injection of specific faults: disk corruption, partial writes, network delays (distributed mode), thread stalls, memory pressure.

**User Value Hypothesis:** Understanding why recovery algorithms are complex requires experiencing the failures they protect against.

**Effort:** L (3-4 weeks)
**Recommended Priority:** P2

### E-005: Interactive Course Companion

**Description:** A mode where the system presents lecture content alongside interactive exercises. After reading about buffer pool replacement policies, the user runs an experiment that demonstrates the concept.

**User Value Hypothesis:** Tighter integration between theory and practice reduces the cognitive gap.

**Effort:** XL (6-8 weeks)
**Recommended Priority:** P3

### E-006: WASM Build for Browser

**Description:** Compile the core engine to WebAssembly so users can experiment in a browser without installing anything.

**User Value Hypothesis:** Eliminates installation friction. Could be embedded directly in course materials.

**Effort:** XL (6-8 weeks, significant I/O layer rearchitecting)
**Recommended Priority:** P3

---

*End of PRD*
