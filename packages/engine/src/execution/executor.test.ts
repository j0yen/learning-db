import { describe, it, expect } from 'vitest';
import { Executor } from './executor.js';
import { Parser } from '../sql/parser.js';
import { Planner } from '../sql/planner.js';
import { Catalog } from '../catalog/catalog.js';
import { MemoryDiskManager } from '../storage/disk-manager.js';
import { HeapFile } from '../storage/heap-file.js';
import { DataType } from '../types.js';
import type { Schema } from '../types.js';

const usersSchema: Schema = {
  columns: [
    { name: 'id', type: DataType.INTEGER, nullable: false },
    { name: 'name', type: DataType.VARCHAR, maxLength: 100, nullable: false },
    { name: 'age', type: DataType.INTEGER, nullable: true },
    { name: 'dept', type: DataType.VARCHAR, maxLength: 50, nullable: true },
  ],
};

const ordersSchema: Schema = {
  columns: [
    { name: 'order_id', type: DataType.INTEGER, nullable: false },
    { name: 'user_id', type: DataType.INTEGER, nullable: false },
    { name: 'amount', type: DataType.FLOAT, nullable: false },
  ],
};

function setupDB() {
  const dm = new MemoryDiskManager(4096);
  const catalog = new Catalog();
  const parser = new Parser();
  const planner = new Planner(catalog);
  const executor = new Executor(catalog);

  const usersHF = new HeapFile(dm, usersSchema, 0);
  catalog.registerTable('users', usersSchema, usersHF);

  const ordersHF = new HeapFile(dm, ordersSchema, 1);
  catalog.registerTable('orders', ordersSchema, ordersHF);

  // Insert test data
  usersHF.insertTuple([1, 'alice', 30, 'eng']);
  usersHF.insertTuple([2, 'bob', 25, 'sales']);
  usersHF.insertTuple([3, 'charlie', 35, 'eng']);
  usersHF.insertTuple([4, 'diana', 28, 'sales']);
  usersHF.insertTuple([5, 'eve', null, 'eng']);

  ordersHF.insertTuple([101, 1, 99.99]);
  ordersHF.insertTuple([102, 1, 50.0]);
  ordersHF.insertTuple([103, 2, 200.0]);
  ordersHF.insertTuple([104, 3, 75.5]);

  function run(sql: string) {
    const stmt = parser.parse(sql);
    const plan = planner.plan(stmt);
    return executor.execute(plan);
  }

  return { run, catalog, parser, planner, executor };
}

describe('Executor end-to-end', () => {
  it('should SELECT *', () => {
    const { run } = setupDB();
    const result = run('SELECT * FROM users');
    expect(result.rowCount).toBe(5);
    expect(result.columns).toEqual(['id', 'name', 'age', 'dept']);
  });

  it('should SELECT specific columns', () => {
    const { run } = setupDB();
    const result = run('SELECT id, name FROM users');
    expect(result.columns).toEqual(['id', 'name']);
    expect(result.rowCount).toBe(5);
  });

  it('should filter with WHERE', () => {
    const { run } = setupDB();
    const result = run('SELECT * FROM users WHERE age > 28');
    expect(result.rowCount).toBe(2); // alice (30), charlie (35)
  });

  it('should filter with AND', () => {
    const { run } = setupDB();
    const result = run("SELECT * FROM users WHERE age > 25 AND dept = 'eng'");
    expect(result.rowCount).toBe(2); // alice, charlie
  });

  it('should filter with OR', () => {
    const { run } = setupDB();
    const result = run("SELECT * FROM users WHERE name = 'alice' OR name = 'bob'");
    expect(result.rowCount).toBe(2);
  });

  it('should ORDER BY ASC', () => {
    const { run } = setupDB();
    const result = run('SELECT id, name FROM users ORDER BY name ASC');
    const names = result.rows.map((r) => r[1]);
    expect(names).toEqual(['alice', 'bob', 'charlie', 'diana', 'eve']);
  });

  it('should ORDER BY DESC', () => {
    const { run } = setupDB();
    const result = run('SELECT id, name FROM users ORDER BY id DESC');
    const ids = result.rows.map((r) => r[0]);
    expect(ids).toEqual([5, 4, 3, 2, 1]);
  });

  it('should LIMIT', () => {
    const { run } = setupDB();
    const result = run('SELECT * FROM users ORDER BY id LIMIT 3');
    expect(result.rowCount).toBe(3);
  });

  it('should LIMIT with OFFSET', () => {
    const { run } = setupDB();
    const result = run('SELECT id FROM users ORDER BY id LIMIT 2 OFFSET 2');
    expect(result.rows.map((r) => r[0])).toEqual([3, 4]);
  });

  it('should COUNT(*)', () => {
    const { run } = setupDB();
    const result = run('SELECT COUNT(*) FROM users');
    expect(result.rows[0][0]).toBe(5);
  });

  it('should SUM', () => {
    const { run } = setupDB();
    const result = run('SELECT SUM(amount) FROM orders');
    expect(result.rows[0][0]).toBeCloseTo(425.49);
  });

  it('should AVG', () => {
    const { run } = setupDB();
    const result = run('SELECT AVG(amount) FROM orders');
    expect(result.rows[0][0]).toBeCloseTo(106.3725);
  });

  it('should GROUP BY with COUNT', () => {
    const { run } = setupDB();
    const result = run('SELECT dept, COUNT(*) FROM users GROUP BY dept');
    // eng: 3, sales: 2
    expect(result.rowCount).toBe(2);
    const engRow = result.rows.find((r) => r[0] === 'eng');
    const salesRow = result.rows.find((r) => r[0] === 'sales');
    expect(engRow![1]).toBe(3);
    expect(salesRow![1]).toBe(2);
  });

  it('should JOIN', () => {
    const { run } = setupDB();
    const result = run('SELECT users.name, orders.amount FROM users JOIN orders ON users.id = orders.user_id');
    expect(result.rowCount).toBe(4);
  });

  it('should LEFT JOIN', () => {
    const { run } = setupDB();
    const result = run('SELECT users.name, orders.amount FROM users LEFT JOIN orders ON users.id = orders.user_id');
    // alice has 2 orders, bob 1, charlie 1, diana 0, eve 0
    expect(result.rowCount).toBe(6); // 4 matches + 2 nulls
  });

  it('should handle IS NULL', () => {
    const { run } = setupDB();
    const result = run('SELECT * FROM users WHERE age IS NULL');
    expect(result.rowCount).toBe(1);
    expect(result.rows[0][1]).toBe('eve');
  });

  it('should handle IS NOT NULL', () => {
    const { run } = setupDB();
    const result = run('SELECT * FROM users WHERE age IS NOT NULL');
    expect(result.rowCount).toBe(4);
  });

  it('should handle BETWEEN', () => {
    const { run } = setupDB();
    const result = run('SELECT * FROM users WHERE age BETWEEN 25 AND 30');
    expect(result.rowCount).toBe(3); // alice(30), bob(25), diana(28)
  });

  it('should handle IN', () => {
    const { run } = setupDB();
    const result = run("SELECT * FROM users WHERE name IN ('alice', 'charlie')");
    expect(result.rowCount).toBe(2);
  });

  it('should handle arithmetic expressions', () => {
    const { run } = setupDB();
    const result = run('SELECT amount * 2 FROM orders');
    const values = result.rows.map((r) => r[0] as number).sort((a, b) => a - b);
    expect(values[0]).toBeCloseTo(100.0);  // 50.0 * 2
    expect(values[1]).toBeCloseTo(151.0);  // 75.5 * 2
  });

  it('should INSERT rows', () => {
    const { run } = setupDB();
    const insertResult = run("INSERT INTO users (id, name, age, dept) VALUES (6, 'frank', 40, 'hr')");
    expect(insertResult.rows[0][0]).toBe(1);

    const selectResult = run('SELECT * FROM users WHERE id = 6');
    expect(selectResult.rowCount).toBe(1);
    expect(selectResult.rows[0][1]).toBe('frank');
  });

  it('should UPDATE rows', () => {
    const { run } = setupDB();
    run("UPDATE users SET age = 31 WHERE name = 'alice'");

    const result = run("SELECT age FROM users WHERE name = 'alice'");
    expect(result.rows[0][0]).toBe(31);
  });

  it('should DELETE rows', () => {
    const { run } = setupDB();
    run("DELETE FROM users WHERE name = 'eve'");

    const result = run('SELECT * FROM users');
    expect(result.rowCount).toBe(4);
  });

  it('should handle LIKE', () => {
    const { run } = setupDB();
    const result = run("SELECT * FROM users WHERE name LIKE 'a%'");
    expect(result.rowCount).toBe(1);
    expect(result.rows[0][1]).toBe('alice');
  });

  it('should handle CASE expression', () => {
    const { run } = setupDB();
    const result = run("SELECT name, CASE WHEN age > 30 THEN 'senior' ELSE 'junior' END FROM users WHERE age IS NOT NULL ORDER BY name");
    expect(result.rows[0][1]).toBe('junior'); // alice: 30 is not > 30
    expect(result.rows[2][1]).toBe('senior'); // charlie: 35
  });
});
