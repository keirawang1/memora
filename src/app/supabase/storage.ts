import { supabase } from './client';

export const BOARD_COVERS_BUCKET = 'boards';
export const AVATARS_BUCKET = 'avatars';

async function dataUrlToBlob(dataUrl: string): Promise<{ blob: Blob; ext: string }> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const mime = dataUrl.match(/^data:([^;]+);/)?.[1] ?? blob.type ?? 'image/jpeg';
  const subtype = mime.split('/')[1] ?? 'jpeg';
  const ext = subtype === 'jpeg' ? 'jpg' : subtype;
  return { blob, ext };
}

async function uploadToBucket(
  bucket: string,
  path: string,
  blob: Blob,
  upsert: boolean,
): Promise<string> {
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload image');
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const cacheBust = upsert ? `?t=${Date.now()}` : '';
  return `${data.publicUrl}${cacheBust}`;
}

export async function uploadBoardCoverImage(
  userId: string,
  dataUrl: string,
): Promise<string> {
  const { blob, ext } = await dataUrlToBlob(dataUrl);
  const path = `${userId}/covers/${crypto.randomUUID()}.${ext}`;
  return uploadToBucket(BOARD_COVERS_BUCKET, path, blob, false);
}

export async function uploadUserAvatar(
  userId: string,
  dataUrl: string,
): Promise<string> {
  const { blob, ext } = await dataUrlToBlob(dataUrl);
  const path = `${userId}/avatar.${ext}`;
  return uploadToBucket(AVATARS_BUCKET, path, blob, true);
}

/** Turn a DB avatar value (URL or storage path) into a URL the browser can load. */
export function getAvatarDisplayUrl(stored: string | null | undefined): string | undefined {
  if (!stored?.trim()) return undefined;

  const trimmed = stored.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const pathFromPublicUrl = getAvatarStoragePath(trimmed);
  const objectPath = pathFromPublicUrl ?? trimmed.replace(/^\//, '');

  if (!objectPath) return undefined;

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

export function getAvatarStoragePath(avatarValue: string): string | null {
  const trimmed = avatarValue.trim();
  if (!trimmed) return null;

  const markers = [
    `/object/public/${AVATARS_BUCKET}/`,
    `/public/${AVATARS_BUCKET}/`,
    `/object/public/${BOARD_COVERS_BUCKET}/`,
    `/public/${BOARD_COVERS_BUCKET}/`,
  ];

  for (const marker of markers) {
    const index = trimmed.indexOf(marker);
    if (index !== -1) {
      return decodeURIComponent(trimmed.slice(index + marker.length).split('?')[0]);
    }
  }

  if (!trimmed.startsWith('http') && trimmed.includes('/avatar.')) {
    return decodeURIComponent(trimmed.split('?')[0]);
  }

  return null;
}

/** Upload data URLs to storage; store public URL in DB. */
export async function resolveAvatarUrl(
  userId: string,
  avatar?: string,
): Promise<string | null | undefined> {
  if (avatar === undefined) return undefined;
  if (!avatar) return null;
  if (avatar.startsWith('data:')) {
    return uploadUserAvatar(userId, avatar);
  }
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar.split('?')[0];
  }
  const path = getAvatarStoragePath(avatar) ?? avatar.replace(/^\//, '');
  if (path) {
    const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
  return null;
}

export async function resolveCoverImageUrl(
  userId: string,
  image?: string,
): Promise<string | null | undefined> {
  if (!image) return undefined;
  if (image.startsWith('data:')) {
    return uploadBoardCoverImage(userId, image);
  }
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  return null;
}

/** Extract object path from a Supabase public URL or raw storage path. */
export function getBoardCoverStoragePath(coverImageUrl: string): string | null {
  const trimmed = coverImageUrl.trim();
  if (!trimmed) return null;

  const markers = [
    `/object/public/${BOARD_COVERS_BUCKET}/`,
    `/public/${BOARD_COVERS_BUCKET}/`,
  ];

  for (const marker of markers) {
    const index = trimmed.indexOf(marker);
    if (index !== -1) {
      return decodeURIComponent(trimmed.slice(index + marker.length).split('?')[0]);
    }
  }

  if (!trimmed.startsWith('http') && trimmed.includes('/covers/')) {
    return decodeURIComponent(trimmed.split('?')[0]);
  }

  return null;
}

export async function deleteBoardCoverFromStorage(
  coverImageUrl: string,
): Promise<void> {
  const path = getBoardCoverStoragePath(coverImageUrl);
  if (!path) {
    throw new Error('Invalid cover image URL — cannot delete from storage');
  }

  const { data, error } = await supabase.storage
    .from(BOARD_COVERS_BUCKET)
    .remove([path]);

  if (error) throw error;

  // RLS can block deletes without returning an error — verify something was removed
  if (!data?.length) {
    throw new Error(`Failed to delete cover image at path: ${path}`);
  }
}
