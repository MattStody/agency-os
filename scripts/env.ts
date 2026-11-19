import { existsSync } from "node:fs";

/** Load .env.local then .env (first wins), like Next does. */
export function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (existsSync(f)) process.loadEnvFile(f);
  }
}
