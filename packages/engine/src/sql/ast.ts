/**
 * SQL Abstract Syntax Tree node types.
 */

// ─── Expressions ─────────────────────────────────────────────────────────────

export type Expr =
  | ColumnRef
  | LiteralExpr
  | BinaryExpr
  | UnaryExpr
  | FunctionCall
  | StarExpr
  | BetweenExpr
  | InExpr
  | IsNullExpr
  | CaseExpr;

export interface ColumnRef {
  type: 'column_ref';
  table?: string;
  column: string;
}

export interface LiteralExpr {
  type: 'literal';
  value: number | string | boolean | null;
  dataType: 'number' | 'string' | 'boolean' | 'null';
}

export interface BinaryExpr {
  type: 'binary';
  op: '+' | '-' | '*' | '/' | '%' | '=' | '!=' | '<' | '>' | '<=' | '>=' | 'AND' | 'OR' | 'LIKE' | '||';
  left: Expr;
  right: Expr;
}

export interface UnaryExpr {
  type: 'unary';
  op: 'NOT' | '-';
  operand: Expr;
}

export interface FunctionCall {
  type: 'function';
  name: string; // COUNT, SUM, AVG, MIN, MAX
  args: Expr[];
  distinct?: boolean;
}

export interface StarExpr {
  type: 'star';
  table?: string;
}

export interface BetweenExpr {
  type: 'between';
  expr: Expr;
  low: Expr;
  high: Expr;
  negated: boolean;
}

export interface InExpr {
  type: 'in';
  expr: Expr;
  values: Expr[];
  negated: boolean;
}

export interface IsNullExpr {
  type: 'is_null';
  expr: Expr;
  negated: boolean;
}

export interface CaseExpr {
  type: 'case';
  operand?: Expr;
  whens: Array<{ condition: Expr; result: Expr }>;
  elseResult?: Expr;
}

// ─── Select Items ────────────────────────────────────────────────────────────

export interface SelectItem {
  expr: Expr;
  alias?: string;
}

// ─── FROM / JOIN ─────────────────────────────────────────────────────────────

export type FromClause = TableRef | JoinClause;

export interface TableRef {
  type: 'table';
  name: string;
  alias?: string;
}

export interface JoinClause {
  type: 'join';
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'CROSS';
  left: FromClause;
  right: FromClause;
  condition?: Expr;
}

// ─── ORDER BY ────────────────────────────────────────────────────────────────

export interface OrderByItem {
  expr: Expr;
  direction: 'ASC' | 'DESC';
}

// ─── Statements ──────────────────────────────────────────────────────────────

export type Statement =
  | SelectStatement
  | InsertStatement
  | UpdateStatement
  | DeleteStatement
  | CreateTableStatement
  | CreateIndexStatement;

export interface SelectStatement {
  type: 'select';
  distinct?: boolean;
  columns: SelectItem[];
  from?: FromClause;
  where?: Expr;
  groupBy?: Expr[];
  having?: Expr;
  orderBy?: OrderByItem[];
  limit?: Expr;
  offset?: Expr;
}

export interface InsertStatement {
  type: 'insert';
  table: string;
  columns?: string[];
  values: Expr[][];
}

export interface UpdateStatement {
  type: 'update';
  table: string;
  assignments: Array<{ column: string; value: Expr }>;
  where?: Expr;
}

export interface DeleteStatement {
  type: 'delete';
  table: string;
  where?: Expr;
}

export interface ColumnDefAST {
  name: string;
  dataType: string; // INTEGER, VARCHAR, FLOAT, BOOLEAN
  maxLength?: number;
  nullable: boolean;
  primaryKey: boolean;
}

export interface CreateTableStatement {
  type: 'create_table';
  table: string;
  columns: ColumnDefAST[];
}

export interface CreateIndexStatement {
  type: 'create_index';
  indexName: string;
  tableName: string;
  columns: string[];
  using?: string;
}
