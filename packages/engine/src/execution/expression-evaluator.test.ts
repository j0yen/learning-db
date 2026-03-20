import { describe, it, expect } from 'vitest';
import { evaluate, buildRowContext } from './expression-evaluator.js';
import type { Expr } from '../sql/ast.js';

function ctx(obj: Record<string, any>) {
  return new Map(Object.entries(obj));
}

describe('ExpressionEvaluator', () => {
  it('should evaluate literals', () => {
    expect(evaluate({ type: 'literal', value: 42, dataType: 'number' }, new Map())).toBe(42);
    expect(evaluate({ type: 'literal', value: 'hi', dataType: 'string' }, new Map())).toBe('hi');
    expect(evaluate({ type: 'literal', value: true, dataType: 'boolean' }, new Map())).toBe(true);
    expect(evaluate({ type: 'literal', value: null, dataType: 'null' }, new Map())).toBe(null);
  });

  it('should evaluate column references', () => {
    expect(evaluate({ type: 'column_ref', column: 'x' }, ctx({ x: 10 }))).toBe(10);
    expect(evaluate({ type: 'column_ref', table: 't', column: 'x' }, ctx({ 't.x': 10 }))).toBe(10);
  });

  it('should evaluate arithmetic', () => {
    const expr: Expr = {
      type: 'binary', op: '+',
      left: { type: 'literal', value: 3, dataType: 'number' },
      right: { type: 'literal', value: 4, dataType: 'number' },
    };
    expect(evaluate(expr, new Map())).toBe(7);
  });

  it('should evaluate comparison', () => {
    const gt: Expr = {
      type: 'binary', op: '>',
      left: { type: 'column_ref', column: 'age' },
      right: { type: 'literal', value: 18, dataType: 'number' },
    };
    expect(evaluate(gt, ctx({ age: 25 }))).toBe(true);
    expect(evaluate(gt, ctx({ age: 15 }))).toBe(false);
  });

  it('should evaluate AND/OR with 3-valued logic', () => {
    const t: Expr = { type: 'literal', value: true, dataType: 'boolean' };
    const f: Expr = { type: 'literal', value: false, dataType: 'boolean' };
    const n: Expr = { type: 'literal', value: null, dataType: 'null' };

    // false AND null = false
    expect(evaluate({ type: 'binary', op: 'AND', left: f, right: n }, new Map())).toBe(false);
    // true AND null = null
    expect(evaluate({ type: 'binary', op: 'AND', left: t, right: n }, new Map())).toBe(null);
    // true OR null = true
    expect(evaluate({ type: 'binary', op: 'OR', left: t, right: n }, new Map())).toBe(true);
    // false OR null = null
    expect(evaluate({ type: 'binary', op: 'OR', left: f, right: n }, new Map())).toBe(null);
  });

  it('should evaluate NOT', () => {
    const expr: Expr = {
      type: 'unary', op: 'NOT',
      operand: { type: 'literal', value: true, dataType: 'boolean' },
    };
    expect(evaluate(expr, new Map())).toBe(false);
  });

  it('should evaluate unary minus', () => {
    const expr: Expr = {
      type: 'unary', op: '-',
      operand: { type: 'literal', value: 5, dataType: 'number' },
    };
    expect(evaluate(expr, new Map())).toBe(-5);
  });

  it('should evaluate LIKE', () => {
    const expr: Expr = {
      type: 'binary', op: 'LIKE',
      left: { type: 'column_ref', column: 'name' },
      right: { type: 'literal', value: '%ice', dataType: 'string' },
    };
    expect(evaluate(expr, ctx({ name: 'alice' }))).toBe(true);
    expect(evaluate(expr, ctx({ name: 'bob' }))).toBe(false);
  });

  it('should evaluate BETWEEN', () => {
    const expr: Expr = {
      type: 'between',
      expr: { type: 'column_ref', column: 'x' },
      low: { type: 'literal', value: 5, dataType: 'number' },
      high: { type: 'literal', value: 10, dataType: 'number' },
      negated: false,
    };
    expect(evaluate(expr, ctx({ x: 7 }))).toBe(true);
    expect(evaluate(expr, ctx({ x: 3 }))).toBe(false);
  });

  it('should evaluate IN', () => {
    const expr: Expr = {
      type: 'in',
      expr: { type: 'column_ref', column: 'x' },
      values: [
        { type: 'literal', value: 1, dataType: 'number' },
        { type: 'literal', value: 2, dataType: 'number' },
        { type: 'literal', value: 3, dataType: 'number' },
      ],
      negated: false,
    };
    expect(evaluate(expr, ctx({ x: 2 }))).toBe(true);
    expect(evaluate(expr, ctx({ x: 4 }))).toBe(false);
  });

  it('should evaluate IS NULL', () => {
    expect(evaluate(
      { type: 'is_null', expr: { type: 'column_ref', column: 'x' }, negated: false },
      ctx({ x: null }),
    )).toBe(true);
    expect(evaluate(
      { type: 'is_null', expr: { type: 'column_ref', column: 'x' }, negated: true },
      ctx({ x: null }),
    )).toBe(false);
  });

  it('should evaluate CASE', () => {
    const expr: Expr = {
      type: 'case',
      whens: [
        {
          condition: { type: 'binary', op: '>', left: { type: 'column_ref', column: 'x' }, right: { type: 'literal', value: 10, dataType: 'number' } },
          result: { type: 'literal', value: 'big', dataType: 'string' },
        },
      ],
      elseResult: { type: 'literal', value: 'small', dataType: 'string' },
    };
    expect(evaluate(expr, ctx({ x: 15 }))).toBe('big');
    expect(evaluate(expr, ctx({ x: 5 }))).toBe('small');
  });

  it('should propagate NULL in arithmetic', () => {
    const expr: Expr = {
      type: 'binary', op: '+',
      left: { type: 'literal', value: null, dataType: 'null' },
      right: { type: 'literal', value: 5, dataType: 'number' },
    };
    expect(evaluate(expr, new Map())).toBe(null);
  });

  it('should handle division by zero', () => {
    const expr: Expr = {
      type: 'binary', op: '/',
      left: { type: 'literal', value: 10, dataType: 'number' },
      right: { type: 'literal', value: 0, dataType: 'number' },
    };
    expect(evaluate(expr, new Map())).toBe(null);
  });

  it('should build row context', () => {
    const ctx = buildRowContext(
      [{ table: 'users', name: 'id' }, { table: 'users', name: 'name' }],
      [1, 'alice'],
    );
    expect(ctx.get('id')).toBe(1);
    expect(ctx.get('users.id')).toBe(1);
    expect(ctx.get('name')).toBe('alice');
  });

  it('should evaluate string concatenation', () => {
    const expr: Expr = {
      type: 'binary', op: '||',
      left: { type: 'literal', value: 'hello', dataType: 'string' },
      right: { type: 'literal', value: ' world', dataType: 'string' },
    };
    expect(evaluate(expr, new Map())).toBe('hello world');
  });
});
