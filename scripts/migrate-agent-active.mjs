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

const migrationPath = fileURLToPath(new URL("../db/migrations/004_agent_active_state.sql", import.meta.url));
const migrationSql = await readFile(migrationPath, "utf8");
const sql = postgres(databaseUrl, { prepare: false, max: 1 });

try {
  await sql.unsafe(migrationSql).simple();
  const columns = await sql.unsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
    ["agentConfig", "is_active"],
  );
  if (columns.length === 0) throw new Error('The "is_active" column was not found after migration.');
  console.log("Agent active state is ready in the database.");
} catch (error) {
  const info = error && typeof error === "object"
    ? Object.fromEntries(["name", "code", "severity", "position", "routine", "message"].flatMap((key) => {
        const value = error[key];
        return typeof value === "string" && value ? [[key, value]] : [];
      }))
    : { error: String(error) };
  console.error("Agent active state migration failed:", JSON.stringify(info));
  process.exitCode = 1;
} finally {
  await sql.end();
}
