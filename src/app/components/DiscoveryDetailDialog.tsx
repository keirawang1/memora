import { useEffect, useState } from 'react';
import type { DiscoveryItem } from '../types/discovery';
import { jikanFetchSynopsis } from '../services/jikan';
import { supabase } from '../supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Image } from 'lucide-react';

interface DiscoveryDetailDialogProps {
  item: DiscoveryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function fetchOverview(item: DiscoveryItem): Promise<string> {
  if (item.catalogId) {
    const { data } = await supabase
      .from('media_catalog')
      .select('synopsis')
      .eq('id', item.catalogId)
      .maybeSingle();
    const text = (data as { synopsis?: string | null } | null)?.synopsis?.trim();
    if (text) return text;
  }
  if (item.source === 'jikan') {
    return jikanFetchSynopsis(item);
  }
  return 'No overview available.';
}

export function DiscoveryDetailDialog({
  item,
  open,
  onOpenChange,
}: DiscoveryDetailDialogProps) {
  const [synopsis, setSynopsis] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) {
      setSynopsis('');
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchOverview(item)
      .then((text) => {
        if (cancelled) return;
        setSynopsis(text);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSynopsis('No overview available.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, item]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">{item.title}</DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden">
          <div className="float-left w-24 h-36 mr-3 mb-2 rounded-lg overflow-hidden bg-muted/50">
            {item.imageUrl ? (
              <ImageWithFallback
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image className="w-8 h-8 text-muted-foreground/40" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge variant="outline">{item.formatLabel}</Badge>
            {item.genres.map((genre) => (
              <Badge key={genre} variant="secondary">
                {genre}
              </Badge>
            ))}
          </div>

          {item.reason ? (
            <p className="text-sm text-muted-foreground mb-2 italic">{item.reason}</p>
          ) : null}

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Overview
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {synopsis}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
