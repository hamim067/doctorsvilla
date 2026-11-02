import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// ডেভ মোডে হট-রিলোডে বারবার নতুন কানেকশন যেন না খোলে
const g = globalThis as unknown as { pgPool?: Pool };
const pool = g.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== "production") g.pgPool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export { schema };
