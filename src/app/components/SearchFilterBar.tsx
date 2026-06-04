import { Check, Filter } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { cn } from './ui/utils';

export interface FilterSectionConfig {
  title: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  formatLabel?: (value: string) => string;
}

interface SearchFilterBarProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  filterOpen: boolean;
  onFilterOpenChange: (open: boolean) => void;
  sections: FilterSectionConfig[];
  hasActiveFilters: boolean;
  className?: string;
}

function FilterTagGrid({
  options,
  selected,
  onChange,
  formatLabel = (v) => v,
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  formatLabel?: (value: string) => string;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-0.5">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent transition-colors',
              isSelected && 'bg-accent',
            )}
            onClick={() => toggle(option)}
          >
            <Check
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                isSelected ? 'opacity-100' : 'opacity-0',
              )}
            />
            <span className="truncate">{formatLabel(option)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SearchFilterBar({
  placeholder,
  value,
  onChange,
  filterOpen,
  onFilterOpenChange,
  sections,
  hasActiveFilters,
  className,
}: SearchFilterBarProps) {
  const clearAll = () => {
    sections.forEach((section) => section.onChange([]));
  };

  return (
    <>
      <div
        className={cn(
          'flex h-9 w-full min-w-[200px] flex-1 items-stretch overflow-hidden rounded-md border border-input bg-input-background shadow-xs transition-[color,box-shadow]',
          'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
          className,
        )}
      >
        <input
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
        <div className="flex shrink-0 items-center border-l border-input">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 shrink-0 rounded-none hover:bg-accent/50"
            aria-label="Open filters"
            onClick={() => onFilterOpenChange(true)}
          >
            <Filter
              className={cn(
                'h-4 w-4',
                hasActiveFilters ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            {hasActiveFilters && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
        </div>
      </div>

      <Dialog open={filterOpen} onOpenChange={onFilterOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription className="sr-only">
              Filter results by tag
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-4">
            {sections.map((section, index) => (
              <section
                key={section.title}
                className={cn(index > 0 && 'mt-4 border-t border-border pt-4')}
              >
                <h3 className="text-sm font-bold mb-3">{section.title}</h3>
                <FilterTagGrid
                  options={section.options}
                  selected={section.selected}
                  onChange={section.onChange}
                  formatLabel={section.formatLabel}
                />
              </section>
            ))}
          </div>
          {hasActiveFilters && (
            <div className="shrink-0 border-t px-6 py-3">
              <Button variant="outline" size="sm" onClick={clearAll}>
                Clear all filters
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
