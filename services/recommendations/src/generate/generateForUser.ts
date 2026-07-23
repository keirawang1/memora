import { getServiceClient } from '../lib/supabase.js';
import { fingerprintLikes } from '../lib/utils.js';
import { REC_TTL_HOURS, CANDIDATE_LIMIT } from '../types.js';
import {
  buildPreferenceVector,
  fetchCandidates,
  loadLibraryTitles,
  loadLikedItems,
  loadPreferredGenres,
} from './candidates.js';
import { rankCandidates } from './rank.js';
import type { RecommendationItem } from '../types.js';

export interface GenerateResult {
  items: RecommendationItem[];
  candidateIds: string[];
  fingerprint: string;
  skipped: boolean;
  reason?: string;
}

export async function generateForUser(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<GenerateResult> {
  const sb = getServiceClient();
  const likes = await loadLikedItems(userId);
  const preferredGenres = await loadPreferredGenres(userId);
  const fingerprint = fingerprintLikes(likes, preferredGenres);

  if (!opts.force) {
    const { data: existing } = await sb
      .from('user_recommendations')
      .select('items, candidate_ids, input_fingerprint, expires_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (
      existing &&
      existing.input_fingerprint === fingerprint &&
      existing.expires_at &&
      new Date(existing.expires_at).getTime() > Date.now()
    ) {
      return {
        items: (existing.items as RecommendationItem[]) ?? [],
        candidateIds: (existing.candidate_ids as string[]) ?? [],
        fingerprint,
        skipped: true,
        reason: 'cache_hit',
      };
    }
  }

  const excludeTitles = await loadLibraryTitles(userId);
  let excludeIds: string[] = [];
  if (opts.force) {
    const { data: prev } = await sb
      .from('user_recommendations')
      .select('items')
      .eq('user_id', userId)
      .maybeSingle();
    excludeIds = ((prev?.items as { catalog_id?: string }[]) ?? [])
      .map((i) => i.catalog_id)
      .filter((id): id is string => Boolean(id));
  }
  const preference = await buildPreferenceVector(likes, preferredGenres);
  const candidates = await fetchCandidates(preference, excludeTitles, CANDIDATE_LIMIT, excludeIds);
  const items = await rankCandidates(candidates, likes, { excludeIds, excludeTitles });
  const candidateIds = candidates.map((c) => c.id);

  const expires = new Date(Date.now() + REC_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { error } = await sb.from('user_recommendations').upsert(
    {
      user_id: userId,
      items,
      candidate_ids: candidateIds,
      input_fingerprint: fingerprint,
      generated_at: new Date().toISOString(),
      expires_at: expires,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;

  return { items, candidateIds, fingerprint, skipped: false };
}
