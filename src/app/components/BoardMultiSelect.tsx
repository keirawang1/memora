import { useMemo, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CheckCircle2, Circle, X } from 'lucide-react';
import type { Board } from '../types/media';
import { isAllBoard } from '../data/allBoard';

interface BoardMultiSelectProps {
  boards: Board[];
  selectedBoardIds: string[];
  onChange: (boardIds: string[]) => void;
  label?: string;
  required?: boolean;
}

export function BoardMultiSelect({
  boards,
  selectedBoardIds,
  onChange,
  label = 'Boards',
  required = false,
}: BoardMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBoards = useMemo(() => {
    const available = boards.filter((board) => !isAllBoard(board));
    if (!searchQuery) return available;
    return available.filter((board) =>
      board.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [boards, searchQuery]);

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? ' *' : ''}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between">
            {(() => {
              const count = selectedBoardIds.filter((id) => {
                const board = boards.find((b) => b.id === id);
                return board && !isAllBoard(board);
              }).length;
              return count > 0
                ? `${count} board${count > 1 ? 's' : ''} selected`
                : 'Select boards...';
            })()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search boards..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No boards found.</CommandEmpty>
              <CommandGroup>
                {filteredBoards.map((board) => {
                  const isSelected = selectedBoardIds.includes(board.id);
                  return (
                    <CommandItem
                      key={board.id}
                      onSelect={() => {
                        onChange(
                          isSelected
                            ? selectedBoardIds.filter((id) => id !== board.id)
                            : [...selectedBoardIds, board.id],
                        );
                      }}
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
        </PopoverContent>
      </Popover>
      {selectedBoardIds.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedBoardIds
            .filter((boardId) => {
              const board = boards.find((b) => b.id === boardId);
              return board && !isAllBoard(board);
            })
            .map((boardId) => {
            const board = boards.find((b) => b.id === boardId);
            return board ? (
              <Badge key={board.id} variant="secondary" className="gap-1">
                {board.name}
                <button
                  type="button"
                  className="ml-1 rounded-full hover:bg-black/10 focus:outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selectedBoardIds.filter((id) => id !== boardId));
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
