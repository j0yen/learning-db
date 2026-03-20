/**
 * Projection Pushdown: Push projections closer to the data source
 * to reduce the width of intermediate results.
 *
 * Analyzes which columns are needed by each operator and inserts
 * projections as early as possible.
 */

import type { LogicalPlan } from '../../sql/plan.js';
import type { Expr } from '../../sql/ast.js';

/** Collect all column references from an expression. */
function collectColumns(expr: Expr, cols: Set<string>): void {
  switch (expr.type) {
    case 'column_ref':
      cols.add(expr.table ? `${expr.table}.${expr.column}` : expr.column);
      break;
    case 'binary':
      collectColumns(expr.left, cols);
      collectColumns(expr.right, cols);
      break;
    case 'unary':
      collectColumns(expr.operand, cols);
      break;
    case 'star':
      cols.add('*');
      break;
    case 'between':
      collectColumns(expr.expr, cols);
      collectColumns(expr.low, cols);
      collectColumns(expr.high, cols);
      break;
    case 'in':
      collectColumns(expr.expr, cols);
      expr.values.forEach((v) => collectColumns(v, cols));
      break;
    case 'is_null':
      collectColumns(expr.expr, cols);
      break;
    case 'function':
      expr.args.forEach((a) => collectColumns(a, cols));
      break;
    case 'case':
      expr.whens.forEach((w) => {
        collectColumns(w.condition, cols);
        collectColumns(w.result, cols);
      });
      if (expr.elseResult) collectColumns(expr.elseResult, cols);
      break;
  }
}

/** Get all columns required by a plan node (not including its children). */
function getRequiredColumns(plan: LogicalPlan): Set<string> {
  const cols = new Set<string>();

  switch (plan.type) {
    case 'filter':
      collectColumns(plan.condition, cols);
      break;
    case 'project':
      for (const p of plan.expressions) {
        collectColumns(p.expr, cols);
      }
      break;
    case 'join':
      if (plan.condition) collectColumns(plan.condition, cols);
      break;
    case 'sort':
      for (const item of plan.orderBy) {
        collectColumns(item.expr, cols);
      }
      break;
    case 'aggregate':
      for (const g of plan.groupBy) collectColumns(g, cols);
      for (const a of plan.aggregates) collectColumns(a.expr, cols);
      break;
    case 'limit':
      break;
    case 'scan':
      break;
  }

  return cols;
}

/**
 * Apply projection pushdown.
 * This is a simplified version that tracks required columns and
 * avoids pushing projections through operators that need all columns.
 */
export function projectionPushdown(plan: LogicalPlan): LogicalPlan {
  // For now, apply a simple transformation: if a Project sits above
  // a Filter, ensure the filter's required columns are available.
  // Full projection pushdown requires column tracking through the entire tree.
  return plan; // TODO: Full implementation in a later iteration
}

/**
 * Get all columns referenced in a plan subtree.
 * Useful for analysis and debugging.
 */
export function getAllReferencedColumns(plan: LogicalPlan): Set<string> {
  const cols = getRequiredColumns(plan);

  switch (plan.type) {
    case 'filter':
    case 'project':
    case 'sort':
    case 'limit':
      for (const c of getAllReferencedColumns(plan.child)) cols.add(c);
      break;
    case 'aggregate':
      for (const c of getAllReferencedColumns(plan.child)) cols.add(c);
      break;
    case 'join':
      for (const c of getAllReferencedColumns(plan.left)) cols.add(c);
      for (const c of getAllReferencedColumns(plan.right)) cols.add(c);
      break;
  }

  return cols;
}
