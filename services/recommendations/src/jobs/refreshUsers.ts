import { getServiceClient, markJob } from '../lib/supabase.js';
import { generateForUser } from '../generate/generateForUser.js';
import { HIGH_RATING_THRESHOLD } from '../types.js';

async function listUserIdsToRefresh(): Promise<string[]> {
  const sb = getServiceClient();

  // Users with high ratings
  const { data: rated, error: ratedErr } = await sb
    .from('media')
    .select('user_id')
    .gt('rating', HIGH_RATING_THRESHOLD);
  if (ratedErr) throw ratedErr;

  const ids = new Set((rated ?? []).map((r: { user_id: string }) => r.user_id));

  // Users with preferred genres (cold start)
  const { data: prefs, error: prefsErr } = await sb
    .from('users')
    .select('user_id, preferred_genres')
    .not('preferred_genres', 'eq', '{}');
  if (prefsErr) throw prefsErr;

  for (const u of prefs ?? []) {
    const genres = (u as { preferred_genres?: string[] }).preferred_genres;
    if (Array.isArray(genres) && genres.length > 0) {
      ids.add((u as { user_id: string }).user_id);
    }
  }

  // Also refresh expired caches
  const { data: expired } = await sb
    .from('user_recommendations')
    .select('user_id')
    .lt('expires_at', new Date().toISOString());
  for (const row of expired ?? []) {
    ids.add((row as { user_id: string }).user_id);
  }

  return [...ids];
}

async function main(): Promise<void> {
  await markJob('refresh-recs', {
    status: 'running',
    started_at: new Date().toISOString(),
    last_error: null,
  });

  try {
    const userIds = await listUserIdsToRefresh();
    let ok = 0;
    let failed = 0;
    for (const userId of userIds) {
      try {
        const result = await generateForUser(userId, { force: false });
        console.log(
          `[refresh] ${userId} items=${result.items.length} skipped=${result.skipped}`,
        );
        ok += 1;
      } catch (err) {
        failed += 1;
        console.warn(`[refresh] failed ${userId}`, err);
      }
    }

    await markJob('refresh-recs', {
      status: 'idle',
      finished_at: new Date().toISOString(),
      cursor: { users: userIds.length, ok, failed },
    });
  } catch (err) {
    await markJob('refresh-recs', {
      status: 'error',
      last_error: err instanceof Error ? err.message : String(err),
      finished_at: new Date().toISOString(),
    });
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
