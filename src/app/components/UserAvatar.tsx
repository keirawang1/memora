import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getAvatarDisplayUrl } from '../supabase/storage';
import { cn } from './ui/utils';

type UserAvatarSize = 'sm' | 'lg' | 'xl';

const sizeConfig: Record<UserAvatarSize, { root: string; text: string }> = {
  sm: { root: 'size-10', text: 'text-sm font-medium' },
  lg: { root: 'size-[150px]', text: 'text-4xl font-semibold' },
  xl: { root: 'size-44', text: 'text-3xl font-semibold' },
};

interface UserAvatarProps {
  displayName: string;
  /** Raw value from users.avatar / users.avatar_url in the database */
  avatar?: string;
  size?: UserAvatarSize;
  accentColor?: string;
  className?: string;
}

export function UserAvatar({
  displayName,
  avatar,
  size = 'sm',
  accentColor,
  className,
}: UserAvatarProps) {
  const initials = (displayName.trim().slice(0, 2) || '??').toUpperCase();
  const { root, text } = sizeConfig[size];
  const imageSrc = getAvatarDisplayUrl(avatar);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [imageSrc]);

  return (
    <Avatar className={cn(root, 'shrink-0 overflow-hidden rounded-full', className)}>
      {imageSrc && !imgError ? (
        <AvatarImage
          src={imageSrc}
          alt={displayName}
          className="size-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : null}
      <AvatarFallback
        className={cn('size-full rounded-full', text)}
        style={
          accentColor
            ? { backgroundColor: accentColor, color: '#fff' }
            : undefined
        }
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
