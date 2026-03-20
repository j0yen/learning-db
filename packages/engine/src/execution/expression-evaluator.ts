/**
 * Expression Evaluator: Evaluates AST expressions against a tuple row.
 *
 * A "row context" maps column references (optionally qualified by table)
 * to values from one or more tuples.
 */

import type { Expr } from '../sql/ast.js';
import type { Value } from '../types.js';

/** Maps "table.column" or just "column" to a value. */
export type RowContext = Map<string, Value>;

/** Build a RowContext from a schema-like column list and tuple values. */
export function buildRowContext(
  columns: Array<{ table?: string; name: string }>,
  values: Value[],
): RowContext {
  const ctx: RowContext = new Map();
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    ctx.set(col.name, values[i]);
    if (col.table) {
      ctx.set(`${col.table}.${col.name}`, values[i]);
    }
  }
  return ctx;
}

/** Merge two row contexts (for joins). */
export function mergeContexts(a: RowContext, b: RowContext): RowContext {
  const merged = new Map(a);
  for (const [k, v] of b) {
    merged.set(k, v);
  }
  return merged;
}

/** Evaluate an expression given a row context. */
export function evaluate(expr: Expr, ctx: RowContext): Value {
  switch (expr.type) {
    case 'literal':
      return expr.value;

    case 'column_ref': {
      if (expr.table) {
        const key = `${expr.table}.${expr.column}`;
        if (ctx.has(key)) return ctx.get(key)!;
      }
      if (ctx.has(expr.column)) return ctx.get(expr.column)!;
      // Return null for unknown columns (could throw in strict mode)
      return null;
    }

    case 'star':
      return null; // Star shouldn't appear in evaluation context

    case 'unary':
      return evaluateUnary(expr.op, evaluate(expr.operand, ctx));

    case 'binary':
      return evaluateBinary(expr.op, evaluate(expr.left, ctx), evaluate(expr.right, ctx));

    case 'function':
      // Aggregates are handled by the aggregate operator, not here
      // But scalar functions could be evaluated directly
      return null;

    case 'is_null': {
      const val = evaluate(expr.expr, ctx);
      const isNull = val === null;
      return expr.negated ? !isNull : isNull;
    }

    case 'between': {
      const val = evaluate(expr.expr, ctx);
      const low = evaluate(expr.low, ctx);
      const high = evaluate(expr.high, ctx);
      if (val === null || low === null || high === null) return null;
      const inRange = val >= low && val <= high;
      return expr.negated ? !inRange : inRange;
    }

    case 'in': {
      const val = evaluate(expr.expr, ctx);
      if (val === null) return null;
      const values = expr.values.map((v) => evaluate(v, ctx));
      const found = values.some((v) => v === val);
      return expr.negated ? !found : found;
    }

    case 'case': {
      for (const w of expr.whens) {
        const cond = evaluate(w.condition, ctx);
        if (cond === true) return evaluate(w.result, ctx);
      }
      return expr.elseResult ? evaluate(expr.elseResult, ctx) : null;
    }
  }
}

function evaluateUnary(op: string, val: Value): Value {
  if (val === null) return null;
  switch (op) {
    case '-': return typeof val === 'number' ? -val : null;
    case 'NOT': return typeof val === 'boolean' ? !val : null;
    default: return null;
  }
}

function evaluateBinary(op: string, left: Value, right: Value): Value {
  // NULL propagation for most operators
  if (op !== 'AND' && op !== 'OR') {
    if (left === null || right === null) return null;
  }

  switch (op) {
    // Arithmetic
    case '+': return asNum(left)! + asNum(right)!;
    case '-': return asNum(left)! - asNum(right)!;
    case '*': return asNum(left)! * asNum(right)!;
    case '/': {
      const r = asNum(right)!;
      return r === 0 ? null : asNum(left)! / r;
    }
    case '%': {
      const r = asNum(right)!;
      return r === 0 ? null : asNum(left)! % r;
    }

    // Comparison
    case '=': return left === right;
    case '!=': return left !== right;
    case '<': return compare(left, right) < 0;
    case '>': return compare(left, right) > 0;
    case '<=': return compare(left, right) <= 0;
    case '>=': return compare(left, right) >= 0;

    // Logical (3-valued logic)
    case 'AND':
      if (left === false || right === false) return false;
      if (left === null || right === null) return null;
      return true;
    case 'OR':
      if (left === true || right === true) return true;
      if (left === null || right === null) return null;
      return false;

    // String
    case 'LIKE':
      return likeMatch(String(left), String(right));
    case '||':
      return String(left) + String(right);

    default:
      return null;
  }
}

function asNum(v: Value): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return null;
}

function compare(a: Value, b: Value): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function likeMatch(str: string, pattern: string): boolean {
  // Convert SQL LIKE pattern to regex
  let regex = '^';
  for (const ch of pattern) {
    if (ch === '%') regex += '.*';
    else if (ch === '_') regex += '.';
    else regex += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  regex += '$';
  return new RegExp(regex, 'i').test(str);
}
