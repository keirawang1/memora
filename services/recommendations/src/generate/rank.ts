import type { CandidateRow, CatalogMediaType, LikedItem, RecommendationItem } from '../types.js';
import { FINAL_PICK_COUNT } from '../types.js';
import { formatLabel, normalizeTitle } from '../lib/utils.js';
import { getServiceClient } from '../lib/supabase.js';

const PER_SEED_MATCH = 24;

export function mapLikeType(type: string): CatalogMediaType | null {
  const t = type.trim().toLowerCase();
  if (t === 'anime') return 'anime';
  if (t === 'manga' || t === 'comic' || t === 'manhwa' || t === 'manhua' || t === 'light novel') {
    return 'manga';
  }
  if (t === 'movie') return 'movie';
  if (t === 'tv' || t === 'show' || t === 'series') return 'tv';
  return null;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function genreOverlap(row: CandidateRow, seed: LikedItem): number {
  const seedGenres = new Set(seed.genres.map((g) => g.toLowerCase()));
  return (row.genres ?? []).filter((g) => seedGenres.has(g.toLowerCase())).length;
}

function sharedGenre(row: CandidateRow, seed: LikedItem): string | undefined {
  return (row.genres ?? []).find((g) =>
    seed.genres.some((lg) => lg.toLowerCase() === g.toLowerCase()),
  );
}

function sameMediaType(row: CandidateRow, seed: LikedItem): boolean {
  const seedType = mapLikeType(seed.type);
  if (!seedType) return false;
  return row.media_type === seedType;
}

/** Rotate across many high-rated likes (not always the same top title). */
export function pickDiverseSeeds(likes: LikedItem[], count: number): LikedItem[] {
  if (likes.length === 0) return [];
  const ranked = shuffle(
    [...likes].sort((a, b) => b.rating - a.rating || Math.random() - 0.5),
  );
  const selected: LikedItem[] = [];
  const usedTitles = new Set<string>();
  const usedTypes = new Set<string>();

  for (const like of ranked) {
    if (selected.length >= count) break;
    const key = normalizeTitle(like.title);
    const t = mapLikeType(like.type) ?? like.type;
    if (usedTitles.has(key) || usedTypes.has(t)) continue;
    usedTitles.add(key);
    usedTypes.add(t);
    selected.push(like);
  }

  for (const like of ranked) {
    if (selected.length >= count) break;
    const key = normalizeTitle(like.title);
    if (usedTitles.has(key)) continue;
    usedTitles.add(key);
    selected.push(like);
  }

  let i = 0;
  while (selected.length < count && likes.length > 0) {
    selected.push(likes[i % likes.length]);
    i += 1;
  }
  return selected;
}

function bestLikeFor(row: CandidateRow, likes: LikedItem[]): LikedItem | null {
  const sameType = likes.filter((l) => sameMediaType(row, l));
  if (sameType.length === 0) return null;
  return [...sameType].sort((a, b) => {
    const overlapDiff = genreOverlap(row, b) - genreOverlap(row, a);
    if (overlapDiff !== 0) return overlapDiff;
    return b.rating - a.rating;
  })[0];
}

function reasonFor(row: CandidateRow, seed: LikedItem | null): string {
  if (seed && sameMediaType(row, seed)) {
    const genre = sharedGenre(row, seed);
    if (genre) return `Because you liked ${seed.title} and enjoy ${genre}`;
    return `Because you liked ${seed.title}`;
  }
  return 'A strong match for your taste profile';
}

function pickFromTop<T>(arr: T[], window = 5): T | null {
  if (arr.length === 0) return null;
  const top = arr.slice(0, Math.min(window, arr.length));
  return top[Math.floor(Math.random() * top.length)];
}

function rankAgainstSeed(candidates: CandidateRow[], seed: LikedItem): CandidateRow[] {
  return [...candidates].sort((a, b) => {
    const scoreA = a.distance - Math.min(genreOverlap(a, seed), 3) * 0.015;
    const scoreB = b.distance - Math.min(genreOverlap(b, seed), 3) * 0.015;
    return scoreA - scoreB;
  });
}

function parseExternalIdFromLink(link: string | null): {
  source: string;
  id: string;
  mediaType?: CatalogMediaType;
} | null {
  if (!link) return null;
  const malAnime = link.match(/myanimelist\.net\/anime\/(\d+)/i);
  if (malAnime) return { source: 'jikan', id: malAnime[1], mediaType: 'anime' };
  const malManga = link.match(/myanimelist\.net\/manga\/(\d+)/i);
  if (malManga) return { source: 'jikan', id: malManga[1], mediaType: 'manga' };
  const tmdb = link.match(/themoviedb\.org\/(movie|tv)\/(\d+)/i);
  if (tmdb) {
    return {
      source: 'tmdb',
      id: tmdb[2],
      mediaType: tmdb[1].toLowerCase() === 'tv' ? 'tv' : 'movie',
    };
  }
  return null;
}

async function resolveLikeEmbedding(like: LikedItem): Promise<number[] | null> {
  const sb = getServiceClient();
  const parsed = parseExternalIdFromLink(like.link);
  if (parsed) {
    let query = sb
      .from('media_catalog')
      .select('embedding')
      .eq('external_id', parsed.id)
      .not('embedding', 'is', null);
    if (parsed.source === 'tmdb') {
      query = query.in('source', ['tmdb', 'movie_ratings']);
    } else {
      query = query.eq('source', parsed.source);
    }
    if (parsed.mediaType) query = query.eq('media_type', parsed.mediaType);
    const { data } = await query.limit(1).maybeSingle();
    if (data?.embedding) return data.embedding as number[];
  }

  const mediaType = mapLikeType(like.type);
  let query = sb
    .from('media_catalog')
    .select('embedding')
    .ilike('title', like.title.trim())
    .not('embedding', 'is', null)
    .limit(1);
  if (mediaType) query = query.eq('media_type', mediaType);
  const { data } = await query.maybeSingle();
  return data?.embedding ? (data.embedding as number[]) : null;
}

async function matchNearSeed(
  embedding: number[],
  seedType: CatalogMediaType,
  excludeTitles: string[],
  excludeIds: string[],
): Promise<CandidateRow[]> {
  const sb = getServiceClient();
  const { data, error } = await sb.rpc('match_media_catalog', {
    query_embedding: embedding,
    match_count: PER_SEED_MATCH,
    filter_types: [seedType],
    exclude_titles: excludeTitles,
    exclude_ids: excludeIds.length > 0 ? excludeIds : null,
  });
  if (error) throw error;
  return (data ?? []) as CandidateRow[];
}

/**
 * Multi-seed ranking: each pick cites a same-type like and is nearest to that like.
 */
export async function rankCandidates(
  candidates: CandidateRow[],
  likes: LikedItem[],
  opts: { excludeIds?: string[]; excludeTitles?: string[] } = {},
): Promise<RecommendationItem[]> {
  if (candidates.length === 0) return [];

  const prevSet = new Set(opts.excludeIds ?? []);
  const excludeTitles = opts.excludeTitles ?? [];
  let working = candidates.filter((c) => !prevSet.has(c.id));
  if (working.length < FINAL_PICK_COUNT) working = candidates;

  const seeds = pickDiverseSeeds(likes, FINAL_PICK_COUNT);
  const selected: Array<{ row: CandidateRow; seed: LikedItem | null }> = [];
  const used = new Set<string>();

  for (const seed of seeds) {
    if (selected.length >= FINAL_PICK_COUNT) break;
    const seedType = mapLikeType(seed.type);
    if (!seedType) continue;

    let typed: CandidateRow[] = [];
    const emb = await resolveLikeEmbedding(seed);
    if (emb) {
      const near = await matchNearSeed(emb, seedType, excludeTitles, [
        ...prevSet,
        ...used,
      ]);
      typed = near.filter((c) => !used.has(c.id));
    }
    if (typed.length === 0) {
      typed = working.filter((c) => !used.has(c.id) && c.media_type === seedType);
    }
    if (typed.length === 0) continue;

    typed = rankAgainstSeed(typed, seed);
    const chosen = pickFromTop(typed, 5);
    if (!chosen) continue;
    used.add(chosen.id);
    selected.push({ row: chosen, seed });
  }

  if (selected.length < FINAL_PICK_COUNT) {
    for (const c of [...working]
      .filter((row) => !used.has(row.id))
      .sort((a, b) => a.distance - b.distance)) {
      if (selected.length >= FINAL_PICK_COUNT) break;
      used.add(c.id);
      selected.push({ row: c, seed: bestLikeFor(c, likes) });
    }
  }
  if (selected.length < FINAL_PICK_COUNT) {
    for (const c of candidates) {
      if (selected.length >= FINAL_PICK_COUNT) break;
      if (used.has(c.id)) continue;
      used.add(c.id);
      selected.push({ row: c, seed: bestLikeFor(c, likes) });
    }
  }

  return selected.map(({ row, seed }) => {
    const cite = seed && sameMediaType(row, seed) ? seed : bestLikeFor(row, likes);
    return {
      catalog_id: row.id,
      title: row.title,
      media_type: row.media_type,
      image_url: row.image_url,
      link: row.external_url,
      genres: row.genres ?? [],
      source: row.source,
      external_id: row.external_id,
      reason: reasonFor(row, cite),
      source_likes: cite ? [cite.title] : [],
      format_label: formatLabel(row.media_type),
    };
  });
}
