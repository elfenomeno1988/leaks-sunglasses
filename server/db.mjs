import pg from "pg";

const { Pool } = pg;

export function createDatabase(config) {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    ssl: config.isProduction ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30_000
  });

  pool.on("error", (error) => {
    console.error("PostgreSQL pool error", error);
  });

  return pool;
}
