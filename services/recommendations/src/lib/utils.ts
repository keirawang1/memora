import { createHash } from 'node:crypto';

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function contentHash(parts: {
  title: string;
  synopsis: string | null;
  genres: string[];
  media_type: string;
}): string {
  const payload = [
    parts.media_type,
    parts.title.trim(),
    (parts.synopsis ?? '').trim(),
    [...parts.genres].map((g) => g.trim().toLowerCase()).sort().join(','),
  ].join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

export function fingerprintLikes(
  likes: { title: string; rating: number; type: string }[],
  preferredGenres: string[],
): string {
  const likePart = likes
    .map((l) => `${normalizeTitle(l.title)}:${l.rating}:${l.type}`)
    .sort()
    .join(';');
  const genrePart = [...preferredGenres].map((g) => g.toLowerCase()).sort().join(',');
  return createHash('sha256').update(`${likePart}|${genrePart}`).digest('hex').slice(0, 40);
}

export function formatLabel(mediaType: string): string {
  switch (mediaType) {
    case 'anime':
      return 'ANIME';
    case 'manga':
      return 'MANGA';
    case 'movie':
      return 'MOVIE';
    case 'tv':
      return 'TV';
    default:
      return mediaType.toUpperCase();
  }
}

export function embeddingText(row: {
  title: string;
  media_type: string;
  genres: string[];
  synopsis: string | null;
}): string {
  const genres = row.genres.length > 0 ? row.genres.join(', ') : 'unknown';
  const synopsis = (row.synopsis ?? '').slice(0, 2000);
  return `${row.title} | ${row.media_type} | ${genres} | ${synopsis}`.trim();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function averageVectors(vectors: { values: number[]; weight: number }[]): number[] {
  if (vectors.length === 0) {
    throw new Error('Cannot average empty vector list');
  }
  const dim = vectors[0].values.length;
  const out = new Array<number>(dim).fill(0);
  let totalWeight = 0;
  for (const { values, weight } of vectors) {
    if (values.length !== dim) throw new Error('Vector dimension mismatch');
    totalWeight += weight;
    for (let i = 0; i < dim; i++) out[i] += values[i] * weight;
  }
  if (totalWeight <= 0) throw new Error('Total weight must be positive');
  for (let i = 0; i < dim; i++) out[i] /= totalWeight;
  return out;
}
