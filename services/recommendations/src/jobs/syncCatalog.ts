import { syncJikanCatalog } from '../catalog/jikanSync.js';
import { syncTmdbCatalog } from '../catalog/tmdbSync.js';
import { markJob } from '../lib/supabase.js';
import { embedPendingCatalog } from './embedCatalog.js';

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');

  await markJob('sync-catalog', {
    status: 'running',
    started_at: new Date().toISOString(),
    last_error: null,
  });

  try {
    const jikan = await syncJikanCatalog({ reset });
    const tmdb = await syncTmdbCatalog({ reset });
    console.log('[sync-catalog] upserted', {
      jikan: jikan.upserted,
      tmdb: tmdb.upserted,
      skipped: tmdb.skipped,
    });

    // Embed is best-effort local MiniLM — metadata sync already succeeded
    let embedded: { embedded: number; error?: string } = { embedded: 0 };
    try {
      embedded = await embedPendingCatalog(2000);
      console.log('[sync-catalog] embedded', embedded);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        '[sync-catalog] embed failed after metadata sync. Fix and run: npm run embed-catalog\n',
        message,
      );
      embedded = { embedded: 0, error: message };
    }

    await markJob('sync-catalog', {
      status: 'idle',
      finished_at: new Date().toISOString(),
      cursor: { jikan: jikan.cursor, tmdb: tmdb.cursor },
      last_error: embedded.error ?? null,
    });
  } catch (err) {
    await markJob('sync-catalog', {
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
