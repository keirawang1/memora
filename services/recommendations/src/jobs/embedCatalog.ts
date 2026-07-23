import { getServiceClient, markJob } from '../lib/supabase.js';
import { embeddingText } from '../lib/utils.js';
import { embedTexts } from '../embed/local.js';

const BATCH_SIZE = 16;

interface EmbedRow {
  id: string;
  title: string;
  media_type: string;
  genres: string[];
  synopsis: string | null;
}

/** Free local MiniLM embeddings — no API key / no billing. */
export async function embedPendingCatalog(
  limit = 2000,
): Promise<{ embedded: number }> {
  await markJob('embed-catalog', {
    status: 'running',
    started_at: new Date().toISOString(),
    last_error: null,
  });

  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('media_catalog')
      .select('id, title, media_type, genres, synopsis')
      .is('embedding', null)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data ?? []) as EmbedRow[];
    if (rows.length === 0) {
      await markJob('embed-catalog', {
        status: 'idle',
        finished_at: new Date().toISOString(),
        cursor: { embedded: 0, remaining_hint: 0 },
      });
      return { embedded: 0 };
    }

    console.log(`[embed] local MiniLM — ${rows.length} rows (first run downloads ~23MB model)`);

    let embedded = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const texts = batch.map((r) =>
        embeddingText({
          title: r.title,
          media_type: r.media_type,
          genres: r.genres ?? [],
          synopsis: r.synopsis,
        }),
      );
      const vectors = await embedTexts(texts);

      for (let j = 0; j < batch.length; j++) {
        const { error: upErr } = await sb
          .from('media_catalog')
          .update({
            embedding: vectors[j],
            embedded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', batch[j].id);
        if (upErr) throw upErr;
        embedded += 1;
      }
      console.log(`[embed] ${embedded}/${rows.length}`);
    }

    await markJob('embed-catalog', {
      status: 'idle',
      finished_at: new Date().toISOString(),
      cursor: { embedded, remaining_hint: Math.max(0, rows.length - embedded) },
    });
    return { embedded };
  } catch (err) {
    await markJob('embed-catalog', {
      status: 'error',
      last_error: err instanceof Error ? err.message : String(err),
      finished_at: new Date().toISOString(),
    });
    throw err;
  }
}
