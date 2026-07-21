import pg from "pg";

const { Pool } = pg;

/* Le SSL suit l'URL, pas l'environnement : les bases managées publiques
   exigent sslmode=require dans leur URL, les réseaux privés (Railway
   interne, docker-compose) ne parlent pas SSL du tout.
   DATABASE_SSL=require force le SSL si l'URL ne le précise pas. */
function sslFor(config) {
  const url = String(config.DATABASE_URL || "");
  if (/sslmode=(require|prefer|verify)/.test(url) || process.env.DATABASE_SSL === "require") {
    return { rejectUnauthorized: false };
  }
  return false;
}

export function createDatabase(config) {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    ssl: sslFor(config),
    max: 10,
    idleTimeoutMillis: 30_000
  });

  pool.on("error", (error) => {
    console.error("PostgreSQL pool error", error);
  });

  return pool;
}
