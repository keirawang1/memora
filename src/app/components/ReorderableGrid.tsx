import { useRef, useState, type ReactNode } from 'react';
import { cn } from './ui/utils';
import { reorderIds } from '../data/sortOrder';

interface ReorderableGridProps {
  enabled: boolean;
  itemIds: string[];
  onReorder: (nextIds: string[]) => void;
  className?: string;
  children: (itemId: string) => ReactNode;
}

export function ReorderableGrid({
  enabled,
  itemIds,
  onReorder,
  className,
  children,
}: ReorderableGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  if (!enabled) {
    return (
      <div className={className}>
        {itemIds.map((id) => (
          <div key={id} draggable={false}>
            {children(id)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {itemIds.map((id) => (
        <div
          key={id}
          draggable={enabled}
          onDragStart={() => {
            draggingIdRef.current = id;
            setDraggingId(id);
          }}
          onDragEnd={() => {
            draggingIdRef.current = null;
            setDraggingId(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const fromId = draggingIdRef.current;
            if (!fromId) return;
            onReorder(reorderIds(itemIds, fromId, id));
            draggingIdRef.current = null;
            setDraggingId(null);
          }}
          className={cn(
            'cursor-grab active:cursor-grabbing',
            draggingId === id && 'opacity-50',
          )}
        >
          {children(id)}
        </div>
      ))}
    </div>
  );
}
