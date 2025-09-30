import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Support both DATABASE_URL and individual PG* environment variables
// This provides flexibility for different deployment environments
let pool: InstanceType<typeof Pool>;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL if available (common in production)
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' && process.env.DATABASE_URL.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined
  });
} else if (process.env.PGHOST) {
  // Use individual PG* variables (common in Docker/VPS deployments)
  pool = new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432', 10),
  });
} else {
  throw new Error(
    "Database configuration missing. Set either DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE environment variables."
  );
}

export { pool };
export const db = drizzle(pool, { schema });