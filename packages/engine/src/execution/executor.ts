/**
 * Executor: Builds an operator tree from a logical plan and executes it.
 */

import type { Catalog } from '../catalog/catalog.js';
import type { LogicalPlan } from '../sql/plan.js';
import type { Operator, Row } from './operators/operator.js';
import type { Value, Tuple } from '../types.js';
import { SeqScan } from './operators/seq-scan.js';
import { Filter } from './operators/filter.js';
import { Project } from './operators/project.js';
import { NestedLoopJoin } from './operators/nested-loop-join.js';
import { Sort } from './operators/sort.js';
import { HashAggregate } from './operators/hash-aggregate.js';
import { Limit } from './operators/limit.js';
import { evaluate, buildRowContext } from './expression-evaluator.js';

export interface ExecutionResult {
  rows: Value[][];
  columns: string[];
  rowCount: number;
}

export class Executor {
  constructor(private catalog: Catalog) {}

  execute(plan: LogicalPlan): ExecutionResult {
    switch (plan.type) {
      case 'insert': return this.executeInsert(plan);
      case 'update': return this.executeUpdate(plan);
      case 'delete': return this.executeDelete(plan);
      default: return this.executeQuery(plan);
    }
  }

  private executeQuery(plan: LogicalPlan): ExecutionResult {
    const operator = this.buildOperator(plan);
    operator.open();

    const rows: Value[][] = [];
    let row: Row | null;
    while ((row = operator.next())) {
      rows.push(row.values);
    }

    const columns = operator.getColumns().map((c) => c.name);
    operator.close();

    return { rows, columns, rowCount: rows.length };
  }

  private executeInsert(plan: LogicalPlan & { type: 'insert' }): ExecutionResult {
    const tableInfo = this.catalog.getTable(plan.table);
    if (!tableInfo) throw new Error(`Table '${plan.table}' not found`);

    let insertCount = 0;
    for (const valueExprs of plan.values) {
      const tuple: Tuple = valueExprs.map((expr) => evaluate(expr, new Map()));
      tableInfo.heapFile.insertTuple(tuple);
      insertCount++;
    }

    return { rows: [[insertCount]], columns: ['count'], rowCount: 1 };
  }

  private executeUpdate(plan: LogicalPlan & { type: 'update' }): ExecutionResult {
    const tableInfo = this.catalog.getTable(plan.table);
    if (!tableInfo) throw new Error(`Table '${plan.table}' not found`);

    const schema = tableInfo.schema;
    let updateCount = 0;
    const toUpdate: Array<{ rid: any; newTuple: Tuple }> = [];

    for (const [rid, tuple] of tableInfo.heapFile.scan()) {
      if (plan.condition) {
        const cols = schema.columns.map((c) => ({ name: c.name, table: plan.table }));
        const ctx = buildRowContext(cols, tuple);
        const match = evaluate(plan.condition, ctx);
        if (match !== true) continue;
      }

      const newTuple = [...tuple];
      for (const assignment of plan.assignments) {
        const colIdx = schema.columns.findIndex((c) => c.name === assignment.column);
        if (colIdx === -1) throw new Error(`Column '${assignment.column}' not found`);
        const cols = schema.columns.map((c) => ({ name: c.name, table: plan.table }));
        const ctx = buildRowContext(cols, tuple);
        newTuple[colIdx] = evaluate(assignment.value, ctx);
      }

      toUpdate.push({ rid, newTuple });
    }

    for (const { rid, newTuple } of toUpdate) {
      tableInfo.heapFile.updateTuple(rid, newTuple);
      updateCount++;
    }

    return { rows: [[updateCount]], columns: ['count'], rowCount: 1 };
  }

  private executeDelete(plan: LogicalPlan & { type: 'delete' }): ExecutionResult {
    const tableInfo = this.catalog.getTable(plan.table);
    if (!tableInfo) throw new Error(`Table '${plan.table}' not found`);

    const schema = tableInfo.schema;
    const toDelete: any[] = [];

    for (const [rid, tuple] of tableInfo.heapFile.scan()) {
      if (plan.condition) {
        const cols = schema.columns.map((c) => ({ name: c.name, table: plan.table }));
        const ctx = buildRowContext(cols, tuple);
        const match = evaluate(plan.condition, ctx);
        if (match !== true) continue;
      }
      toDelete.push(rid);
    }

    for (const rid of toDelete) {
      tableInfo.heapFile.deleteTuple(rid);
    }

    return { rows: [[toDelete.length]], columns: ['count'], rowCount: 1 };
  }

  buildOperator(plan: LogicalPlan): Operator {
    switch (plan.type) {
      case 'scan': {
        const tableInfo = this.catalog.getTable(plan.table);
        if (!tableInfo) throw new Error(`Table '${plan.table}' not found`);
        return new SeqScan(tableInfo.heapFile, plan.alias ?? plan.table);
      }

      case 'filter':
        return new Filter(this.buildOperator(plan.child), plan.condition);

      case 'project':
        return new Project(this.buildOperator(plan.child), plan.expressions);

      case 'join': {
        const left = this.buildOperator(plan.left);
        const right = this.buildOperator(plan.right);
        return new NestedLoopJoin(left, right, plan.condition, plan.joinType);
      }

      case 'sort':
        return new Sort(this.buildOperator(plan.child), plan.orderBy);

      case 'aggregate':
        return new HashAggregate(
          this.buildOperator(plan.child),
          plan.groupBy,
          plan.aggregates,
        );

      case 'limit': {
        const limitVal = plan.count.type === 'literal' ? plan.count.value as number : 10;
        const offsetVal = plan.offset?.type === 'literal' ? plan.offset.value as number : 0;
        return new Limit(this.buildOperator(plan.child), limitVal, offsetVal);
      }

      default:
        throw new Error(`Cannot build operator for plan type: ${(plan as LogicalPlan).type}`);
    }
  }
}
