import { useState } from 'react';
import type { Board } from '../types/media';
import type { DiscoveryItem } from '../types/discovery';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from './ui/command';
import { DiscoveryDetailDialog } from './DiscoveryDetailDialog';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { isAllBoard } from '../data/allBoard';
import { Check, CheckCircle2, Circle, Image, Plus } from 'lucide-react';

interface RecommendationCardProps {
  item: DiscoveryItem;
  boards: Board[];
  added: boolean;
  onAdd: (item: DiscoveryItem, boardIds: string[]) => void | Promise<void>;
}

export function RecommendationCard({
  item,
  boards,
  added,
  onAdd,
}: RecommendationCardProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const selectableBoards = boards.filter((b) => !isAllBoard(b));

  const toggleBoard = (boardId: string) => {
    setSelectedBoardIds((prev) =>
      prev.includes(boardId) ? prev.filter((id) => id !== boardId) : [...prev, boardId],
    );
  };

  const handleAdd = async () => {
    if (selectedBoardIds.length === 0 || adding) return;
    setAdding(true);
    try {
      await onAdd(item, selectedBoardIds);
      setAddOpen(false);
      setSelectedBoardIds([]);
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full min-w-[140px]">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="aspect-square relative rounded-lg overflow-hidden mb-2 bg-muted/50 shrink-0 cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`View details for ${item.title}`}
        >
          {item.imageUrl ? (
            <ImageWithFallback
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Image className="w-10 h-10 text-muted-foreground/40" />
            </div>
          )}
        </button>

        <h3 className="text-sm font-medium line-clamp-2 mb-1 min-h-[2.5rem]">{item.title}</h3>
        <Badge variant="outline" className="text-xs mb-2 w-fit">
          {item.formatLabel}
        </Badge>

        <div className="mt-auto">
          {added ? (
            <Button variant="outline" className="w-full" disabled>
              <Check className="w-4 h-4 mr-1" />
              Added
            </Button>
          ) : (
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandList className="max-h-48">
                    <CommandEmpty>No boards found.</CommandEmpty>
                    <CommandGroup heading="Add to boards">
                      {selectableBoards.map((board) => {
                        const isSelected = selectedBoardIds.includes(board.id);
                        return (
                          <CommandItem
                            key={board.id}
                            onSelect={() => toggleBoard(board.id)}
                          >
                            {isSelected ? (
                              <CheckCircle2 className="mr-2 h-4 w-4 fill-primary text-primary" />
                            ) : (
                              <Circle className="mr-2 h-4 w-4 text-muted-foreground" />
                            )}
                            {board.name}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
                <div className="p-2 border-t">
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={selectedBoardIds.length === 0 || adding}
                    onClick={handleAdd}
                  >
                    {adding ? 'Adding…' : 'Add to library'}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <DiscoveryDetailDialog
        item={item}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
