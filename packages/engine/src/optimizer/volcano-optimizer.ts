/**
 * Volcano/Cascades-style Optimizer: Top-down memoization with rule application.
 *
 * Uses a memo table to avoid recomputing equivalent plan groups.
 * Applies transformation rules and picks the cheapest physical plan.
 */

import type { LogicalPlan } from '../sql/plan.js';
import type { CostModel, PlanCost } from './cost/cost-model.js';
import { predicatePushdown } from './rules/predicate-pushdown.js';

interface MemoEntry {
  plan: LogicalPlan;
  cost: PlanCost;
  optimized: boolean;
}

/**
 * Volcano-style top-down optimizer with memoization.
 *
 * Simplified version:
 * 1. Apply logical transformations (predicate pushdown)
 * 2. For each plan node, memoize the best cost
 * 3. Explore alternative physical operators (e.g., hash join vs NLJ)
 */
export class VolcanoOptimizer {
  private memo: Map<string, MemoEntry> = new Map();

  constructor(private costModel: CostModel) {}

  optimize(plan: LogicalPlan): LogicalPlan {
    this.memo.clear();

    // Phase 1: Apply logical transformations
    let optimized = predicatePushdown(plan);

    // Phase 2: Top-down optimization with memoization
    optimized = this.optimizeNode(optimized);

    return optimized;
  }

  private optimizeNode(plan: LogicalPlan): LogicalPlan {
    const key = this.planKey(plan);
    const cached = this.memo.get(key);
    if (cached?.optimized) return cached.plan;

    let bestPlan = plan;
    let bestCost = this.costModel.estimateCost(plan);

    // Generate alternatives for join nodes
    if (plan.type === 'join') {
      const alternatives = this.generateJoinAlternatives(plan);
      for (const alt of alternatives) {
        const altCost = this.costModel.estimateCost(alt);
        if (altCost.total < bestCost.total) {
          bestPlan = alt;
          bestCost = altCost;
        }
      }
    }

    // Recursively optimize children
    bestPlan = this.optimizeChildren(bestPlan);
    bestCost = this.costModel.estimateCost(bestPlan);

    this.memo.set(key, { plan: bestPlan, cost: bestCost, optimized: true });
    return bestPlan;
  }

  private optimizeChildren(plan: LogicalPlan): LogicalPlan {
    switch (plan.type) {
      case 'filter':
        return { ...plan, child: this.optimizeNode(plan.child) };
      case 'project':
        return { ...plan, child: this.optimizeNode(plan.child) };
      case 'sort':
        return { ...plan, child: this.optimizeNode(plan.child) };
      case 'aggregate':
        return { ...plan, child: this.optimizeNode(plan.child) };
      case 'limit':
        return { ...plan, child: this.optimizeNode(plan.child) };
      case 'join':
        return {
          ...plan,
          left: this.optimizeNode(plan.left),
          right: this.optimizeNode(plan.right),
        };
      default:
        return plan;
    }
  }

  private generateJoinAlternatives(plan: LogicalPlan & { type: 'join' }): LogicalPlan[] {
    const alternatives: LogicalPlan[] = [];

    // Alternative: swap join sides (commutativity)
    if (plan.joinType === 'INNER') {
      alternatives.push({
        ...plan,
        left: plan.right,
        right: plan.left,
      });
    }

    return alternatives;
  }

  private planKey(plan: LogicalPlan): string {
    // Simple structural key for memoization
    switch (plan.type) {
      case 'scan':
        return `scan:${plan.table}:${plan.alias ?? ''}`;
      case 'filter':
        return `filter:${JSON.stringify(plan.condition)}:${this.planKey(plan.child)}`;
      case 'project':
        return `project:${this.planKey(plan.child)}`;
      case 'join':
        return `join:${plan.joinType}:${this.planKey(plan.left)}:${this.planKey(plan.right)}`;
      case 'sort':
        return `sort:${this.planKey(plan.child)}`;
      case 'aggregate':
        return `agg:${this.planKey(plan.child)}`;
      case 'limit':
        return `limit:${this.planKey(plan.child)}`;
      default:
        return `other:${plan.type}`;
    }
  }
}
