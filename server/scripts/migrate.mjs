import { readdir, readFile } from "node:fs/promises";
import { loadConfig } from "../config.mjs";
import { createDatabase } from "../db.mjs";

const config = loadConfig();
const db = createDatabase(config);
const directory = new URL("../migrations/", import.meta.url);

try {
  const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, directory), "utf8");
    await db.query(sql);
    console.log(`Migration appliquée : ${file}`);
  }
} finally {
  await db.end();
}
