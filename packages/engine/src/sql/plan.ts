/**
 * Logical Plan nodes for query processing.
 */

import type { Expr, OrderByItem } from './ast.js';
import type { Schema } from '../types.js';

export type LogicalPlan =
  | ScanNode
  | FilterNode
  | ProjectNode
  | JoinNode
  | SortNode
  | AggregateNode
  | LimitNode
  | InsertNode
  | UpdateNode
  | DeleteNode;

export interface ScanNode {
  type: 'scan';
  table: string;
  alias?: string;
  schema: Schema;
}

export interface FilterNode {
  type: 'filter';
  condition: Expr;
  child: LogicalPlan;
}

export interface ProjectNode {
  type: 'project';
  expressions: Array<{ expr: Expr; alias?: string }>;
  child: LogicalPlan;
}

export interface JoinNode {
  type: 'join';
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'CROSS';
  condition?: Expr;
  left: LogicalPlan;
  right: LogicalPlan;
}

export interface SortNode {
  type: 'sort';
  orderBy: OrderByItem[];
  child: LogicalPlan;
}

export interface AggregateNode {
  type: 'aggregate';
  groupBy: Expr[];
  aggregates: Array<{ expr: Expr; alias?: string }>;
  child: LogicalPlan;
}

export interface LimitNode {
  type: 'limit';
  count: Expr;
  offset?: Expr;
  child: LogicalPlan;
}

export interface InsertNode {
  type: 'insert';
  table: string;
  columns?: string[];
  values: Expr[][];
  schema: Schema;
}

export interface UpdateNode {
  type: 'update';
  table: string;
  assignments: Array<{ column: string; value: Expr }>;
  condition?: Expr;
  schema: Schema;
}

export interface DeleteNode {
  type: 'delete';
  table: string;
  condition?: Expr;
  schema: Schema;
}
