/**
 * Predicate Pushdown: Push filter predicates as close to the data source as possible.
 *
 * Transforms:
 *   Filter(condition, Join(A, B)) → Join(Filter(condA, A), Filter(condB, B))
 *   Filter(condition, Project(child))  → Project(Filter(condition, child))
 */

import type { LogicalPlan, FilterNode, JoinNode } from '../../sql/plan.js';
import type { Expr } from '../../sql/ast.js';

/** Extract all column references from an expression. */
function getReferencedTables(expr: Expr): Set<string> {
  const tables = new Set<string>();
  collectTables(expr, tables);
  return tables;
}

function collectTables(expr: Expr, tables: Set<string>): void {
  switch (expr.type) {
    case 'column_ref':
      if (expr.table) tables.add(expr.table);
      break;
    case 'binary':
      collectTables(expr.left, tables);
      collectTables(expr.right, tables);
      break;
    case 'unary':
      collectTables(expr.operand, tables);
      break;
    case 'between':
      collectTables(expr.expr, tables);
      collectTables(expr.low, tables);
      collectTables(expr.high, tables);
      break;
    case 'in':
      collectTables(expr.expr, tables);
      expr.values.forEach((v) => collectTables(v, tables));
      break;
    case 'is_null':
      collectTables(expr.expr, tables);
      break;
    case 'function':
      expr.args.forEach((a) => collectTables(a, tables));
      break;
    case 'case':
      expr.whens.forEach((w) => {
        collectTables(w.condition, tables);
        collectTables(w.result, tables);
      });
      if (expr.elseResult) collectTables(expr.elseResult, tables);
      break;
  }
}

/** Get all table aliases provided by a plan subtree. */
function getProvidedTables(plan: LogicalPlan): Set<string> {
  const tables = new Set<string>();
  collectProvidedTables(plan, tables);
  return tables;
}

function collectProvidedTables(plan: LogicalPlan, tables: Set<string>): void {
  switch (plan.type) {
    case 'scan':
      tables.add(plan.alias ?? plan.table);
      break;
    case 'join':
      collectProvidedTables(plan.left, tables);
      collectProvidedTables(plan.right, tables);
      break;
    case 'filter':
    case 'project':
    case 'sort':
    case 'limit':
      collectProvidedTables(plan.child, tables);
      break;
    case 'aggregate':
      collectProvidedTables(plan.child, tables);
      break;
  }
}

/** Split an AND-connected predicate into conjuncts. */
function splitConjuncts(expr: Expr): Expr[] {
  if (expr.type === 'binary' && expr.op === 'AND') {
    return [...splitConjuncts(expr.left), ...splitConjuncts(expr.right)];
  }
  return [expr];
}

/** Combine conjuncts back into an AND expression. */
function combineConjuncts(exprs: Expr[]): Expr | null {
  if (exprs.length === 0) return null;
  return exprs.reduce((acc, e) => ({
    type: 'binary' as const,
    op: 'AND' as const,
    left: acc,
    right: e,
  }));
}

/** Apply predicate pushdown to a logical plan. */
export function predicatePushdown(plan: LogicalPlan): LogicalPlan {
  return pushdownRecursive(plan);
}

function pushdownRecursive(plan: LogicalPlan): LogicalPlan {
  switch (plan.type) {
    case 'filter': {
      // First, recursively optimize the child
      const child = pushdownRecursive(plan.child);
      return pushFilterDown(plan.condition, child);
    }
    case 'join': {
      const left = pushdownRecursive(plan.left);
      const right = pushdownRecursive(plan.right);
      return { ...plan, left, right };
    }
    case 'project':
      return { ...plan, child: pushdownRecursive(plan.child) };
    case 'sort':
      return { ...plan, child: pushdownRecursive(plan.child) };
    case 'aggregate':
      return { ...plan, child: pushdownRecursive(plan.child) };
    case 'limit':
      return { ...plan, child: pushdownRecursive(plan.child) };
    default:
      return plan;
  }
}

function pushFilterDown(condition: Expr, child: LogicalPlan): LogicalPlan {
  const conjuncts = splitConjuncts(condition);

  if (child.type === 'join') {
    const leftTables = getProvidedTables(child.left);
    const rightTables = getProvidedTables(child.right);

    const leftPreds: Expr[] = [];
    const rightPreds: Expr[] = [];
    const joinPreds: Expr[] = [];
    const remaining: Expr[] = [];

    for (const pred of conjuncts) {
      const refs = getReferencedTables(pred);
      const refsLeft = [...refs].every((t) => leftTables.has(t));
      const refsRight = [...refs].every((t) => rightTables.has(t));

      if (refs.size === 0) {
        // Constant predicate — push to left arbitrarily
        leftPreds.push(pred);
      } else if (refsLeft && !refsRight) {
        leftPreds.push(pred);
      } else if (refsRight && !refsLeft) {
        rightPreds.push(pred);
      } else {
        // References both sides — becomes join condition or stays as filter
        joinPreds.push(pred);
      }
    }

    let left = child.left;
    let right = child.right;

    if (leftPreds.length > 0) {
      const cond = combineConjuncts(leftPreds)!;
      left = { type: 'filter', condition: cond, child: left };
    }
    if (rightPreds.length > 0) {
      const cond = combineConjuncts(rightPreds)!;
      right = { type: 'filter', condition: cond, child: right };
    }

    let newJoin: LogicalPlan = { ...child, left, right };

    // Merge join predicates into join condition
    if (joinPreds.length > 0) {
      const joinCond = child.condition
        ? combineConjuncts([child.condition, ...joinPreds])
        : combineConjuncts(joinPreds);
      newJoin = { ...child, left, right, condition: joinCond ?? undefined };
    }

    if (remaining.length > 0) {
      return { type: 'filter', condition: combineConjuncts(remaining)!, child: newJoin };
    }

    return newJoin;
  }

  if (child.type === 'project') {
    // Push filter below projection
    const newChild = pushFilterDown(condition, child.child);
    return { ...child, child: newChild };
  }

  // Can't push further — keep filter here
  return { type: 'filter', condition, child };
}
