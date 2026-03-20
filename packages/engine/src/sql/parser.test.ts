import { describe, it, expect } from 'vitest';
import { Parser } from './parser.js';
import type {
  SelectStatement, InsertStatement, UpdateStatement,
  DeleteStatement, CreateTableStatement, CreateIndexStatement,
} from './ast.js';

const parser = new Parser();

describe('Parser', () => {
  describe('SELECT', () => {
    it('should parse simple SELECT', () => {
      const stmt = parser.parse('SELECT * FROM users') as SelectStatement;
      expect(stmt.type).toBe('select');
      expect(stmt.columns[0].expr.type).toBe('star');
      expect(stmt.from).toBeDefined();
      if (stmt.from?.type === 'table') {
        expect(stmt.from.name).toBe('users');
      }
    });

    it('should parse SELECT with column list', () => {
      const stmt = parser.parse('SELECT id, name, age FROM users') as SelectStatement;
      expect(stmt.columns.length).toBe(3);
      expect(stmt.columns[0].expr).toMatchObject({ type: 'column_ref', column: 'id' });
    });

    it('should parse SELECT with aliases', () => {
      const stmt = parser.parse('SELECT id AS user_id, name n FROM users') as SelectStatement;
      expect(stmt.columns[0].alias).toBe('user_id');
      expect(stmt.columns[1].alias).toBe('n');
    });

    it('should parse SELECT with WHERE', () => {
      const stmt = parser.parse('SELECT * FROM users WHERE age > 18') as SelectStatement;
      expect(stmt.where).toBeDefined();
      expect(stmt.where!.type).toBe('binary');
    });

    it('should parse SELECT with complex WHERE', () => {
      const stmt = parser.parse("SELECT * FROM users WHERE age > 18 AND name = 'alice' OR active = true") as SelectStatement;
      expect(stmt.where!.type).toBe('binary');
    });

    it('should parse SELECT with JOIN', () => {
      const stmt = parser.parse('SELECT * FROM users JOIN orders ON users.id = orders.user_id') as SelectStatement;
      expect(stmt.from!.type).toBe('join');
      const join = stmt.from as any;
      expect(join.joinType).toBe('INNER');
      expect(join.condition).toBeDefined();
    });

    it('should parse SELECT with LEFT JOIN', () => {
      const stmt = parser.parse('SELECT * FROM users LEFT JOIN orders ON users.id = orders.user_id') as SelectStatement;
      const join = stmt.from as any;
      expect(join.joinType).toBe('LEFT');
    });

    it('should parse SELECT with GROUP BY', () => {
      const stmt = parser.parse('SELECT department, COUNT(*) FROM employees GROUP BY department') as SelectStatement;
      expect(stmt.groupBy).toBeDefined();
      expect(stmt.groupBy!.length).toBe(1);
    });

    it('should parse SELECT with HAVING', () => {
      const stmt = parser.parse('SELECT dept, COUNT(*) FROM emp GROUP BY dept HAVING COUNT(*) > 5') as SelectStatement;
      expect(stmt.having).toBeDefined();
    });

    it('should parse SELECT with ORDER BY', () => {
      const stmt = parser.parse('SELECT * FROM users ORDER BY name ASC, age DESC') as SelectStatement;
      expect(stmt.orderBy).toBeDefined();
      expect(stmt.orderBy!.length).toBe(2);
      expect(stmt.orderBy![0].direction).toBe('ASC');
      expect(stmt.orderBy![1].direction).toBe('DESC');
    });

    it('should parse SELECT with LIMIT and OFFSET', () => {
      const stmt = parser.parse('SELECT * FROM users LIMIT 10 OFFSET 20') as SelectStatement;
      expect(stmt.limit).toBeDefined();
      expect(stmt.offset).toBeDefined();
    });

    it('should parse SELECT DISTINCT', () => {
      const stmt = parser.parse('SELECT DISTINCT name FROM users') as SelectStatement;
      expect(stmt.distinct).toBe(true);
    });

    it('should parse aggregate functions', () => {
      const stmt = parser.parse('SELECT COUNT(*), SUM(amount), AVG(price), MIN(id), MAX(id) FROM orders') as SelectStatement;
      expect(stmt.columns.length).toBe(5);
      expect(stmt.columns[0].expr).toMatchObject({ type: 'function', name: 'COUNT' });
    });

    it('should parse BETWEEN', () => {
      const stmt = parser.parse('SELECT * FROM t WHERE x BETWEEN 1 AND 10') as SelectStatement;
      expect(stmt.where!.type).toBe('between');
    });

    it('should parse IN', () => {
      const stmt = parser.parse("SELECT * FROM t WHERE x IN (1, 2, 3)") as SelectStatement;
      expect(stmt.where!.type).toBe('in');
    });

    it('should parse IS NULL', () => {
      const stmt = parser.parse('SELECT * FROM t WHERE x IS NULL') as SelectStatement;
      expect(stmt.where!.type).toBe('is_null');
    });

    it('should parse IS NOT NULL', () => {
      const stmt = parser.parse('SELECT * FROM t WHERE x IS NOT NULL') as SelectStatement;
      const expr = stmt.where as any;
      expect(expr.type).toBe('is_null');
      expect(expr.negated).toBe(true);
    });

    it('should parse CASE expression', () => {
      const stmt = parser.parse("SELECT CASE WHEN x > 0 THEN 'pos' ELSE 'neg' END FROM t") as SelectStatement;
      expect(stmt.columns[0].expr.type).toBe('case');
    });

    it('should parse nested arithmetic', () => {
      const stmt = parser.parse('SELECT (a + b) * c FROM t') as SelectStatement;
      const expr = stmt.columns[0].expr;
      expect(expr.type).toBe('binary');
    });

    it('should parse table.column references', () => {
      const stmt = parser.parse('SELECT t.id, t.name FROM t') as SelectStatement;
      expect(stmt.columns[0].expr).toMatchObject({ type: 'column_ref', table: 't', column: 'id' });
    });

    it('should parse multiple joins', () => {
      const sql = 'SELECT * FROM a JOIN b ON a.id = b.aid JOIN c ON b.id = c.bid';
      const stmt = parser.parse(sql) as SelectStatement;
      expect(stmt.from!.type).toBe('join');
      const outerJoin = stmt.from as any;
      expect(outerJoin.left.type).toBe('join');
    });
  });

  describe('INSERT', () => {
    it('should parse INSERT with columns', () => {
      const stmt = parser.parse("INSERT INTO users (id, name) VALUES (1, 'alice')") as InsertStatement;
      expect(stmt.type).toBe('insert');
      expect(stmt.table).toBe('users');
      expect(stmt.columns).toEqual(['id', 'name']);
      expect(stmt.values.length).toBe(1);
    });

    it('should parse INSERT without columns', () => {
      const stmt = parser.parse("INSERT INTO users VALUES (1, 'alice')") as InsertStatement;
      expect(stmt.columns).toBeUndefined();
    });

    it('should parse multi-row INSERT', () => {
      const stmt = parser.parse("INSERT INTO t VALUES (1, 'a'), (2, 'b'), (3, 'c')") as InsertStatement;
      expect(stmt.values.length).toBe(3);
    });
  });

  describe('UPDATE', () => {
    it('should parse UPDATE', () => {
      const stmt = parser.parse("UPDATE users SET name = 'bob' WHERE id = 1") as UpdateStatement;
      expect(stmt.type).toBe('update');
      expect(stmt.table).toBe('users');
      expect(stmt.assignments.length).toBe(1);
      expect(stmt.where).toBeDefined();
    });

    it('should parse UPDATE with multiple assignments', () => {
      const stmt = parser.parse("UPDATE t SET a = 1, b = 'x', c = true") as UpdateStatement;
      expect(stmt.assignments.length).toBe(3);
    });
  });

  describe('DELETE', () => {
    it('should parse DELETE', () => {
      const stmt = parser.parse('DELETE FROM users WHERE id = 1') as DeleteStatement;
      expect(stmt.type).toBe('delete');
      expect(stmt.table).toBe('users');
      expect(stmt.where).toBeDefined();
    });

    it('should parse DELETE without WHERE', () => {
      const stmt = parser.parse('DELETE FROM users') as DeleteStatement;
      expect(stmt.where).toBeUndefined();
    });
  });

  describe('CREATE TABLE', () => {
    it('should parse CREATE TABLE', () => {
      const sql = 'CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL, age INTEGER)';
      const stmt = parser.parse(sql) as CreateTableStatement;
      expect(stmt.type).toBe('create_table');
      expect(stmt.table).toBe('users');
      expect(stmt.columns.length).toBe(3);
      expect(stmt.columns[0]).toMatchObject({ name: 'id', dataType: 'INTEGER', primaryKey: true });
      expect(stmt.columns[1]).toMatchObject({ name: 'name', dataType: 'VARCHAR', maxLength: 100, nullable: false });
    });
  });

  describe('CREATE INDEX', () => {
    it('should parse CREATE INDEX', () => {
      const stmt = parser.parse('CREATE INDEX idx_name ON users (name)') as CreateIndexStatement;
      expect(stmt.type).toBe('create_index');
      expect(stmt.indexName).toBe('idx_name');
      expect(stmt.tableName).toBe('users');
      expect(stmt.columns).toEqual(['name']);
    });

    it('should parse CREATE INDEX with USING', () => {
      const stmt = parser.parse('CREATE INDEX idx ON t (x) USING btree') as CreateIndexStatement;
      expect(stmt.using).toBe('btree');
    });
  });

  describe('Error handling', () => {
    it('should throw on syntax error', () => {
      expect(() => parser.parse('SELECT')).toThrow();
    });

    it('should throw on unexpected token', () => {
      expect(() => parser.parse('FOOBAR')).toThrow();
    });
  });
});
