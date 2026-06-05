import { ArrowUpDown } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { SORT_MODE_LABELS, type SortMode } from '../types/sort';

interface SortOrderControlProps {
  mode: SortMode;
  onModeChange: (mode: SortMode) => void;
}

export function SortOrderControl({ mode, onModeChange }: SortOrderControlProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label="Sort order"
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => onModeChange(value as SortMode)}
        >
          {(Object.keys(SORT_MODE_LABELS) as SortMode[]).map((key) => (
            <DropdownMenuRadioItem key={key} value={key}>
              {SORT_MODE_LABELS[key]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {mode === 'custom' && (
          <>
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Drag items to reorder
            </p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
