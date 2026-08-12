import pg from 'pg';
const {Pool} = pg;

export const pool = new Pool({connectionString:process.env.DATABASE_URL || 'postgresql://ieum:ieum_change_me@127.0.0.1:5432/ieum_exp',
  max:Number(process.env.DB_POOL_SIZE || 10)});

export async function query(text, params = []) { return pool.query(text, params); }
export async function dbReady() { try { await query('select 1'); return true; } catch { return false; } }
