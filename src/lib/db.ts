import { readFileSync } from "node:fs";
import { Pool } from "pg";

declare global { var __gortonPool: Pool | undefined; }
export function getPool():Pool {
  if(!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to your Supabase Postgres connection pooler URI");
  if(!globalThis.__gortonPool) {
    const ca=process.env.DATABASE_CA_CERT_PATH
      ? readFileSync(process.env.DATABASE_CA_CERT_PATH,"utf8")
      : undefined;
    globalThis.__gortonPool = new Pool({
      connectionString:process.env.DATABASE_URL,
      max:Number(process.env.DB_POOL_SIZE || 2),
      idleTimeoutMillis:30_000,
      connectionTimeoutMillis:10_000,
      ssl:{rejectUnauthorized:true,...(ca?{ca}:{})}
    });
  }
  return globalThis.__gortonPool;
}
