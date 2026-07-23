import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnv } from './loadEnv.js';

loadEnv();

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy services/recommendations/.env.example → .env and fill in the service_role key from Supabase → Settings → API.',
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function markJob(
  id: string,
  patch: {
    status?: string;
    cursor?: Record<string, unknown>;
    last_error?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
  },
): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb.from('recommendation_jobs').upsert(
    {
      id,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}
