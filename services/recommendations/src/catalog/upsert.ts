import type { CatalogUpsertRow } from '../types.js';
import { getServiceClient } from '../lib/supabase.js';

/** Upsert catalog rows; null embedding when content_hash changes so re-embed runs. */
export async function upsertCatalogRows(rows: CatalogUpsertRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const sb = getServiceClient();

  // One row per (source, external_id) — Postgres rejects duplicate targets in one upsert.
  const deduped = [
    ...new Map(rows.map((r) => [`${r.source}:${r.external_id}`, r] as const)).values(),
  ];

  const sources = [...new Set(deduped.map((r) => r.source))];
  const externalIds = deduped.map((r) => r.external_id);

  const { data: existing, error: exErr } = await sb
    .from('media_catalog')
    .select('source, external_id, content_hash')
    .in('source', sources)
    .in('external_id', externalIds);
  if (exErr) throw exErr;

  const hashMap = new Map(
    (existing ?? []).map((r: { source: string; external_id: string; content_hash: string | null }) => [
      `${r.source}:${r.external_id}`,
      r.content_hash,
    ]),
  );

  const finalPayload = deduped.map((r) => {
    const prev = hashMap.get(`${r.source}:${r.external_id}`);
    const hashChanged = prev != null && prev !== r.content_hash;
    if (hashChanged) {
      return {
        ...r,
        embedding: null,
        embedded_at: null,
        updated_at: new Date().toISOString(),
      };
    }
    return {
      source: r.source,
      external_id: r.external_id,
      media_type: r.media_type,
      title: r.title,
      synopsis: r.synopsis,
      genres: r.genres,
      image_url: r.image_url,
      external_url: r.external_url,
      metadata: r.metadata,
      content_hash: r.content_hash,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await sb.from('media_catalog').upsert(finalPayload, {
    onConflict: 'source,external_id',
  });
  if (error) throw error;
  return deduped.length;
}
