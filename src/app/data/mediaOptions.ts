export const DEFAULT_MEDIA_TYPES = ['movie', 'tv', 'anime', 'comic', 'book'] as const;

export const DEFAULT_GENRES = [
  'Action',
  'Comedy',
  'Drama',
  'Sci-Fi',
  'Fantasy',
  'Horror',
  'Romance',
  'Thriller',
  'Documentary',
  'Animation',
  'Historical',
  'Mystery',
] as const;

export function formatMediaTypeLabel(type: string): string {
  if (type === 'tv') return 'TV Show';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function getMediaBoardIds(mediaId: string, boards: { id: string; mediaIds: string[] }[]): string[] {
  return boards.filter((b) => b.mediaIds.includes(mediaId)).map((b) => b.id);
}
