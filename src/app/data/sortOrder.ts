import type { Board, MediaItem } from '../types/media';
import type { SortMode } from '../types/sort';
import { isAllBoard, sortBoardsWithAllFirst } from './allBoard';

function compareAlphabetical(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function compareLastEdited(
  aUpdated: string | undefined,
  bUpdated: string | undefined,
  aFallback: string,
  bFallback: string,
): number {
  const aTime = new Date(aUpdated ?? aFallback).getTime();
  const bTime = new Date(bUpdated ?? bFallback).getTime();
  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
  if (Number.isNaN(aTime)) return 1;
  if (Number.isNaN(bTime)) return -1;
  return bTime - aTime;
}

function orderByCustomIds<T extends { id: string }>(
  items: T[],
  customOrder: string[],
): T[] {
  if (customOrder.length === 0) return items;
  const order = new Map(customOrder.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const ai = order.get(a.id);
    const bi = order.get(b.id);
    if (ai === undefined && bi === undefined) return 0;
    if (ai === undefined) return 1;
    if (bi === undefined) return -1;
    return ai - bi;
  });
}

export function sortBoardsForDisplay(
  boards: Board[],
  mode: SortMode,
  customOrder: string[],
): Board[] {
  const allBoards = boards.filter(isAllBoard);
  const otherBoards = boards.filter((b) => !isAllBoard(b));

  let sortedOthers: Board[];
  switch (mode) {
    case 'alphabetical':
      sortedOthers = [...otherBoards].sort((a, b) =>
        compareAlphabetical(a.name, b.name),
      );
      break;
    case 'last_edited':
      sortedOthers = [...otherBoards].sort((a, b) =>
        compareLastEdited(a.updatedAt, b.updatedAt, a.createdAt, b.createdAt),
      );
      break;
    case 'custom':
      sortedOthers = orderByCustomIds(otherBoards, customOrder);
      break;
    default:
      sortedOthers = otherBoards;
  }

  return [...allBoards, ...sortedOthers];
}

export function sortMediaForDisplay(
  items: MediaItem[],
  mode: SortMode,
  customOrder: string[],
): MediaItem[] {
  switch (mode) {
    case 'alphabetical':
      return [...items].sort((a, b) => compareAlphabetical(a.title, b.title));
    case 'last_edited':
      return [...items].sort((a, b) =>
        compareLastEdited(a.updatedAt, b.updatedAt, a.dateAdded, b.dateAdded),
      );
    case 'custom':
      return orderByCustomIds(items, customOrder);
    default:
      return items;
  }
}

export function mergeCustomOrder(
  currentOrder: string[],
  itemIds: string[],
): string[] {
  const existing = currentOrder.filter((id) => itemIds.includes(id));
  const missing = itemIds.filter((id) => !existing.includes(id));
  return [...existing, ...missing];
}

export function reorderIds(ids: string[], fromId: string, toId: string): string[] {
  if (fromId === toId) return ids;
  const next = ids.filter((id) => id !== fromId);
  const toIndex = next.indexOf(toId);
  if (toIndex === -1) return [...next, fromId];
  next.splice(toIndex, 0, fromId);
  return next;
}

export function boardIdsInDisplayOrder(boards: Board[]): string[] {
  return sortBoardsWithAllFirst(boards)
    .filter((b) => !isAllBoard(b))
    .map((b) => b.id);
}
