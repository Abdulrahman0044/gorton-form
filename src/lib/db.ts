import { Pool } from "pg";

declare global { var __gortonPool: Pool | undefined; }
export function getPool():Pool {
  if(!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to your Supabase Postgres connection pooler URI");
  if(!globalThis.__gortonPool) {
    globalThis.__gortonPool = new Pool({
      connectionString:process.env.DATABASE_URL,
      max:Number(process.env.DB_POOL_SIZE || 2),
      idleTimeoutMillis:30_000,
      connectionTimeoutMillis:10_000,
      ssl:{rejectUnauthorized:true}
    });
  }
  return globalThis.__gortonPool;
}
