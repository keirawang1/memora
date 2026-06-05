export type SortMode = 'alphabetical' | 'last_edited' | 'custom';

export const SORT_MODE_LABELS: Record<SortMode, string> = {
  alphabetical: 'Alphabetical',
  last_edited: 'Last edited',
  custom: 'Custom',
};

export interface LibrarySortPreferences {
  boardSortMode: SortMode;
  boardCustomOrder: string[];
  mediaSortMode: SortMode;
}
