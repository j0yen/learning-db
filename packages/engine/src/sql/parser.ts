/**
 * SQL Parser: Recursive descent parser producing AST nodes.
 */

import { Lexer, TokenType } from './lexer.js';
import type { Token } from './lexer.js';
import type {
  Statement, SelectStatement, InsertStatement, UpdateStatement,
  DeleteStatement, CreateTableStatement, CreateIndexStatement,
  Expr, SelectItem, FromClause, JoinClause, OrderByItem,
  ColumnDefAST,
} from './ast.js';

export class Parser {
  private tokens: Token[] = [];
  private pos = 0;

  parse(sql: string): Statement {
    const lexer = new Lexer(sql);
    this.tokens = lexer.tokenize();
    this.pos = 0;

    const stmt = this.parseStatement();
    this.optionalConsume(TokenType.SEMICOLON);
    this.expect(TokenType.EOF);
    return stmt;
  }

  parseMultiple(sql: string): Statement[] {
    const lexer = new Lexer(sql);
    this.tokens = lexer.tokenize();
    this.pos = 0;

    const stmts: Statement[] = [];
    while (!this.check(TokenType.EOF)) {
      stmts.push(this.parseStatement());
      this.optionalConsume(TokenType.SEMICOLON);
    }
    return stmts;
  }

  // ─── Statement Dispatch ───────────────────────────────────────────────

  private parseStatement(): Statement {
    if (this.check(TokenType.SELECT)) return this.parseSelect();
    if (this.check(TokenType.INSERT)) return this.parseInsert();
    if (this.check(TokenType.UPDATE)) return this.parseUpdate();
    if (this.check(TokenType.DELETE)) return this.parseDelete();
    if (this.check(TokenType.CREATE)) return this.parseCreate();
    throw this.error(`Expected statement, got ${this.current().type}`);
  }

  // ─── SELECT ───────────────────────────────────────────────────────────

  private parseSelect(): SelectStatement {
    this.consume(TokenType.SELECT);
    const distinct = this.optionalConsume(TokenType.DISTINCT);

    const columns = this.parseSelectItems();

    let from: FromClause | undefined;
    if (this.optionalConsume(TokenType.FROM)) {
      from = this.parseFrom();
    }

    let where: Expr | undefined;
    if (this.optionalConsume(TokenType.WHERE)) {
      where = this.parseExpr();
    }

    let groupBy: Expr[] | undefined;
    if (this.optionalConsume(TokenType.GROUP)) {
      this.consume(TokenType.BY);
      groupBy = this.parseExprList();
    }

    let having: Expr | undefined;
    if (this.optionalConsume(TokenType.HAVING)) {
      having = this.parseExpr();
    }

    let orderBy: OrderByItem[] | undefined;
    if (this.optionalConsume(TokenType.ORDER)) {
      this.consume(TokenType.BY);
      orderBy = this.parseOrderByItems();
    }

    let limit: Expr | undefined;
    if (this.optionalConsume(TokenType.LIMIT)) {
      limit = this.parseExpr();
    }

    let offset: Expr | undefined;
    if (this.optionalConsume(TokenType.OFFSET)) {
      offset = this.parseExpr();
    }

    return {
      type: 'select',
      distinct: distinct || undefined,
      columns,
      from,
      where,
      groupBy,
      having,
      orderBy,
      limit,
      offset,
    };
  }

  private parseSelectItems(): SelectItem[] {
    const items: SelectItem[] = [];
    do {
      items.push(this.parseSelectItem());
    } while (this.optionalConsume(TokenType.COMMA));
    return items;
  }

  private parseSelectItem(): SelectItem {
    // Check for table.* or *
    if (this.check(TokenType.STAR)) {
      this.advance();
      return { expr: { type: 'star' } };
    }

    // Check for table.*
    if (this.check(TokenType.IDENTIFIER) && this.peekType(1) === TokenType.DOT && this.peekType(2) === TokenType.STAR) {
      const table = this.advance().value;
      this.advance(); // dot
      this.advance(); // star
      const alias = this.optionalConsume(TokenType.AS) ? this.consume(TokenType.IDENTIFIER).value : undefined;
      return { expr: { type: 'star', table }, alias };
    }

    const expr = this.parseExpr();
    let alias: string | undefined;
    if (this.optionalConsume(TokenType.AS)) {
      alias = this.consume(TokenType.IDENTIFIER).value;
    } else if (this.check(TokenType.IDENTIFIER) && !this.isKeyword(this.current())) {
      alias = this.advance().value;
    }
    return { expr, alias };
  }

  // ─── FROM / JOIN ──────────────────────────────────────────────────────

  private parseFrom(): FromClause {
    let left = this.parseTableRef();

    while (this.isJoinKeyword()) {
      left = this.parseJoin(left);
    }

    return left;
  }

  private parseTableRef(): FromClause {
    if (this.check(TokenType.LPAREN)) {
      this.advance();
      const inner = this.parseFrom();
      this.consume(TokenType.RPAREN);
      return inner;
    }

    const name = this.consume(TokenType.IDENTIFIER).value;
    let alias: string | undefined;
    if (this.optionalConsume(TokenType.AS)) {
      alias = this.consume(TokenType.IDENTIFIER).value;
    } else if (this.check(TokenType.IDENTIFIER) && !this.isKeyword(this.current())) {
      alias = this.advance().value;
    }

    return { type: 'table', name, alias };
  }

  private parseJoin(left: FromClause): JoinClause {
    let joinType: JoinClause['joinType'] = 'INNER';

    if (this.optionalConsume(TokenType.INNER)) {
      joinType = 'INNER';
    } else if (this.optionalConsume(TokenType.LEFT)) {
      this.optionalConsume(TokenType.OUTER);
      joinType = 'LEFT';
    } else if (this.optionalConsume(TokenType.RIGHT)) {
      this.optionalConsume(TokenType.OUTER);
      joinType = 'RIGHT';
    } else if (this.optionalConsume(TokenType.CROSS)) {
      joinType = 'CROSS';
    }

    this.consume(TokenType.JOIN);
    const right = this.parseTableRef();

    let condition: Expr | undefined;
    if (joinType !== 'CROSS' && this.optionalConsume(TokenType.ON)) {
      condition = this.parseExpr();
    }

    return { type: 'join', joinType, left, right, condition };
  }

  private isJoinKeyword(): boolean {
    const t = this.current().type;
    return t === TokenType.JOIN || t === TokenType.INNER ||
      t === TokenType.LEFT || t === TokenType.RIGHT || t === TokenType.CROSS;
  }

  // ─── INSERT ───────────────────────────────────────────────────────────

  private parseInsert(): InsertStatement {
    this.consume(TokenType.INSERT);
    this.consume(TokenType.INTO);
    const table = this.consume(TokenType.IDENTIFIER).value;

    let columns: string[] | undefined;
    if (this.optionalConsume(TokenType.LPAREN)) {
      columns = [];
      do {
        columns.push(this.consume(TokenType.IDENTIFIER).value);
      } while (this.optionalConsume(TokenType.COMMA));
      this.consume(TokenType.RPAREN);
    }

    this.consume(TokenType.VALUES);
    const values: Expr[][] = [];
    do {
      this.consume(TokenType.LPAREN);
      values.push(this.parseExprList());
      this.consume(TokenType.RPAREN);
    } while (this.optionalConsume(TokenType.COMMA));

    return { type: 'insert', table, columns, values };
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────

  private parseUpdate(): UpdateStatement {
    this.consume(TokenType.UPDATE);
    const table = this.consume(TokenType.IDENTIFIER).value;
    this.consume(TokenType.SET);

    const assignments: UpdateStatement['assignments'] = [];
    do {
      const column = this.consume(TokenType.IDENTIFIER).value;
      this.consume(TokenType.EQ);
      const value = this.parseExpr();
      assignments.push({ column, value });
    } while (this.optionalConsume(TokenType.COMMA));

    let where: Expr | undefined;
    if (this.optionalConsume(TokenType.WHERE)) {
      where = this.parseExpr();
    }

    return { type: 'update', table, assignments, where };
  }

  // ─── DELETE ───────────────────────────────────────────────────────────

  private parseDelete(): DeleteStatement {
    this.consume(TokenType.DELETE);
    this.consume(TokenType.FROM);
    const table = this.consume(TokenType.IDENTIFIER).value;

    let where: Expr | undefined;
    if (this.optionalConsume(TokenType.WHERE)) {
      where = this.parseExpr();
    }

    return { type: 'delete', table, where };
  }

  // ─── CREATE ───────────────────────────────────────────────────────────

  private parseCreate(): Statement {
    this.consume(TokenType.CREATE);

    if (this.check(TokenType.TABLE)) {
      return this.parseCreateTable();
    }
    if (this.check(TokenType.INDEX)) {
      return this.parseCreateIndex();
    }

    throw this.error(`Expected TABLE or INDEX after CREATE`);
  }

  private parseCreateTable(): CreateTableStatement {
    this.consume(TokenType.TABLE);
    const table = this.consume(TokenType.IDENTIFIER).value;
    this.consume(TokenType.LPAREN);

    const columns: ColumnDefAST[] = [];
    do {
      columns.push(this.parseColumnDef());
    } while (this.optionalConsume(TokenType.COMMA));

    this.consume(TokenType.RPAREN);
    return { type: 'create_table', table, columns };
  }

  private parseColumnDef(): ColumnDefAST {
    const name = this.consume(TokenType.IDENTIFIER).value;
    const dataType = this.parseDataType();

    let maxLength: number | undefined;
    let nullable = true;
    let primaryKey = false;

    if (dataType === 'VARCHAR' && this.optionalConsume(TokenType.LPAREN)) {
      maxLength = parseInt(this.consume(TokenType.NUMBER).value, 10);
      this.consume(TokenType.RPAREN);
    }

    // Parse constraints
    while (this.check(TokenType.NOT) || this.check(TokenType.PRIMARY) || this.check(TokenType.NULL)) {
      if (this.optionalConsume(TokenType.NOT)) {
        this.consume(TokenType.NULL);
        nullable = false;
      } else if (this.optionalConsume(TokenType.PRIMARY)) {
        this.consume(TokenType.KEY);
        primaryKey = true;
        nullable = false;
      } else {
        break;
      }
    }

    return { name, dataType, maxLength, nullable, primaryKey };
  }

  private parseDataType(): string {
    const t = this.current().type;
    if (t === TokenType.INTEGER_KW) { this.advance(); return 'INTEGER'; }
    if (t === TokenType.FLOAT_KW) { this.advance(); return 'FLOAT'; }
    if (t === TokenType.VARCHAR_KW) { this.advance(); return 'VARCHAR'; }
    if (t === TokenType.BOOLEAN_KW) { this.advance(); return 'BOOLEAN'; }
    throw this.error(`Expected data type, got ${this.current().value}`);
  }

  private parseCreateIndex(): CreateIndexStatement {
    this.consume(TokenType.INDEX);
    const indexName = this.consume(TokenType.IDENTIFIER).value;
    this.consume(TokenType.ON);
    const tableName = this.consume(TokenType.IDENTIFIER).value;

    this.consume(TokenType.LPAREN);
    const columns: string[] = [];
    do {
      columns.push(this.consume(TokenType.IDENTIFIER).value);
    } while (this.optionalConsume(TokenType.COMMA));
    this.consume(TokenType.RPAREN);

    let using: string | undefined;
    if (this.optionalConsume(TokenType.USING)) {
      using = this.consume(TokenType.IDENTIFIER).value;
    }

    return { type: 'create_index', indexName, tableName, columns, using };
  }

  // ─── Expressions (precedence climbing) ────────────────────────────────

  private parseExpr(): Expr {
    return this.parseOr();
  }

  private parseExprList(): Expr[] {
    const list: Expr[] = [];
    do {
      list.push(this.parseExpr());
    } while (this.optionalConsume(TokenType.COMMA));
    return list;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.optionalConsume(TokenType.OR)) {
      const right = this.parseAnd();
      left = { type: 'binary', op: 'OR', left, right };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.optionalConsume(TokenType.AND)) {
      const right = this.parseNot();
      left = { type: 'binary', op: 'AND', left, right };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.optionalConsume(TokenType.NOT)) {
      return { type: 'unary', op: 'NOT', operand: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    let left = this.parseAddSub();

    // IS [NOT] NULL
    if (this.check(TokenType.IS)) {
      this.advance();
      const negated = this.optionalConsume(TokenType.NOT);
      this.consume(TokenType.NULL);
      return { type: 'is_null', expr: left, negated: negated || false };
    }

    // [NOT] BETWEEN
    const notBetween = this.check(TokenType.NOT) && this.peekType(1) === TokenType.BETWEEN;
    if (notBetween) this.advance(); // consume NOT
    if (this.optionalConsume(TokenType.BETWEEN)) {
      const low = this.parseAddSub();
      this.consume(TokenType.AND);
      const high = this.parseAddSub();
      return { type: 'between', expr: left, low, high, negated: notBetween };
    }

    // [NOT] IN
    const notIn = this.check(TokenType.NOT) && this.peekType(1) === TokenType.IN;
    if (notIn) this.advance(); // consume NOT
    if (this.optionalConsume(TokenType.IN)) {
      this.consume(TokenType.LPAREN);
      const values = this.parseExprList();
      this.consume(TokenType.RPAREN);
      return { type: 'in', expr: left, values, negated: notIn };
    }

    // [NOT] LIKE
    const notLike = this.check(TokenType.NOT) && this.peekType(1) === TokenType.LIKE;
    if (notLike) this.advance();
    if (this.optionalConsume(TokenType.LIKE)) {
      const right = this.parseAddSub();
      let expr: Expr = { type: 'binary', op: 'LIKE', left, right };
      if (notLike) expr = { type: 'unary', op: 'NOT', operand: expr };
      return expr;
    }

    // Comparison operators
    const opMap: Partial<Record<TokenType, BinaryOp>> = {
      [TokenType.EQ]: '=',
      [TokenType.NEQ]: '!=',
      [TokenType.LT]: '<',
      [TokenType.GT]: '>',
      [TokenType.LTE]: '<=',
      [TokenType.GTE]: '>=',
    };

    const op = opMap[this.current().type];
    if (op) {
      this.advance();
      const right = this.parseAddSub();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  private parseAddSub(): Expr {
    let left = this.parseMulDiv();
    while (this.check(TokenType.PLUS) || this.check(TokenType.MINUS) || this.check(TokenType.CONCAT)) {
      const op = this.advance().type === TokenType.PLUS ? '+' :
        this.tokens[this.pos - 1].type === TokenType.CONCAT ? '||' : '-';
      const right = this.parseMulDiv();
      left = { type: 'binary', op: op as BinaryOp, left, right };
    }
    return left;
  }

  private parseMulDiv(): Expr {
    let left = this.parseUnary();
    while (this.check(TokenType.STAR) || this.check(TokenType.SLASH) || this.check(TokenType.PERCENT)) {
      const op = this.advance().type === TokenType.STAR ? '*' :
        this.tokens[this.pos - 1].type === TokenType.SLASH ? '/' : '%';
      const right = this.parseUnary();
      left = { type: 'binary', op: op as BinaryOp, left, right };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.optionalConsume(TokenType.MINUS)) {
      return { type: 'unary', op: '-', operand: this.parsePrimary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const token = this.current();

    // Number literal
    if (token.type === TokenType.NUMBER) {
      this.advance();
      const val = token.value.includes('.') ? parseFloat(token.value) : parseInt(token.value, 10);
      return { type: 'literal', value: val, dataType: 'number' };
    }

    // String literal
    if (token.type === TokenType.STRING) {
      this.advance();
      return { type: 'literal', value: token.value, dataType: 'string' };
    }

    // Boolean
    if (token.type === TokenType.TRUE) {
      this.advance();
      return { type: 'literal', value: true, dataType: 'boolean' };
    }
    if (token.type === TokenType.FALSE) {
      this.advance();
      return { type: 'literal', value: false, dataType: 'boolean' };
    }

    // NULL
    if (token.type === TokenType.NULL) {
      this.advance();
      return { type: 'literal', value: null, dataType: 'null' };
    }

    // CASE expression
    if (token.type === TokenType.CASE) {
      return this.parseCaseExpr();
    }

    // Star (only in certain contexts, but parser allows it in expressions)
    if (token.type === TokenType.STAR) {
      this.advance();
      return { type: 'star' };
    }

    // Aggregate / function call
    if (this.isAggregateKeyword(token.type) || (token.type === TokenType.IDENTIFIER && this.peekType(1) === TokenType.LPAREN)) {
      return this.parseFunctionCall();
    }

    // Parenthesized expression
    if (token.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpr();
      this.consume(TokenType.RPAREN);
      return expr;
    }

    // Column reference: table.column or just column
    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      if (this.optionalConsume(TokenType.DOT)) {
        const column = this.consume(TokenType.IDENTIFIER).value;
        return { type: 'column_ref', table: token.value, column };
      }
      return { type: 'column_ref', column: token.value };
    }

    throw this.error(`Unexpected token ${token.type} '${token.value}'`);
  }

  private parseFunctionCall(): Expr {
    const name = this.advance().value.toUpperCase();
    this.consume(TokenType.LPAREN);

    // COUNT(*)
    if (name === 'COUNT' && this.check(TokenType.STAR)) {
      this.advance();
      this.consume(TokenType.RPAREN);
      return { type: 'function', name: 'COUNT', args: [{ type: 'star' }] };
    }

    const distinct = this.optionalConsume(TokenType.DISTINCT);
    const args = this.check(TokenType.RPAREN) ? [] : this.parseExprList();
    this.consume(TokenType.RPAREN);

    return { type: 'function', name, args, distinct: distinct || undefined };
  }

  private parseCaseExpr(): Expr {
    this.consume(TokenType.CASE);

    const whens: Array<{ condition: Expr; result: Expr }> = [];
    while (this.optionalConsume(TokenType.WHEN)) {
      const condition = this.parseExpr();
      this.consume(TokenType.THEN);
      const result = this.parseExpr();
      whens.push({ condition, result });
    }

    let elseResult: Expr | undefined;
    if (this.optionalConsume(TokenType.ELSE)) {
      elseResult = this.parseExpr();
    }

    this.consume(TokenType.END);
    return { type: 'case', whens, elseResult };
  }

  // ─── ORDER BY ─────────────────────────────────────────────────────────

  private parseOrderByItems(): OrderByItem[] {
    const items: OrderByItem[] = [];
    do {
      const expr = this.parseExpr();
      let direction: 'ASC' | 'DESC' = 'ASC';
      if (this.optionalConsume(TokenType.ASC)) {
        direction = 'ASC';
      } else if (this.optionalConsume(TokenType.DESC)) {
        direction = 'DESC';
      }
      items.push({ expr, direction });
    } while (this.optionalConsume(TokenType.COMMA));
    return items;
  }

  // ─── Token Helpers ────────────────────────────────────────────────────

  private current(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private consume(type: TokenType): Token {
    if (!this.check(type)) {
      throw this.error(`Expected ${type}, got ${this.current().type} '${this.current().value}'`);
    }
    return this.advance();
  }

  private optionalConsume(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType): void {
    if (!this.check(type)) {
      throw this.error(`Expected ${type}, got ${this.current().type}`);
    }
  }

  private peekType(offset: number): TokenType {
    const idx = this.pos + offset;
    if (idx >= this.tokens.length) return TokenType.EOF;
    return this.tokens[idx].type;
  }

  private isAggregateKeyword(type: TokenType): boolean {
    return type === TokenType.COUNT || type === TokenType.SUM ||
      type === TokenType.AVG || type === TokenType.MIN || type === TokenType.MAX;
  }

  private isKeyword(token: Token): boolean {
    return token.type !== TokenType.IDENTIFIER &&
      token.type !== TokenType.NUMBER &&
      token.type !== TokenType.STRING &&
      token.type !== TokenType.EOF;
  }

  private error(msg: string): Error {
    const token = this.current();
    return new Error(`Parse error at position ${token.position}: ${msg}`);
  }
}

type BinaryOp = '+' | '-' | '*' | '/' | '%' | '=' | '!=' | '<' | '>' | '<=' | '>=' | 'AND' | 'OR' | 'LIKE' | '||';
