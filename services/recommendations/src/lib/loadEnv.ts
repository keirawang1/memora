import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const serviceRoot = resolve(here, '../..');
const repoRoot = resolve(serviceRoot, '../..');

/** Load services/recommendations/.env then repo .env / .env.local (non-VITE secrets). */
export function loadEnv(): void {
  const candidates = [
    resolve(serviceRoot, '.env'),
    resolve(repoRoot, '.env'),
    resolve(repoRoot, '.env.local'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      config({ path, override: false });
    }
  }

  if (!process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      '';
  }
}
