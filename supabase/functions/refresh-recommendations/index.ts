import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.6';

/**
 * Free on-demand recs: preference vector from catalog embeddings + pgvector + template reasons.
 * Each cited "Because you liked X" pick is same media type as X and nearest to X's embedding.
 */

const HIGH_RATING = 4;
const CANDIDATE_LIMIT = 80;
const FINAL_PICKS = 4;
const TTL_HOURS = 24;
const PER_SEED_MATCH = 24;

type CatalogMediaType = 'anime' | 'manga' | 'movie' | 'tv';
type AdminClient = ReturnType<typeof createClient>;

type Liked = {
  title: string;
  type: string;
  rating: number;
  genres: string[];
  link: string | null;
};

function mapLikeType(type: string): CatalogMediaType | null {
  const t = type.trim().toLowerCase();
  if (t === 'anime') return 'anime';
  if (t === 'manga' || t === 'comic' || t === 'manhwa' || t === 'manhua' || t === 'light novel') {
    return 'manga';
  }
  if (t === 'movie') return 'movie';
  if (t === 'tv' || t === 'show' || t === 'series') return 'tv';
  return null;
}

function genreOverlap(row: Record<string, unknown>, seed: Liked): number {
  const seedGenres = new Set(seed.genres.map((g) => g.toLowerCase()));
  return ((row.genres as string[]) ?? []).filter((g) => seedGenres.has(g.toLowerCase())).length;
}

function sharedGenre(row: Record<string, unknown>, seed: Liked): string | undefined {
  return ((row.genres as string[]) ?? []).find((g) =>
    seed.genres.some((lg) => lg.toLowerCase() === g.toLowerCase()),
  );
}

function sameMediaType(row: Record<string, unknown>, seed: Liked): boolean {
  const seedType = mapLikeType(seed.type);
  if (!seedType) return false;
  return String(row.media_type) === seedType;
}

/** Rotate across many high-rated likes (not always the same top title). */
function pickDiverseSeeds(likes: Liked[], count: number): Liked[] {
  if (likes.length === 0) return [];
  const ranked = shuffle(
    [...likes].sort((a, b) => b.rating - a.rating || Math.random() - 0.5),
  );
  const selected: Liked[] = [];
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

function reasonFor(
  row: Record<string, unknown>,
  seed: Liked | null,
  preferredGenres: string[],
): string {
  if (seed && sameMediaType(row, seed)) {
    const genre = sharedGenre(row, seed);
    if (genre) return `Because you liked ${seed.title} and enjoy ${genre}`;
    return `Because you liked ${seed.title}`;
  }
  if (preferredGenres[0]) return `Popular pick for fans of ${preferredGenres[0]}`;
  return 'A popular pick for your taste profile';
}

function pickFromTop<T>(arr: T[], window = 5): T | null {
  if (arr.length === 0) return null;
  const top = arr.slice(0, Math.min(window, arr.length));
  return top[Math.floor(Math.random() * top.length)];
}

/** Only cite a like of the same media type — never cross-type. */
function bestLikeFor(row: Record<string, unknown>, likes: Liked[]): Liked | null {
  const sameType = likes.filter((l) => sameMediaType(row, l));
  if (sameType.length === 0) return null;
  return [...sameType].sort((a, b) => {
    const overlapDiff = genreOverlap(row, b) - genreOverlap(row, a);
    if (overlapDiff !== 0) return overlapDiff;
    return b.rating - a.rating;
  })[0];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function fingerprint(
  likes: { title: string; rating: number; type: string }[],
  preferredGenres: string[],
  preferredMediaTypes: string[] = [],
): Promise<string> {
  const likePart = likes
    .map((l) => `${normalizeTitle(l.title)}:${l.rating}:${l.type}`)
    .sort()
    .join(';');
  const genrePart = [...preferredGenres].map((g) => g.toLowerCase()).sort().join(',');
  const typePart = [...preferredMediaTypes].map((t) => t.toLowerCase()).sort().join(',');
  const data = new TextEncoder().encode(`${likePart}|${genrePart}|${typePart}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function preferredCatalogTypes(preferredMediaTypes: string[]): CatalogMediaType[] {
  const out: CatalogMediaType[] = [];
  const seen = new Set<CatalogMediaType>();
  for (const raw of preferredMediaTypes) {
    const t = mapLikeType(raw);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.length > 0 ? out : ['anime', 'manga', 'movie', 'tv'];
}

function average(vectors: { values: number[]; weight: number }[]): number[] {
  const dim = vectors[0].values.length;
  const out = new Array(dim).fill(0);
  let w = 0;
  for (const v of vectors) {
    w += v.weight;
    for (let i = 0; i < dim; i++) out[i] += v.values[i] * v.weight;
  }
  return out.map((x) => x / w);
}

function formatLabel(mediaType: unknown): string {
  switch (String(mediaType)) {
    case 'anime':
      return 'ANIME';
    case 'manga':
      return 'MANGA';
    case 'movie':
      return 'MOVIE';
    case 'tv':
      return 'TV';
    default:
      return String(mediaType).toUpperCase();
  }
}

async function resolveLikeEmbedding(
  admin: AdminClient,
  like: Liked,
): Promise<number[] | null> {
  const mal = like.link?.match(/myanimelist\.net\/(anime|manga)\/(\d+)/i);
  const tmdb = like.link?.match(/themoviedb\.org\/(movie|tv)\/(\d+)/i);
  if (mal) {
    const { data } = await admin
      .from('media_catalog')
      .select('embedding')
      .eq('source', 'jikan')
      .eq('external_id', mal[2])
      .eq('media_type', mal[1].toLowerCase() === 'manga' ? 'manga' : 'anime')
      .not('embedding', 'is', null)
      .maybeSingle();
    if (data?.embedding) return data.embedding as number[];
  } else if (tmdb) {
    const mediaType = tmdb[1].toLowerCase() === 'tv' ? 'tv' : 'movie';
    const { data } = await admin
      .from('media_catalog')
      .select('embedding')
      .in('source', ['tmdb', 'movie_ratings'])
      .eq('external_id', tmdb[2])
      .eq('media_type', mediaType)
      .not('embedding', 'is', null)
      .maybeSingle();
    if (data?.embedding) return data.embedding as number[];
  }

  const mediaType = mapLikeType(like.type);
  let q = admin
    .from('media_catalog')
    .select('embedding')
    .ilike('title', like.title.trim())
    .not('embedding', 'is', null)
    .limit(1);
  if (mediaType) q = q.eq('media_type', mediaType);
  const { data } = await q.maybeSingle();
  if (data?.embedding) return data.embedding as number[];
  return null;
}

function rankAgainstSeed(
  candidates: Array<Record<string, unknown>>,
  seed: Liked,
): Array<Record<string, unknown>> {
  return [...candidates].sort((a, b) => {
    const distA = Number(a.distance ?? 1);
    const distB = Number(b.distance ?? 1);
    const scoreA = distA - Math.min(genreOverlap(a, seed), 3) * 0.015;
    const scoreB = distB - Math.min(genreOverlap(b, seed), 3) * 0.015;
    return scoreA - scoreB;
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const force = Boolean(body.force);
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: mediaRows } = await admin
      .from('media')
      .select('title, type, rating, genres, link')
      .eq('user_id', user.id)
      .gt('rating', HIGH_RATING);

    const liked = (mediaRows ?? []).map((r) => ({
      title: String(r.title),
      type: String(r.type),
      rating: Number(r.rating ?? 0),
      genres: (r.genres as string[]) ?? [],
      link: (r.link as string | null) ?? null,
    }));

    const { data: userRow } = await admin
      .from('users')
      .select('preferred_genres, preferred_media_types')
      .eq('user_id', user.id)
      .maybeSingle();
    const preferredGenres = (userRow?.preferred_genres as string[]) ?? [];
    const preferredMediaTypes = (userRow?.preferred_media_types as string[]) ?? [];
    const typeFilter = preferredCatalogTypes(preferredMediaTypes);
    const fp = await fingerprint(liked, preferredGenres, preferredMediaTypes);

    if (!force) {
      const { data: cached } = await admin
        .from('user_recommendations')
        .select('items, expires_at, input_fingerprint')
        .eq('user_id', user.id)
        .maybeSingle();
      if (
        cached &&
        cached.input_fingerprint === fp &&
        cached.expires_at &&
        new Date(cached.expires_at).getTime() > Date.now() &&
        Array.isArray(cached.items) &&
        (cached.items as unknown[]).length > 0
      ) {
        return new Response(JSON.stringify({ items: cached.items, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const vectors: { values: number[]; weight: number }[] = [];
    const likeEmbeddings = new Map<string, number[]>();
    for (const like of liked) {
      const emb = await resolveLikeEmbedding(admin, like);
      if (emb) {
        vectors.push({ values: emb, weight: like.rating });
        likeEmbeddings.set(`${normalizeTitle(like.title)}:${like.type}`, emb);
      }
    }

    const { data: allTitles } = await admin.from('media').select('title').eq('user_id', user.id);
    const exclude = (allTitles ?? []).map((t) => normalizeTitle(String(t.title)));

    let previousIds: string[] = [];
    if (force) {
      const { data: prev } = await admin
        .from('user_recommendations')
        .select('items')
        .eq('user_id', user.id)
        .maybeSingle();
      previousIds = ((prev?.items as { catalog_id?: string }[]) ?? [])
        .map((i) => i.catalog_id)
        .filter((id): id is string => Boolean(id));
    }

    let pool: Array<Record<string, unknown>> = [];

    if (vectors.length > 0) {
      const preference = average(vectors);
      const seen = new Set<string>();
      for (const mediaType of typeFilter) {
        const { data, error } = await admin.rpc('match_media_catalog', {
          query_embedding: preference,
          match_count: CANDIDATE_LIMIT,
          filter_types: [mediaType],
          exclude_titles: exclude,
          exclude_ids: previousIds.length > 0 ? previousIds : null,
        });
        if (error) continue;
        for (const row of data ?? []) {
          const id = String(row.id);
          if (!seen.has(id)) {
            seen.add(id);
            pool.push(row);
          }
        }
      }
      pool.sort((a, b) => Number(a.distance ?? 0) - Number(b.distance ?? 0));
      pool = pool.slice(0, 100);
    }

    if (pool.length < FINAL_PICKS) {
      const genres =
        preferredGenres.length > 0
          ? preferredGenres
          : liked.flatMap((l) => l.genres).slice(0, 5);
      const seen = new Set(pool.map((r) => String(r.id)));

      let q = admin
        .from('media_catalog')
        .select(
          'id, source, external_id, media_type, title, synopsis, genres, image_url, external_url, metadata',
        )
        .in('media_type', typeFilter)
        .limit(100);
      if (genres.length > 0) q = q.overlaps('genres', genres);
      const { data } = await q;
      for (const row of shuffle(data ?? [])) {
        if (exclude.includes(normalizeTitle(String(row.title)))) continue;
        if (seen.has(String(row.id))) continue;
        seen.add(String(row.id));
        pool.push(row);
      }

      if (pool.length < FINAL_PICKS) {
        const { data: byType } = await admin
          .from('media_catalog')
          .select(
            'id, source, external_id, media_type, title, synopsis, genres, image_url, external_url, metadata',
          )
          .in('media_type', typeFilter)
          .limit(100);
        for (const row of shuffle(byType ?? [])) {
          if (exclude.includes(normalizeTitle(String(row.title)))) continue;
          if (seen.has(String(row.id))) continue;
          seen.add(String(row.id));
          pool.push(row);
        }
      }
    }

    const prevSet = new Set(previousIds);
    let workingPool = pool.filter((c) => !prevSet.has(String(c.id)));
    if (workingPool.length < FINAL_PICKS) workingPool = pool;

    const seeds = pickDiverseSeeds(liked, FINAL_PICKS);
    const picks: Array<{ row: Record<string, unknown>; seed: Liked | null }> = [];
    const pickIds = new Set<string>();

    // Per-seed nearest neighbors of the same media type (citation must match type + similarity)
    for (const seed of seeds) {
      if (picks.length >= FINAL_PICKS) break;
      const seedType = mapLikeType(seed.type);
      if (!seedType) continue;

      const embKey = `${normalizeTitle(seed.title)}:${seed.type}`;
      const emb = likeEmbeddings.get(embKey) ?? (await resolveLikeEmbedding(admin, seed));
      if (emb && !likeEmbeddings.has(embKey)) likeEmbeddings.set(embKey, emb);

      let typed: Array<Record<string, unknown>> = [];
      if (emb) {
        const excludeIds = [...previousIds, ...pickIds];
        const { data, error } = await admin.rpc('match_media_catalog', {
          query_embedding: emb,
          match_count: PER_SEED_MATCH,
          filter_types: [seedType],
          exclude_titles: exclude,
          exclude_ids: excludeIds.length > 0 ? excludeIds : null,
        });
        if (!error && data) {
          typed = (data as Array<Record<string, unknown>>).filter(
            (c) => !pickIds.has(String(c.id)),
          );
        }
      }

      if (typed.length === 0) {
        typed = workingPool.filter(
          (c) => !pickIds.has(String(c.id)) && String(c.media_type) === seedType,
        );
      }

      if (typed.length === 0) continue; // never cite this seed for a different media type

      typed = rankAgainstSeed(typed, seed);
      const chosen = pickFromTop(typed, 5);
      if (!chosen) continue;
      pickIds.add(String(chosen.id));
      picks.push({ row: chosen, seed });
    }

    // Pad remaining slots — cite only same-type likes
    if (picks.length < FINAL_PICKS) {
      const remaining = [...workingPool]
        .filter((c) => !pickIds.has(String(c.id)))
        .sort((a, b) => Number(a.distance ?? 1) - Number(b.distance ?? 1));
      for (const row of remaining) {
        if (picks.length >= FINAL_PICKS) break;
        pickIds.add(String(row.id));
        picks.push({ row, seed: bestLikeFor(row, liked) });
      }
    }
    if (picks.length < FINAL_PICKS) {
      for (const row of pool) {
        if (picks.length >= FINAL_PICKS) break;
        const id = String(row.id);
        if (pickIds.has(id)) continue;
        pickIds.add(id);
        picks.push({ row, seed: bestLikeFor(row, liked) });
      }
    }

    const items = picks.map(({ row, seed }) => {
      const cite = seed && sameMediaType(row, seed) ? seed : bestLikeFor(row, liked);
      return {
        catalog_id: row.id,
        title: row.title,
        media_type: row.media_type,
        image_url: row.image_url,
        link: row.external_url,
        genres: row.genres ?? [],
        source: row.source,
        external_id: row.external_id,
        reason: reasonFor(row, cite, preferredGenres),
        source_likes: cite ? [cite.title] : [],
        format_label: formatLabel(row.media_type),
      };
    });

    if (items.length > 0) {
      await admin.from('user_recommendations').upsert({
        user_id: user.id,
        items,
        candidate_ids: pool.map((c) => c.id),
        input_fingerprint: fp,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + TTL_HOURS * 3600 * 1000).toISOString(),
      });
    }

    return new Response(JSON.stringify({ items, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
