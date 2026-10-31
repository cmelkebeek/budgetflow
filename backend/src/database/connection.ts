import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from '../config.ts';
import { applySchema } from './schema.ts';

type Param = null | number | bigint | string | Uint8Array;

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
applySchema(db);

export const all = <T>(sql: string, ...params: Param[]) => db.prepare(sql).all(...params) as T[];

export const get = <T>(sql: string, ...params: Param[]) => db.prepare(sql).get(...params) as T | undefined;

export const run = (sql: string, ...params: Param[]) => db.prepare(sql).run(...params);

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
