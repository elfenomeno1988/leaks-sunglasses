import bcrypt from "bcryptjs";
import { loadConfig } from "../config.mjs";
import { createDatabase } from "../db.mjs";

const [, , email, password] = process.argv;
if (!email || !password || password.length < 12) {
  console.error("Usage: npm run admin:create -- admin@example.com 'mot-de-passe-de-12-caracteres-minimum'");
  process.exit(1);
}

const config = loadConfig();
const db = createDatabase(config);
try {
  const passwordHash = await bcrypt.hash(password, 12);
  await db.query(
    `insert into admins (email, password_hash) values (lower($1),$2)
     on conflict (email) do update set password_hash=excluded.password_hash, active=true`,
    [email, passwordHash]
  );
  console.log(`Administrateur prêt : ${email.toLowerCase()}`);
} finally {
  await db.end();
}
