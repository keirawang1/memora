import type { Board, MediaItem } from '../types/media';

export const ALL_BOARD_NAME = 'All';

export function isAllBoard(board: Pick<Board, 'name' | 'isSystem'>): boolean {
  return board.isSystem === true || board.name === ALL_BOARD_NAME;
}

export function sortBoardsWithAllFirst(boards: Board[]): Board[] {
  const allBoards = boards.filter(isAllBoard);
  const otherBoards = boards.filter((b) => !isAllBoard(b));
  return [...allBoards, ...otherBoards];
}

export function filterBoardsForDisplay(boards: Board[], showAllBoard: boolean): Board[] {
  const sorted = sortBoardsWithAllFirst(boards);
  if (showAllBoard) return sorted;
  return sorted.filter((b) => !isAllBoard(b));
}

export function excludeAllBoardFromSelection(boardIds: string[], allBoardId: string | null): string[] {
  if (!allBoardId) return boardIds;
  return boardIds.filter((id) => id !== allBoardId);
}

export function mediaBelongsToBoard(item: MediaItem, board: Board): boolean {
  if (isAllBoard(board)) return true;
  if (board.mediaIds.includes(item.id)) return true;
  return item.boardIds?.includes(board.id) ?? false;
}

export function getBoardMediaItems(board: Board, mediaItems: MediaItem[]): MediaItem[] {
  if (isAllBoard(board)) return mediaItems;
  return mediaItems.filter((item) => mediaBelongsToBoard(item, board));
}
