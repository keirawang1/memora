import type { DiscoveryItem } from '../types/discovery';
import { normalizePrintMediaType } from './printMediaTypes';

/**
 * Offline fallback when Jikan manga endpoints fail.
 * Covers use verified AniList CDN URLs (MAL image paths rotate / 404 often).
 */
export const MANGA_FALLBACK_CATALOG: DiscoveryItem[] = [
  {
    id: 'mal-manga-13',
    externalId: 13,
    source: 'jikan',
    title: 'One Piece',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30013-BeslEMqiPhlk.jpg',
    type: 'manga',
    genres: ['Action', 'Adventure', 'Fantasy'],
    link: 'https://myanimelist.net/manga/13',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-2',
    externalId: 2,
    source: 'jikan',
    title: 'Berserk',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30002-Cul4OeN7bYtn.jpg',
    type: 'manga',
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy', 'Horror'],
    link: 'https://myanimelist.net/manga/2',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-116778',
    externalId: 116778,
    source: 'jikan',
    title: 'Chainsaw Man',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx105778-euxXZEIfDY2u.png',
    type: 'manga',
    genres: ['Action', 'Comedy', 'Horror'],
    link: 'https://myanimelist.net/manga/116778',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-113138',
    externalId: 113138,
    source: 'jikan',
    title: 'Jujutsu Kaisen',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx101517-H3TdM3g5ZUe9.jpg',
    type: 'manga',
    genres: ['Action', 'Fantasy'],
    link: 'https://myanimelist.net/manga/113138',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-23390',
    externalId: 23390,
    source: 'jikan',
    title: 'Attack on Titan',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx53390-1RsuABC34P9D.jpg',
    type: 'manga',
    genres: ['Action', 'Drama', 'Fantasy'],
    link: 'https://myanimelist.net/manga/23390',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-96792',
    externalId: 96792,
    source: 'jikan',
    title: 'Demon Slayer: Kimetsu no Yaiba',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx87216-c9bSNVD10UuD.png',
    type: 'manga',
    genres: ['Action', 'Supernatural'],
    link: 'https://myanimelist.net/manga/96792',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-656',
    externalId: 656,
    source: 'jikan',
    title: 'Vagabond',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30656-9mW113O7rDnA.png',
    type: 'manga',
    genres: ['Action', 'Adventure', 'Drama'],
    link: 'https://myanimelist.net/manga/656',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-4632',
    externalId: 4632,
    source: 'jikan',
    title: 'Goodnight Punpun',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx34632-5xMDkx3pXsEh.png',
    type: 'manga',
    genres: ['Drama', 'Slice of Life'],
    link: 'https://myanimelist.net/manga/4632',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-104281',
    externalId: 104281,
    source: 'jikan',
    title: 'SPY×FAMILY',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx108556-NHjkz0BNJhLx.jpg',
    type: 'manga',
    genres: ['Action', 'Comedy'],
    link: 'https://myanimelist.net/manga/104281',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-103705',
    externalId: 103705,
    source: 'jikan',
    title: 'Tokyo Ghoul',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx63327-glC9cDxYBja9.png',
    type: 'manga',
    genres: ['Action', 'Drama', 'Horror', 'Supernatural'],
    link: 'https://myanimelist.net/manga/103705',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-6978',
    externalId: 6978,
    source: 'jikan',
    title: 'Vinland Saga',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30642-0mjRDkf4THpo.jpg',
    type: 'manga',
    genres: ['Action', 'Adventure', 'Drama'],
    link: 'https://myanimelist.net/manga/6978',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-44347',
    externalId: 44347,
    source: 'jikan',
    title: 'One-Punch Man',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx74347-sZpmNJ5xLwRK.jpg',
    type: 'manga',
    genres: ['Action', 'Comedy'],
    link: 'https://myanimelist.net/manga/44347',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-75989',
    externalId: 75989,
    source: 'jikan',
    title: 'My Hero Academia',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx85486-INqnYx8gL3eX.jpg',
    type: 'manga',
    genres: ['Action', 'Comedy'],
    link: 'https://myanimelist.net/manga/75989',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-12',
    externalId: 12,
    source: 'jikan',
    title: 'Bleach',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30012-1epmVfTSv2rr.png',
    type: 'manga',
    genres: ['Action', 'Adventure', 'Supernatural'],
    link: 'https://myanimelist.net/manga/12',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-121269',
    externalId: 121269,
    source: 'jikan',
    title: 'Blue Lock',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx106130-yPNeuSu75ey1.jpg',
    type: 'manga',
    genres: ['Action', 'Drama'],
    link: 'https://myanimelist.net/manga/121269',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-90125',
    externalId: 90125,
    source: 'jikan',
    title: 'Kaguya-sama: Love is War',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx86635-EdaLQmsn86Fy.png',
    type: 'manga',
    genres: ['Comedy', 'Romance'],
    link: 'https://myanimelist.net/manga/90125',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-45757',
    externalId: 45757,
    source: 'jikan',
    title: 'Horimiya',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx72451-vVXtRwyttjGG.png',
    type: 'manga',
    genres: ['Comedy', 'Romance'],
    link: 'https://myanimelist.net/manga/45757',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-100646',
    externalId: 100646,
    source: 'jikan',
    title: 'The Promised Neverland',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx87423-gPNtu8QbGped.jpg',
    type: 'manga',
    genres: ['Fantasy', 'Mystery', 'Thriller'],
    link: 'https://myanimelist.net/manga/100646',
    formatLabel: 'MANGA',
  },
  {
    id: 'mal-manga-121496',
    externalId: 121496,
    source: 'jikan',
    title: 'Solo Leveling',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx105398-b673Vt5ZSuz3.jpg',
    type: 'manhwa',
    genres: ['Action', 'Adventure', 'Fantasy'],
    link: 'https://myanimelist.net/manga/121496',
    formatLabel: 'MANHWA',
  },
  {
    id: 'mal-manga-139029',
    externalId: 139029,
    source: 'jikan',
    title: 'Omniscient Reader',
    imageUrl:
      'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx119257-Pi21aq3ey9GG.jpg',
    type: 'manhwa',
    genres: ['Action', 'Adventure', 'Fantasy'],
    link: 'https://myanimelist.net/manga/139029',
    formatLabel: 'MANHWA',
  },
];

/** Prefer matching preferred types first, then fill with the rest. */
export function getMangaFallbackPool(
  limit = 25,
  preferredTypes: string[] = [],
): DiscoveryItem[] {
  const preferred = new Set(preferredTypes.map(normalizePrintMediaType));
  const preferredItems: DiscoveryItem[] = [];
  const rest: DiscoveryItem[] = [];
  const seenTitles = new Set<string>();

  for (const item of MANGA_FALLBACK_CATALOG) {
    const titleKey = item.title.trim().toLowerCase();
    if (seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);

    const key = normalizePrintMediaType(item.type);
    if (preferred.size > 0 && preferred.has(key)) preferredItems.push(item);
    else rest.push(item);
  }

  return [...preferredItems, ...rest].slice(0, limit);
}
