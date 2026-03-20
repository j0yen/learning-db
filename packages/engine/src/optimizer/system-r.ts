/**
 * System R Optimizer: Bottom-up dynamic programming for join ordering.
 *
 * Enumerates all subsets of relations to find the optimal left-deep join tree.
 * Uses the cost model for plan comparison.
 */

import type { LogicalPlan, JoinNode, ScanNode } from '../sql/plan.js';
import type { CostModel, PlanCost } from './cost/cost-model.js';
import type { Expr } from '../sql/ast.js';

interface DPEntry {
  plan: LogicalPlan;
  cost: PlanCost;
  tables: Set<string>;
}

/**
 * Extract all base relations (scans) and join predicates from a plan tree.
 */
function extractRelationsAndPredicates(plan: LogicalPlan): {
  relations: Map<string, ScanNode>;
  predicates: Array<{ expr: Expr; tables: Set<string> }>;
} {
  const relations = new Map<string, ScanNode>();
  const predicates: Array<{ expr: Expr; tables: Set<string> }> = [];

  function walk(node: LogicalPlan): void {
    if (node.type === 'scan') {
      const name = node.alias ?? node.table;
      relations.set(name, node);
    } else if (node.type === 'join') {
      walk(node.left);
      walk(node.right);
      if (node.condition) {
        predicates.push({
          expr: node.condition,
          tables: getExprTables(node.condition),
        });
      }
    } else if (node.type === 'filter') {
      walk(node.child);
      predicates.push({
        expr: node.condition,
        tables: getExprTables(node.condition),
      });
    }
  }

  walk(plan);
  return { relations, predicates };
}

function getExprTables(expr: Expr): Set<string> {
  const tables = new Set<string>();
  function collect(e: Expr): void {
    if (e.type === 'column_ref' && e.table) tables.add(e.table);
    if (e.type === 'binary') { collect(e.left); collect(e.right); }
    if (e.type === 'unary') collect(e.operand);
  }
  collect(expr);
  return tables;
}

function setKey(s: Set<string>): string {
  return [...s].sort().join(',');
}

function setsOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

function isSubset(sub: Set<string>, sup: Set<string>): boolean {
  for (const x of sub) if (!sup.has(x)) return false;
  return true;
}

/**
 * System R optimizer: find optimal join order using bottom-up DP.
 * Only optimizes the join portion of the plan; wraps with other operators.
 */
export function systemROptimize(plan: LogicalPlan, costModel: CostModel): LogicalPlan {
  // Only optimize if plan contains joins
  if (!containsJoin(plan)) return plan;

  // Extract the join core and the wrapper (project, sort, limit, etc.)
  const { wrapper, joinCore } = separateWrapperAndJoins(plan);
  if (!joinCore) return plan;

  const { relations, predicates } = extractRelationsAndPredicates(joinCore);
  const tableNames = [...relations.keys()];

  if (tableNames.length <= 1) return plan;
  if (tableNames.length > 12) return plan; // Too many relations for DP

  // DP table: subset of relations → best plan
  const dp = new Map<string, DPEntry>();

  // Base case: single relations
  for (const [name, scan] of relations) {
    const singleSet = new Set([name]);
    // Apply applicable single-table predicates
    let basePlan: LogicalPlan = scan;
    for (const pred of predicates) {
      if (pred.tables.size <= 1 && isSubset(pred.tables, singleSet)) {
        basePlan = { type: 'filter', condition: pred.expr, child: basePlan };
      }
    }
    const cost = costModel.estimateCost(basePlan);
    dp.set(setKey(singleSet), { plan: basePlan, cost, tables: singleSet });
  }

  // Build up: enumerate subsets of increasing size
  for (let size = 2; size <= tableNames.length; size++) {
    for (const subset of enumerateSubsets(tableNames, size)) {
      const subsetSet = new Set(subset);
      const key = setKey(subsetSet);
      let best: DPEntry | null = null;

      // Try all ways to split this subset into two non-empty parts
      for (const leftSubset of enumerateSubsets(subset, size - 1)) {
        const leftSet = new Set(leftSubset);
        const rightSet = new Set([...subsetSet].filter((x) => !leftSet.has(x)));

        if (rightSet.size === 0) continue;

        const leftKey = setKey(leftSet);
        const rightKey = setKey(rightSet);
        const leftEntry = dp.get(leftKey);
        const rightEntry = dp.get(rightKey);

        if (!leftEntry || !rightEntry) continue;

        // Find applicable join predicates
        const applicablePreds = predicates.filter(
          (p) => isSubset(p.tables, subsetSet) && setsOverlap(p.tables, leftSet) && setsOverlap(p.tables, rightSet),
        );

        let joinCondition: Expr | undefined;
        if (applicablePreds.length > 0) {
          joinCondition = applicablePreds.reduce<Expr>((acc, p) => ({
            type: 'binary',
            op: 'AND',
            left: acc,
            right: p.expr,
          }), applicablePreds[0].expr);
          // Fix: if only one predicate, use it directly
          if (applicablePreds.length === 1) {
            joinCondition = applicablePreds[0].expr;
          }
        }

        const joinPlan: LogicalPlan = {
          type: 'join',
          joinType: 'INNER',
          left: leftEntry.plan,
          right: rightEntry.plan,
          condition: joinCondition,
        };

        const cost = costModel.estimateCost(joinPlan);

        if (!best || cost.total < best.cost.total) {
          best = { plan: joinPlan, cost, tables: subsetSet };
        }
      }

      if (best) dp.set(key, best);
    }
  }

  // Get the optimal plan for all relations
  const fullKey = setKey(new Set(tableNames));
  const optimalEntry = dp.get(fullKey);
  if (!optimalEntry) return plan;

  // Reattach wrapper operators
  return wrapper(optimalEntry.plan);
}

function* enumerateSubsets(arr: string[], size: number): Generator<string[]> {
  if (size === 0) { yield []; return; }
  if (size > arr.length) return;

  for (let i = 0; i <= arr.length - size; i++) {
    for (const rest of enumerateSubsets(arr.slice(i + 1), size - 1)) {
      yield [arr[i], ...rest];
    }
  }
}

function containsJoin(plan: LogicalPlan): boolean {
  if (plan.type === 'join') return true;
  if ('child' in plan && plan.child) return containsJoin(plan.child as LogicalPlan);
  return false;
}

function separateWrapperAndJoins(plan: LogicalPlan): {
  wrapper: (joinPlan: LogicalPlan) => LogicalPlan;
  joinCore: LogicalPlan | null;
} {
  if (plan.type === 'join' || plan.type === 'scan') {
    return { wrapper: (p) => p, joinCore: plan };
  }

  if (plan.type === 'project' || plan.type === 'filter' || plan.type === 'sort' ||
    plan.type === 'aggregate' || plan.type === 'limit') {
    const { wrapper: innerWrapper, joinCore } = separateWrapperAndJoins(plan.child);
    return {
      wrapper: (p) => ({ ...plan, child: innerWrapper(p) } as LogicalPlan),
      joinCore,
    };
  }

  return { wrapper: (p) => p, joinCore: null };
}
