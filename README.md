# learning-db / database0

An educational, configurable Database Management System built from scratch as
a companion to **CMU 15-445/645: Introduction to Database Systems**. Every
major subsystem — storage, buffer pool, indexes, joins, optimizer,
concurrency control — is a swappable implementation behind a trait/interface,
so the same workload can be run under different configurations side by side.

This is a *learning sandbox*, not a production database. Where a 10× faster
implementation exists but is harder to read, the codebase chooses the readable
one and documents the production alternative.

## Why it exists

CMU 15-445 teaches dozens of algorithms — buffer replacement policies, join
algorithms, concurrency-control protocols, recovery mechanisms — but learners
have no easy way to *see* those choices play out in a real, running system.
Production databases bury their internals under abstractions and compile-time
choices. `database0` makes every choice configurable and instrumented, so an
A/B comparison between (for example) LRU and Clock replacement is a `SET`
statement and a re-run.

See [`docs/PRD-database0-DBMS.md`](docs/PRD-database0-DBMS.md) for the full
product brief.

## Status

Early implementation. The engine package already covers a substantive slice
of the layers; CLI and web packages are scaffolding.

| Subsystem            | Implementations available                                  |
| -------------------- | ---------------------------------------------------------- |
| Storage              | slotted-page, heap files, tuple serializer, memory disk    |
| Buffer pool          | LRU, Clock, LRU-K replacers                                |
| Indexes              | B+ tree, chained / linear-probe / extendible hashing, skip list, bloom filter |
| SQL frontend         | lexer, parser, AST, logical planner                        |
| Optimizer            | predicate pushdown, join reorder, System R, Volcano, cost model, EXPLAIN |
| Execution            | seq scan, filter, project, sort, hash aggregate, limit; NL / hash / sort-merge joins |
| Processing models    | iterator, materialization, vectorized                      |
| Concurrency          | lock manager, deadlock detector, MVCC, isolation simulator |
| Recovery             | — *(planned: WAL, ARIES, checkpointing)*                   |

## Repository layout

```
.
├── packages/
│   ├── engine/     # the DBMS itself (TypeScript library + vitest unit tests)
│   ├── cli/        # `database0` CLI (scaffold)
│   └── web/        # web visualizer for plans / buffer state (scaffold)
├── docs/
│   ├── PRD-database0-DBMS.md            # the product brief
│   ├── Intro-to-Database-Systems-CMU.md # CMU 15-445 (Fall 2025) lecture notes
│   └── Data-engineering.md              # DeepLearning.AI DE certificate notes
└── pnpm-workspace.yaml
```

## Stack

- **TypeScript** (ES2022, strict mode, `verbatimModuleSyntax`)
- **pnpm workspaces** (`packages/*`)
- **Node ≥ 20**
- **vitest** for unit tests, **vite** for the web visualizer
- No runtime dependencies in the engine itself — the point is to read the code

## Build / test

```sh
pnpm install
pnpm -r build
pnpm -r test
pnpm --filter @database0/web dev   # web visualizer
```

The engine package ships with vitest suites alongside each module
(`*.test.ts` next to `*.ts`).

## How to learn from it

Every subsystem is keyed to a CMU 15-445 lecture in the inline comments and
in [`docs/PRD-database0-DBMS.md`](docs/PRD-database0-DBMS.md) §5. A typical
learning loop:

1. Read the relevant lecture notes in
   [`docs/Intro-to-Database-Systems-CMU.md`](docs/Intro-to-Database-Systems-CMU.md).
2. Open the corresponding file in `packages/engine/src/` — they are intended
   to be read top-to-bottom.
3. Run the unit tests for that module.
4. Swap the configured implementation (e.g. LRU → Clock) and re-run a
   benchmark workload. Compare hit rate, evictions, latency.

## Non-goals

- Production use, SQL:2023 compliance, JDBC/ODBC drivers, wire-protocol
  compatibility, horizontal scalability, raw throughput.

See [`docs/PRD-database0-DBMS.md`](docs/PRD-database0-DBMS.md) §2 for the
full goals / non-goals list.

## License

TBD.
