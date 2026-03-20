/**
 * Cost Model: Estimates the cost of executing a plan in terms of I/O and CPU.
 *
 * Uses TableStatistics for cardinality and selectivity estimation.
 */

import type { LogicalPlan } from '../../sql/plan.js';
import type { Catalog } from '../../catalog/catalog.js';
import type { TableStatistics } from '../../catalog/table-statistics.js';
import type { Expr } from '../../sql/ast.js';

export interface PlanCost {
  /** Number of disk page I/Os. */
  io: number;
  /** CPU cost (number of tuple comparisons / evaluations). */
  cpu: number;
  /** Total cost = io * IO_WEIGHT + cpu * CPU_WEIGHT. */
  total: number;
  /** Estimated output cardinality. */
  cardinality: number;
}

const IO_WEIGHT = 1.0;
const CPU_WEIGHT = 0.01;

export class CostModel {
  private stats: Map<string, TableStatistics>;

  constructor(
    private catalog: Catalog,
    stats?: Map<string, TableStatistics>,
  ) {
    this.stats = stats ?? new Map();
  }

  registerStats(tableName: string, stats: TableStatistics): void {
    this.stats.set(tableName, stats);
  }

  /** Estimate the cost of a logical plan. */
  estimateCost(plan: LogicalPlan): PlanCost {
    switch (plan.type) {
      case 'scan':
        return this.scanCost(plan);
      case 'filter':
        return this.filterCost(plan);
      case 'project':
        return this.projectCost(plan);
      case 'join':
        return this.joinCost(plan);
      case 'sort':
        return this.sortCost(plan);
      case 'aggregate':
        return this.aggregateCost(plan);
      case 'limit':
        return this.limitCost(plan);
      default:
        return { io: 0, cpu: 0, total: 0, cardinality: 0 };
    }
  }

  private scanCost(plan: LogicalPlan & { type: 'scan' }): PlanCost {
    const tableInfo = this.catalog.getTable(plan.table);
    const stats = this.stats.get(plan.table);

    let cardinality = 1000; // fallback
    if (stats) {
      cardinality = stats.getTupleCount();
    } else if (tableInfo) {
      cardinality = tableInfo.heapFile.estimateTupleCount() || 1;
    }

    // Assume ~100 tuples per page
    const pages = Math.max(1, Math.ceil(cardinality / 100));
    const io = pages;
    const cpu = cardinality;

    return this.makeCost(io, cpu, cardinality);
  }

  private filterCost(plan: LogicalPlan & { type: 'filter' }): PlanCost {
    const childCost = this.estimateCost(plan.child);
    const selectivity = this.estimateSelectivity(plan.condition);
    const cardinality = Math.max(1, Math.round(childCost.cardinality * selectivity));
    const cpu = childCost.cpu + childCost.cardinality; // evaluate predicate for each input row

    return this.makeCost(childCost.io, cpu, cardinality);
  }

  private projectCost(plan: LogicalPlan & { type: 'project' }): PlanCost {
    const childCost = this.estimateCost(plan.child);
    const cpu = childCost.cpu + childCost.cardinality; // evaluate expressions
    return this.makeCost(childCost.io, cpu, childCost.cardinality);
  }

  private joinCost(plan: LogicalPlan & { type: 'join' }): PlanCost {
    const leftCost = this.estimateCost(plan.left);
    const rightCost = this.estimateCost(plan.right);

    // Nested loop join cost: read left once, read right for each left row
    const io = leftCost.io + leftCost.cardinality * rightCost.io;
    const cpu = leftCost.cpu + rightCost.cpu + leftCost.cardinality * rightCost.cardinality;

    let cardinality: number;
    if (plan.condition) {
      const selectivity = this.estimateSelectivity(plan.condition);
      cardinality = Math.max(1, Math.round(leftCost.cardinality * rightCost.cardinality * selectivity));
    } else {
      cardinality = leftCost.cardinality * rightCost.cardinality;
    }

    return this.makeCost(io, cpu, cardinality);
  }

  private sortCost(plan: LogicalPlan & { type: 'sort' }): PlanCost {
    const childCost = this.estimateCost(plan.child);
    const n = childCost.cardinality;
    // Sort cost: O(n log n) comparisons
    const cpu = childCost.cpu + n * Math.ceil(Math.log2(Math.max(2, n)));
    return this.makeCost(childCost.io, cpu, childCost.cardinality);
  }

  private aggregateCost(plan: LogicalPlan & { type: 'aggregate' }): PlanCost {
    const childCost = this.estimateCost(plan.child);
    const cpu = childCost.cpu + childCost.cardinality; // hash and aggregate each row
    // Estimate output cardinality based on group-by
    const cardinality = plan.groupBy.length > 0
      ? Math.max(1, Math.ceil(childCost.cardinality * 0.1))
      : 1;
    return this.makeCost(childCost.io, cpu, cardinality);
  }

  private limitCost(plan: LogicalPlan & { type: 'limit' }): PlanCost {
    const childCost = this.estimateCost(plan.child);
    const limitVal = plan.count.type === 'literal' ? plan.count.value as number : childCost.cardinality;
    const cardinality = Math.min(limitVal, childCost.cardinality);
    return this.makeCost(childCost.io, childCost.cpu, cardinality);
  }

  /** Estimate selectivity of a predicate (0 to 1). */
  private estimateSelectivity(expr: Expr): number {
    switch (expr.type) {
      case 'binary': {
        if (expr.op === 'AND') {
          return this.estimateSelectivity(expr.left) * this.estimateSelectivity(expr.right);
        }
        if (expr.op === 'OR') {
          const sl = this.estimateSelectivity(expr.left);
          const sr = this.estimateSelectivity(expr.right);
          return sl + sr - sl * sr;
        }
        if (expr.op === '=') return 0.1;
        if (expr.op === '!=') return 0.9;
        if (['<', '>', '<=', '>='].includes(expr.op)) return 0.33;
        return 0.5;
      }
      case 'unary':
        if (expr.op === 'NOT') return 1 - this.estimateSelectivity(expr.operand);
        return 0.5;
      case 'between':
        return 0.25;
      case 'in':
        return Math.min(0.5, expr.values.length * 0.1);
      case 'is_null':
        return expr.negated ? 0.95 : 0.05;
      default:
        return 0.5;
    }
  }

  private makeCost(io: number, cpu: number, cardinality: number): PlanCost {
    return { io, cpu, total: io * IO_WEIGHT + cpu * CPU_WEIGHT, cardinality };
  }
}
