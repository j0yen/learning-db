/**
 * Planner: Converts SQL AST into a logical plan tree.
 * Resolves table/column references via the Catalog.
 */

import type { Catalog } from '../catalog/catalog.js';
import type {
  Statement, SelectStatement, InsertStatement, UpdateStatement,
  DeleteStatement, FromClause, Expr, SelectItem,
} from './ast.js';
import type {
  LogicalPlan, ScanNode, FilterNode, ProjectNode, JoinNode,
  SortNode, AggregateNode, LimitNode,
} from './plan.js';

export class Planner {
  constructor(private catalog: Catalog) {}

  plan(stmt: Statement): LogicalPlan {
    switch (stmt.type) {
      case 'select': return this.planSelect(stmt);
      case 'insert': return this.planInsert(stmt);
      case 'update': return this.planUpdate(stmt);
      case 'delete': return this.planDelete(stmt);
      default:
        throw new Error(`Cannot plan statement type: ${(stmt as Statement).type}`);
    }
  }

  // ─── SELECT ───────────────────────────────────────────────────────────

  private planSelect(stmt: SelectStatement): LogicalPlan {
    // 1. FROM clause → Scan / Join
    let plan: LogicalPlan | undefined;
    if (stmt.from) {
      plan = this.planFrom(stmt.from);
    }

    if (!plan) {
      throw new Error('SELECT without FROM is not supported');
    }

    // 2. WHERE → Filter
    if (stmt.where) {
      plan = { type: 'filter', condition: stmt.where, child: plan } satisfies FilterNode;
    }

    // 3. GROUP BY + aggregates → Aggregate
    const hasAggregates = this.containsAggregates(stmt.columns);
    if (stmt.groupBy || hasAggregates) {
      const aggPlan: AggregateNode = {
        type: 'aggregate',
        groupBy: stmt.groupBy ?? [],
        aggregates: stmt.columns.map((c) => ({ expr: c.expr, alias: c.alias })),
        child: plan,
      };
      plan = aggPlan;

      // 4. HAVING → Filter on aggregated
      if (stmt.having) {
        plan = { type: 'filter', condition: stmt.having, child: plan } satisfies FilterNode;
      }
    } else {
      // 5. Project (non-aggregate SELECT)
      const isStar = stmt.columns.length === 1 && stmt.columns[0].expr.type === 'star' && !stmt.columns[0].alias;
      if (!isStar) {
        plan = {
          type: 'project',
          expressions: stmt.columns.map((c) => ({ expr: c.expr, alias: c.alias })),
          child: plan,
        } satisfies ProjectNode;
      }
    }

    // 6. ORDER BY → Sort
    if (stmt.orderBy) {
      plan = { type: 'sort', orderBy: stmt.orderBy, child: plan } satisfies SortNode;
    }

    // 7. LIMIT / OFFSET → Limit
    if (stmt.limit) {
      plan = {
        type: 'limit',
        count: stmt.limit,
        offset: stmt.offset,
        child: plan,
      } satisfies LimitNode;
    }

    return plan;
  }

  // ─── FROM ─────────────────────────────────────────────────────────────

  private planFrom(from: FromClause): LogicalPlan {
    if (from.type === 'table') {
      const tableInfo = this.catalog.getTable(from.name);
      if (!tableInfo) {
        throw new Error(`Table '${from.name}' not found`);
      }
      return {
        type: 'scan',
        table: from.name,
        alias: from.alias,
        schema: tableInfo.schema,
      } satisfies ScanNode;
    }

    if (from.type === 'join') {
      const left = this.planFrom(from.left);
      const right = this.planFrom(from.right);
      return {
        type: 'join',
        joinType: from.joinType,
        condition: from.condition,
        left,
        right,
      } satisfies JoinNode;
    }

    throw new Error(`Unknown from clause type`);
  }

  // ─── INSERT ───────────────────────────────────────────────────────────

  private planInsert(stmt: InsertStatement): LogicalPlan {
    const tableInfo = this.catalog.getTable(stmt.table);
    if (!tableInfo) {
      throw new Error(`Table '${stmt.table}' not found`);
    }
    return {
      type: 'insert',
      table: stmt.table,
      columns: stmt.columns,
      values: stmt.values,
      schema: tableInfo.schema,
    };
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────

  private planUpdate(stmt: UpdateStatement): LogicalPlan {
    const tableInfo = this.catalog.getTable(stmt.table);
    if (!tableInfo) {
      throw new Error(`Table '${stmt.table}' not found`);
    }
    return {
      type: 'update',
      table: stmt.table,
      assignments: stmt.assignments,
      condition: stmt.where,
      schema: tableInfo.schema,
    };
  }

  // ─── DELETE ───────────────────────────────────────────────────────────

  private planDelete(stmt: DeleteStatement): LogicalPlan {
    const tableInfo = this.catalog.getTable(stmt.table);
    if (!tableInfo) {
      throw new Error(`Table '${stmt.table}' not found`);
    }
    return {
      type: 'delete',
      table: stmt.table,
      condition: stmt.where,
      schema: tableInfo.schema,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private containsAggregates(items: SelectItem[]): boolean {
    return items.some((item) => this.exprHasAggregate(item.expr));
  }

  private exprHasAggregate(expr: Expr): boolean {
    if (expr.type === 'function') {
      const name = expr.name.toUpperCase();
      return ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(name);
    }
    if (expr.type === 'binary') {
      return this.exprHasAggregate(expr.left) || this.exprHasAggregate(expr.right);
    }
    if (expr.type === 'unary') {
      return this.exprHasAggregate(expr.operand);
    }
    return false;
  }
}
