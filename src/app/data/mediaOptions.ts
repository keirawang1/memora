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

export const BOARD_TYPE_MIXED = 'mixed' as const;

export function formatMediaTypeLabel(type: string): string {
  if (type === 'tv') return 'TV Show';
  if (type === BOARD_TYPE_MIXED) return 'Mixed';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function getBoardMediaTypeOptions(customMediaTypes: string[]): string[] {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const t of [...DEFAULT_MEDIA_TYPES, ...customMediaTypes, BOARD_TYPE_MIXED]) {
    if (!seen.has(t)) {
      seen.add(t);
      options.push(t);
    }
  }
  return options;
}

export function getMediaBoardIds(mediaId: string, boards: { id: string; mediaIds: string[] }[]): string[] {
  return boards.filter((b) => b.mediaIds.includes(mediaId)).map((b) => b.id);
}

export function formatWatchStatusLabel(status: string): string {
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function boardMatchesTypeFilter(
  board: { type?: string },
  selectedTypes: string[],
): boolean {
  if (selectedTypes.length === 0) return true;
  const boardType = board.type || BOARD_TYPE_MIXED;
  return selectedTypes.includes(boardType);
}
