/**
 * EXPLAIN: Produce a human-readable representation of a logical plan
 * with cost estimates.
 */

import type { LogicalPlan } from '../sql/plan.js';
import type { CostModel, PlanCost } from './cost/cost-model.js';
import type { Expr } from '../sql/ast.js';

export interface ExplainNode {
  operator: string;
  details: string;
  cost?: PlanCost;
  children: ExplainNode[];
}

export function explainPlan(plan: LogicalPlan, costModel?: CostModel): ExplainNode {
  const cost = costModel?.estimateCost(plan);
  return buildExplainNode(plan, costModel);
}

function buildExplainNode(plan: LogicalPlan, costModel?: CostModel): ExplainNode {
  const cost = costModel?.estimateCost(plan);

  switch (plan.type) {
    case 'scan':
      return {
        operator: 'SeqScan',
        details: `table=${plan.table}${plan.alias ? ` as ${plan.alias}` : ''}`,
        cost,
        children: [],
      };

    case 'filter':
      return {
        operator: 'Filter',
        details: `condition=${exprToString(plan.condition)}`,
        cost,
        children: [buildExplainNode(plan.child, costModel)],
      };

    case 'project':
      return {
        operator: 'Project',
        details: `cols=[${plan.expressions.map((e) => e.alias ?? exprToString(e.expr)).join(', ')}]`,
        cost,
        children: [buildExplainNode(plan.child, costModel)],
      };

    case 'join':
      return {
        operator: `${plan.joinType} Join`,
        details: plan.condition ? `on=${exprToString(plan.condition)}` : 'cross',
        cost,
        children: [
          buildExplainNode(plan.left, costModel),
          buildExplainNode(plan.right, costModel),
        ],
      };

    case 'sort':
      return {
        operator: 'Sort',
        details: `by=[${plan.orderBy.map((o) => `${exprToString(o.expr)} ${o.direction}`).join(', ')}]`,
        cost,
        children: [buildExplainNode(plan.child, costModel)],
      };

    case 'aggregate':
      return {
        operator: 'HashAggregate',
        details: `groupBy=[${plan.groupBy.map(exprToString).join(', ')}]`,
        cost,
        children: [buildExplainNode(plan.child, costModel)],
      };

    case 'limit': {
      const limitVal = plan.count.type === 'literal' ? String(plan.count.value) : '?';
      return {
        operator: 'Limit',
        details: `count=${limitVal}`,
        cost,
        children: [buildExplainNode(plan.child, costModel)],
      };
    }

    case 'insert':
      return {
        operator: 'Insert',
        details: `table=${plan.table}, rows=${plan.values.length}`,
        cost,
        children: [],
      };

    case 'update':
      return {
        operator: 'Update',
        details: `table=${plan.table}`,
        cost,
        children: [],
      };

    case 'delete':
      return {
        operator: 'Delete',
        details: `table=${plan.table}`,
        cost,
        children: [],
      };
  }
}

/** Convert an expression to a readable string. */
export function exprToString(expr: Expr): string {
  switch (expr.type) {
    case 'literal':
      if (expr.value === null) return 'NULL';
      if (typeof expr.value === 'string') return `'${expr.value}'`;
      return String(expr.value);
    case 'column_ref':
      return expr.table ? `${expr.table}.${expr.column}` : expr.column;
    case 'star':
      return expr.table ? `${expr.table}.*` : '*';
    case 'binary':
      return `(${exprToString(expr.left)} ${expr.op} ${exprToString(expr.right)})`;
    case 'unary':
      return `${expr.op} ${exprToString(expr.operand)}`;
    case 'function':
      return `${expr.name}(${expr.args.map(exprToString).join(', ')})`;
    case 'between':
      return `${exprToString(expr.expr)} ${expr.negated ? 'NOT ' : ''}BETWEEN ${exprToString(expr.low)} AND ${exprToString(expr.high)}`;
    case 'in':
      return `${exprToString(expr.expr)} ${expr.negated ? 'NOT ' : ''}IN (${expr.values.map(exprToString).join(', ')})`;
    case 'is_null':
      return `${exprToString(expr.expr)} IS ${expr.negated ? 'NOT ' : ''}NULL`;
    case 'case':
      return 'CASE ...';
  }
}

/** Format an explain tree as a string (like PostgreSQL EXPLAIN). */
export function formatExplain(node: ExplainNode, indent: number = 0): string {
  const prefix = '  '.repeat(indent);
  const costStr = node.cost
    ? ` (cost=${node.cost.total.toFixed(1)} rows=${node.cost.cardinality})`
    : '';
  let result = `${prefix}${node.operator}: ${node.details}${costStr}\n`;
  for (const child of node.children) {
    result += formatExplain(child, indent + 1);
  }
  return result;
}
