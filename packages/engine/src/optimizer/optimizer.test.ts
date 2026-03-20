import { describe, it, expect } from 'vitest';
import { Optimizer } from './optimizer.js';
import { CostModel } from './cost/cost-model.js';
import { predicatePushdown } from './rules/predicate-pushdown.js';
import { joinReorder } from './rules/join-reorder.js';
import { systemROptimize } from './system-r.js';
import { VolcanoOptimizer } from './volcano-optimizer.js';
import { explainPlan, formatExplain } from './explain.js';
import { Parser } from '../sql/parser.js';
import { Planner } from '../sql/planner.js';
import { Catalog } from '../catalog/catalog.js';
import { ConfigRegistry } from '../config/config-registry.js';
import { MemoryDiskManager } from '../storage/disk-manager.js';
import { HeapFile } from '../storage/heap-file.js';
import { Executor } from '../execution/executor.js';
import { DataType, OptimizerType } from '../types.js';
import type { Schema, LogicalPlan } from '../index.js';

const usersSchema: Schema = {
  columns: [
    { name: 'id', type: DataType.INTEGER, nullable: false },
    { name: 'name', type: DataType.VARCHAR, maxLength: 100, nullable: false },
  ],
};

const ordersSchema: Schema = {
  columns: [
    { name: 'oid', type: DataType.INTEGER, nullable: false },
    { name: 'uid', type: DataType.INTEGER, nullable: false },
    { name: 'amount', type: DataType.FLOAT, nullable: false },
  ],
};

function setupDB() {
  const dm = new MemoryDiskManager(4096);
  const catalog = new Catalog();
  const config = new ConfigRegistry();
  const parser = new Parser();
  const planner = new Planner(catalog);
  const executor = new Executor(catalog);
  const optimizer = new Optimizer(config, catalog);

  const usersHF = new HeapFile(dm, usersSchema, 0);
  catalog.registerTable('users', usersSchema, usersHF);
  for (let i = 0; i < 100; i++) usersHF.insertTuple([i, `user_${i}`]);

  const ordersHF = new HeapFile(dm, ordersSchema, 1);
  catalog.registerTable('orders', ordersSchema, ordersHF);
  for (let i = 0; i < 500; i++) ordersHF.insertTuple([i, i % 100, (i + 1) * 10.0]);

  function plan(sql: string) {
    const stmt = parser.parse(sql);
    return planner.plan(stmt);
  }

  function run(sql: string) {
    const p = plan(sql);
    const optimized = optimizer.optimize(p);
    return executor.execute(optimized);
  }

  return { catalog, config, parser, planner, executor, optimizer, plan, run };
}

describe('Predicate Pushdown', () => {
  it('should push filter below join', () => {
    const { plan } = setupDB();
    const p = plan('SELECT * FROM users JOIN orders ON users.id = orders.uid WHERE users.name = \'alice\'');

    const optimized = predicatePushdown(p);

    // The filter on users.name should be pushed below the join, onto the users scan
    // Walk the tree to verify
    function findFilterOnScan(node: LogicalPlan): boolean {
      if (node.type === 'join') {
        // Left or right child should have a filter on 'name'
        return hasFilterOnColumn(node.left, 'name') || hasFilterOnColumn(node.right, 'name');
      }
      if ('child' in node) return findFilterOnScan(node.child as LogicalPlan);
      return false;
    }

    function hasFilterOnColumn(node: LogicalPlan, col: string): boolean {
      if (node.type === 'filter') {
        const cond = JSON.stringify(node.condition);
        return cond.includes(col);
      }
      return false;
    }

    expect(findFilterOnScan(optimized)).toBe(true);
  });

  it('should push filter below project', () => {
    const { plan } = setupDB();
    const p = plan('SELECT name FROM users WHERE id > 50');

    const optimized = predicatePushdown(p);

    // Filter should be below project
    expect(optimized.type).toBe('project');
    if (optimized.type === 'project') {
      expect(optimized.child.type).toBe('filter');
    }
  });
});

describe('Join Reorder', () => {
  it('should put smaller table on the left for inner join', () => {
    const { plan, catalog } = setupDB();
    const p = plan('SELECT * FROM orders JOIN users ON orders.uid = users.id');

    const optimized = joinReorder(p, catalog);

    // users has 100 rows, orders has 500 — users should be on left
    if (optimized.type === 'join') {
      function getTableName(node: LogicalPlan): string | null {
        if (node.type === 'scan') return node.table;
        if (node.type === 'filter' && 'child' in node) return getTableName(node.child);
        return null;
      }
      expect(getTableName(optimized.left)).toBe('users');
    }
  });
});

describe('Cost Model', () => {
  it('should estimate scan cost', () => {
    const { catalog, plan } = setupDB();
    const costModel = new CostModel(catalog);
    const p = plan('SELECT * FROM users');

    const cost = costModel.estimateCost(p);
    expect(cost.cardinality).toBe(100);
    expect(cost.io).toBeGreaterThan(0);
    expect(cost.total).toBeGreaterThan(0);
  });

  it('should estimate filter cost lower than scan', () => {
    const { catalog, plan } = setupDB();
    const costModel = new CostModel(catalog);

    const scanPlan = plan('SELECT * FROM users');
    const filterPlan = plan('SELECT * FROM users WHERE id = 1');

    const scanCost = costModel.estimateCost(scanPlan);
    const filterCost = costModel.estimateCost(filterPlan);

    expect(filterCost.cardinality).toBeLessThan(scanCost.cardinality);
  });

  it('should estimate join cost', () => {
    const { catalog, plan } = setupDB();
    const costModel = new CostModel(catalog);
    const p = plan('SELECT * FROM users JOIN orders ON users.id = orders.uid');

    const cost = costModel.estimateCost(p);
    expect(cost.cardinality).toBeGreaterThan(0);
    expect(cost.io).toBeGreaterThan(0);
  });
});

describe('System R Optimizer', () => {
  it('should optimize join ordering', () => {
    const { catalog, plan } = setupDB();
    const costModel = new CostModel(catalog);
    const p = plan('SELECT * FROM orders JOIN users ON orders.uid = users.id');

    const optimized = systemROptimize(p, costModel);
    expect(optimized).toBeDefined();
    // Should still produce the same type of plan
    expect(optimized.type).toBe('join');
  });
});

describe('Volcano Optimizer', () => {
  it('should optimize a plan', () => {
    const { catalog, plan } = setupDB();
    const costModel = new CostModel(catalog);
    const volcanoOpt = new VolcanoOptimizer(costModel);

    const p = plan('SELECT * FROM users WHERE id > 50');
    const optimized = volcanoOpt.optimize(p);

    expect(optimized).toBeDefined();
  });
});

describe('EXPLAIN', () => {
  it('should produce explain output', () => {
    const { catalog, plan } = setupDB();
    const costModel = new CostModel(catalog);
    const p = plan('SELECT * FROM users WHERE id > 50');

    const explain = explainPlan(p, costModel);
    expect(explain.operator).toBeDefined();
    expect(explain.cost).toBeDefined();
  });

  it('should format explain as string', () => {
    const { catalog, plan } = setupDB();
    const costModel = new CostModel(catalog);
    const p = plan('SELECT name FROM users WHERE id > 50 ORDER BY name LIMIT 10');

    const explain = explainPlan(p, costModel);
    const formatted = formatExplain(explain);

    expect(formatted).toContain('Limit');
    expect(formatted).toContain('Sort');
    expect(formatted).toContain('Filter');
    expect(formatted).toContain('SeqScan');
    expect(formatted).toContain('rows=');
  });

  it('should explain join queries', () => {
    const { catalog, plan } = setupDB();
    const costModel = new CostModel(catalog);
    const p = plan('SELECT * FROM users JOIN orders ON users.id = orders.uid');

    const explain = explainPlan(p, costModel);
    const formatted = formatExplain(explain);
    expect(formatted).toContain('Join');
  });
});

describe('Optimizer facade', () => {
  it('should apply heuristic optimization by default', () => {
    const { run } = setupDB();
    const result = run('SELECT * FROM users WHERE id < 10');
    expect(result.rowCount).toBe(10);
  });

  it('should work with System R optimizer', () => {
    const { config, run } = setupDB();
    config.set('optimizerType', OptimizerType.SYSTEM_R);
    const result = run('SELECT * FROM users JOIN orders ON users.id = orders.uid');
    expect(result.rowCount).toBeGreaterThan(0);
  });

  it('should work with Volcano optimizer', () => {
    const { config, run } = setupDB();
    config.set('optimizerType', OptimizerType.VOLCANO);
    const result = run('SELECT * FROM users WHERE id > 90');
    expect(result.rowCount).toBe(9);
  });

  it('should produce correct results regardless of optimizer', () => {
    const { config, run } = setupDB();
    const sql = 'SELECT * FROM users WHERE id < 5';

    config.set('optimizerType', OptimizerType.HEURISTIC);
    const r1 = run(sql);

    config.set('optimizerType', OptimizerType.SYSTEM_R);
    const r2 = run(sql);

    config.set('optimizerType', OptimizerType.VOLCANO);
    const r3 = run(sql);

    expect(r1.rowCount).toBe(r2.rowCount);
    expect(r2.rowCount).toBe(r3.rowCount);
    expect(r1.rowCount).toBe(5);
  });
});
