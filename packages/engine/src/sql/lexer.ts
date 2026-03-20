/**
 * SQL Lexer: Tokenizes SQL input into a stream of tokens.
 */

export enum TokenType {
  // Keywords
  SELECT = 'SELECT',
  FROM = 'FROM',
  WHERE = 'WHERE',
  INSERT = 'INSERT',
  INTO = 'INTO',
  VALUES = 'VALUES',
  UPDATE = 'UPDATE',
  SET = 'SET',
  DELETE = 'DELETE',
  CREATE = 'CREATE',
  TABLE = 'TABLE',
  DROP = 'DROP',
  INDEX = 'INDEX',
  ON = 'ON',
  JOIN = 'JOIN',
  INNER = 'INNER',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  OUTER = 'OUTER',
  CROSS = 'CROSS',
  GROUP = 'GROUP',
  BY = 'BY',
  ORDER = 'ORDER',
  HAVING = 'HAVING',
  LIMIT = 'LIMIT',
  OFFSET = 'OFFSET',
  AS = 'AS',
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  IN = 'IN',
  BETWEEN = 'BETWEEN',
  LIKE = 'LIKE',
  IS = 'IS',
  NULL = 'NULL',
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  ASC = 'ASC',
  DESC = 'DESC',
  DISTINCT = 'DISTINCT',
  COUNT = 'COUNT',
  SUM = 'SUM',
  AVG = 'AVG',
  MIN = 'MIN',
  MAX = 'MAX',
  CASE = 'CASE',
  WHEN = 'WHEN',
  THEN = 'THEN',
  ELSE = 'ELSE',
  END = 'END',
  EXISTS = 'EXISTS',
  PRIMARY = 'PRIMARY',
  KEY = 'KEY',
  INTEGER_KW = 'INTEGER_KW',
  FLOAT_KW = 'FLOAT_KW',
  VARCHAR_KW = 'VARCHAR_KW',
  BOOLEAN_KW = 'BOOLEAN_KW',
  USING = 'USING',

  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',

  // Operators
  STAR = 'STAR',
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  SLASH = 'SLASH',
  PERCENT = 'PERCENT',
  EQ = 'EQ',
  NEQ = 'NEQ',
  LT = 'LT',
  GT = 'GT',
  LTE = 'LTE',
  GTE = 'GTE',
  CONCAT = 'CONCAT', // ||

  // Punctuation
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  COMMA = 'COMMA',
  DOT = 'DOT',
  SEMICOLON = 'SEMICOLON',

  // Special
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const KEYWORDS: Record<string, TokenType> = {
  SELECT: TokenType.SELECT,
  FROM: TokenType.FROM,
  WHERE: TokenType.WHERE,
  INSERT: TokenType.INSERT,
  INTO: TokenType.INTO,
  VALUES: TokenType.VALUES,
  UPDATE: TokenType.UPDATE,
  SET: TokenType.SET,
  DELETE: TokenType.DELETE,
  CREATE: TokenType.CREATE,
  TABLE: TokenType.TABLE,
  DROP: TokenType.DROP,
  INDEX: TokenType.INDEX,
  ON: TokenType.ON,
  JOIN: TokenType.JOIN,
  INNER: TokenType.INNER,
  LEFT: TokenType.LEFT,
  RIGHT: TokenType.RIGHT,
  OUTER: TokenType.OUTER,
  CROSS: TokenType.CROSS,
  GROUP: TokenType.GROUP,
  BY: TokenType.BY,
  ORDER: TokenType.ORDER,
  HAVING: TokenType.HAVING,
  LIMIT: TokenType.LIMIT,
  OFFSET: TokenType.OFFSET,
  AS: TokenType.AS,
  AND: TokenType.AND,
  OR: TokenType.OR,
  NOT: TokenType.NOT,
  IN: TokenType.IN,
  BETWEEN: TokenType.BETWEEN,
  LIKE: TokenType.LIKE,
  IS: TokenType.IS,
  NULL: TokenType.NULL,
  TRUE: TokenType.TRUE,
  FALSE: TokenType.FALSE,
  ASC: TokenType.ASC,
  DESC: TokenType.DESC,
  DISTINCT: TokenType.DISTINCT,
  COUNT: TokenType.COUNT,
  SUM: TokenType.SUM,
  AVG: TokenType.AVG,
  MIN: TokenType.MIN,
  MAX: TokenType.MAX,
  CASE: TokenType.CASE,
  WHEN: TokenType.WHEN,
  THEN: TokenType.THEN,
  ELSE: TokenType.ELSE,
  END: TokenType.END,
  EXISTS: TokenType.EXISTS,
  PRIMARY: TokenType.PRIMARY,
  KEY: TokenType.KEY,
  INTEGER: TokenType.INTEGER_KW,
  INT: TokenType.INTEGER_KW,
  FLOAT: TokenType.FLOAT_KW,
  DOUBLE: TokenType.FLOAT_KW,
  REAL: TokenType.FLOAT_KW,
  VARCHAR: TokenType.VARCHAR_KW,
  TEXT: TokenType.VARCHAR_KW,
  CHAR: TokenType.VARCHAR_KW,
  BOOLEAN: TokenType.BOOLEAN_KW,
  BOOL: TokenType.BOOLEAN_KW,
  USING: TokenType.USING,
};

export class Lexer {
  private input: string;
  private pos = 0;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    this.tokens = [];
    this.pos = 0;

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const ch = this.input[this.pos];

      // Skip comments
      if (ch === '-' && this.peek(1) === '-') {
        this.skipLineComment();
        continue;
      }

      if (ch === '(' ) { this.addToken(TokenType.LPAREN, '('); this.pos++; continue; }
      if (ch === ')') { this.addToken(TokenType.RPAREN, ')'); this.pos++; continue; }
      if (ch === ',') { this.addToken(TokenType.COMMA, ','); this.pos++; continue; }
      if (ch === '.') { this.addToken(TokenType.DOT, '.'); this.pos++; continue; }
      if (ch === ';') { this.addToken(TokenType.SEMICOLON, ';'); this.pos++; continue; }
      if (ch === '+') { this.addToken(TokenType.PLUS, '+'); this.pos++; continue; }
      if (ch === '-') { this.addToken(TokenType.MINUS, '-'); this.pos++; continue; }
      if (ch === '/') { this.addToken(TokenType.SLASH, '/'); this.pos++; continue; }
      if (ch === '%') { this.addToken(TokenType.PERCENT, '%'); this.pos++; continue; }
      if (ch === '*') { this.addToken(TokenType.STAR, '*'); this.pos++; continue; }

      if (ch === '|' && this.peek(1) === '|') {
        this.addToken(TokenType.CONCAT, '||'); this.pos += 2; continue;
      }

      if (ch === '=' ) { this.addToken(TokenType.EQ, '='); this.pos++; continue; }
      if (ch === '!' && this.peek(1) === '=') {
        this.addToken(TokenType.NEQ, '!='); this.pos += 2; continue;
      }
      if (ch === '<' && this.peek(1) === '>') {
        this.addToken(TokenType.NEQ, '<>'); this.pos += 2; continue;
      }
      if (ch === '<' && this.peek(1) === '=') {
        this.addToken(TokenType.LTE, '<='); this.pos += 2; continue;
      }
      if (ch === '>' && this.peek(1) === '=') {
        this.addToken(TokenType.GTE, '>='); this.pos += 2; continue;
      }
      if (ch === '<') { this.addToken(TokenType.LT, '<'); this.pos++; continue; }
      if (ch === '>') { this.addToken(TokenType.GT, '>'); this.pos++; continue; }

      // String literal
      if (ch === "'") { this.readString(); continue; }

      // Number literal
      if (this.isDigit(ch)) { this.readNumber(); continue; }

      // Identifier or keyword
      if (this.isIdentStart(ch)) { this.readIdentifier(); continue; }

      throw new Error(`Unexpected character '${ch}' at position ${this.pos}`);
    }

    this.addToken(TokenType.EOF, '');
    return this.tokens;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private skipLineComment(): void {
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      this.pos++;
    }
  }

  private readString(): void {
    const start = this.pos;
    this.pos++; // skip opening quote
    let value = '';

    while (this.pos < this.input.length) {
      if (this.input[this.pos] === "'" && this.peek(1) === "'") {
        value += "'";
        this.pos += 2; // escaped quote
      } else if (this.input[this.pos] === "'") {
        this.pos++; // skip closing quote
        this.tokens.push({ type: TokenType.STRING, value, position: start });
        return;
      } else {
        value += this.input[this.pos];
        this.pos++;
      }
    }
    throw new Error(`Unterminated string starting at position ${start}`);
  }

  private readNumber(): void {
    const start = this.pos;
    let hasDecimal = false;

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (this.isDigit(ch)) {
        this.pos++;
      } else if (ch === '.' && !hasDecimal) {
        hasDecimal = true;
        this.pos++;
      } else {
        break;
      }
    }

    this.tokens.push({
      type: TokenType.NUMBER,
      value: this.input.slice(start, this.pos),
      position: start,
    });
  }

  private readIdentifier(): void {
    const start = this.pos;
    while (this.pos < this.input.length && this.isIdentPart(this.input[this.pos])) {
      this.pos++;
    }

    const value = this.input.slice(start, this.pos);
    const upper = value.toUpperCase();
    const keywordType = KEYWORDS[upper];

    if (keywordType) {
      this.tokens.push({ type: keywordType, value: upper, position: start });
    } else {
      this.tokens.push({ type: TokenType.IDENTIFIER, value, position: start });
    }
  }

  private addToken(type: TokenType, value: string): void {
    this.tokens.push({ type, value, position: this.pos });
  }

  private peek(offset: number): string | undefined {
    return this.input[this.pos + offset];
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private isIdentPart(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch);
  }
}
