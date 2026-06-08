/** MAL genre ID → Memora genre name */
export const MAL_TO_MEMORA: Record<number, string> = {
  1: 'Action',
  2: 'Action',
  4: 'Comedy',
  8: 'Drama',
  10: 'Fantasy',
  14: 'Horror',
  22: 'Romance',
  24: 'Sci-Fi',
  36: 'Drama',
  37: 'Drama',
  40: 'Horror',
  41: 'Thriller',
  7: 'Mystery',
};

/** Memora genre name → MAL genre IDs (best match) */
export const MEMORA_TO_MAL: Record<string, number[]> = {
  Action: [1],
  Comedy: [4],
  Drama: [8],
  'Sci-Fi': [24],
  Fantasy: [10],
  Horror: [14, 40],
  Romance: [22],
  Thriller: [41],
  Mystery: [7],
  Animation: [10],
  Historical: [13],
};

export function malGenresToMemora(malGenreIds: number[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of malGenreIds) {
    const name = MAL_TO_MEMORA[id];
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}

export function memoraGenresToMal(genres: string[]): number[] {
  const ids = new Set<number>();
  for (const genre of genres) {
    const malIds = MEMORA_TO_MAL[genre];
    if (malIds) {
      for (const id of malIds) ids.add(id);
    }
  }
  return [...ids];
}
