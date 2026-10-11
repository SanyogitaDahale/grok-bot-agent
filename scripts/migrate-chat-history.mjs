import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

try {
  process.loadEnvFile(".env");
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Load your local environment before running this migration.");
  process.exit(1);
}

const migrationPath = fileURLToPath(new URL("../db/migrations/001_agent_chat_history_single_row.sql", import.meta.url));
const migrationSql = await readFile(migrationPath, "utf8");
const sql = postgres(databaseUrl, { prepare: false, max: 1 });

try {
  await sql.unsafe(migrationSql).simple();
  console.log("Chat history rows were consolidated into one transcript row per agent.");
} catch (error) {
  const info = error && typeof error === "object"
    ? Object.fromEntries(["name", "code", "severity", "position", "routine", "message"].flatMap((key) => {
        const value = error[key];
        return typeof value === "string" && value ? [[key, value]] : [];
      }))
    : { error: String(error) };
  console.error("Chat history migration failed:", JSON.stringify(info));
  process.exitCode = 1;
} finally {
  await sql.end();
}
