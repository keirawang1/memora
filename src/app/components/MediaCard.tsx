import type { MediaItem } from '../types/media';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface MediaCardProps {
  media: MediaItem;
  onClick?: () => void;
  noHover?: boolean;
}

export function MediaCard({ media, onClick, noHover = false }: MediaCardProps) {
  return (
    <div
      className={`group cursor-pointer transition-all ${noHover ? '' : 'hover:scale-105'}`}
      onClick={onClick}
    >
      <div className="aspect-square relative rounded-lg overflow-hidden mb-2">
        <ImageWithFallback
          src={media.imageUrl}
          alt={media.title}
          className="w-full h-full object-cover"
        />
      </div>
      
      <div>
        <h3 className="text-sm line-clamp-2 mb-0.5">{media.title}</h3>
        <Badge variant="outline" className="text-xs">
          {media.type.toUpperCase()}
        </Badge>
      </div>
    </div>
  );
}
