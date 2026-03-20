import { describe, it, expect } from 'vitest';
import { Lexer, TokenType } from './lexer.js';

describe('Lexer', () => {
  it('should tokenize a simple SELECT', () => {
    const tokens = new Lexer('SELECT * FROM users').tokenize();
    expect(tokens.map((t) => t.type)).toEqual([
      TokenType.SELECT, TokenType.STAR, TokenType.FROM,
      TokenType.IDENTIFIER, TokenType.EOF,
    ]);
  });

  it('should tokenize numbers', () => {
    const tokens = new Lexer('42 3.14').tokenize();
    expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '42' });
    expect(tokens[1]).toMatchObject({ type: TokenType.NUMBER, value: '3.14' });
  });

  it('should tokenize string literals', () => {
    const tokens = new Lexer("'hello world'").tokenize();
    expect(tokens[0]).toMatchObject({ type: TokenType.STRING, value: 'hello world' });
  });

  it('should handle escaped quotes in strings', () => {
    const tokens = new Lexer("'it''s'").tokenize();
    expect(tokens[0].value).toBe("it's");
  });

  it('should tokenize comparison operators', () => {
    const tokens = new Lexer('= != <> < > <= >=').tokenize();
    const types = tokens.slice(0, -1).map((t) => t.type);
    expect(types).toEqual([
      TokenType.EQ, TokenType.NEQ, TokenType.NEQ,
      TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE,
    ]);
  });

  it('should tokenize keywords case-insensitively', () => {
    const tokens = new Lexer('select FROM Where').tokenize();
    expect(tokens[0].type).toBe(TokenType.SELECT);
    expect(tokens[1].type).toBe(TokenType.FROM);
    expect(tokens[2].type).toBe(TokenType.WHERE);
  });

  it('should tokenize a full query', () => {
    const sql = "SELECT id, name FROM users WHERE age > 18 AND name LIKE '%test%' ORDER BY id DESC LIMIT 10";
    const tokens = new Lexer(sql).tokenize();
    expect(tokens.length).toBeGreaterThan(10);
    expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
  });

  it('should tokenize INSERT statement', () => {
    const tokens = new Lexer("INSERT INTO users (id, name) VALUES (1, 'alice')").tokenize();
    expect(tokens[0].type).toBe(TokenType.INSERT);
    expect(tokens[1].type).toBe(TokenType.INTO);
  });

  it('should skip line comments', () => {
    const tokens = new Lexer('SELECT -- this is a comment\n* FROM t').tokenize();
    expect(tokens.map((t) => t.type)).toEqual([
      TokenType.SELECT, TokenType.STAR, TokenType.FROM,
      TokenType.IDENTIFIER, TokenType.EOF,
    ]);
  });

  it('should tokenize aggregate functions', () => {
    const tokens = new Lexer('COUNT SUM AVG MIN MAX').tokenize();
    expect(tokens[0].type).toBe(TokenType.COUNT);
    expect(tokens[1].type).toBe(TokenType.SUM);
    expect(tokens[2].type).toBe(TokenType.AVG);
    expect(tokens[3].type).toBe(TokenType.MIN);
    expect(tokens[4].type).toBe(TokenType.MAX);
  });

  it('should throw on unexpected character', () => {
    expect(() => new Lexer('SELECT @').tokenize()).toThrow('Unexpected character');
  });

  it('should throw on unterminated string', () => {
    expect(() => new Lexer("'unterminated").tokenize()).toThrow('Unterminated string');
  });

  it('should tokenize boolean and null literals', () => {
    const tokens = new Lexer('TRUE FALSE NULL').tokenize();
    expect(tokens[0].type).toBe(TokenType.TRUE);
    expect(tokens[1].type).toBe(TokenType.FALSE);
    expect(tokens[2].type).toBe(TokenType.NULL);
  });
});
