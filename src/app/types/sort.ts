export type SortMode = 'alphabetical' | 'last_edited' | 'custom' | 'rating';

export type SortDirection = 'asc' | 'desc';

export const SORT_MODE_LABELS: Record<SortMode, string> = {
  alphabetical: 'Alphabetical',
  last_edited: 'Last edited',
  custom: 'Custom',
  rating: 'Rating',
};

export const BOARD_SORT_MODES: SortMode[] = ['alphabetical', 'last_edited', 'custom'];

export const MEDIA_SORT_MODES: SortMode[] = [
  'alphabetical',
  'last_edited',
  'rating',
  'custom',
];

export const DEFAULT_SORT_DIRECTION: Record<SortMode, SortDirection> = {
  alphabetical: 'asc',
  last_edited: 'desc',
  rating: 'desc',
  custom: 'asc',
};

export interface LibrarySortPreferences {
  boardSortMode: SortMode;
  boardCustomOrder: string[];
  mediaSortMode: SortMode;
}
