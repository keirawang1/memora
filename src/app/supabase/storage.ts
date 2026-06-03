import { supabase } from './client';

export const BOARD_COVERS_BUCKET = 'boards';

async function dataUrlToBlob(dataUrl: string): Promise<{ blob: Blob; ext: string }> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const mime = dataUrl.match(/^data:([^;]+);/)?.[1] ?? blob.type ?? 'image/jpeg';
  const subtype = mime.split('/')[1] ?? 'jpeg';
  const ext = subtype === 'jpeg' ? 'jpg' : subtype;
  return { blob, ext };
}

export async function uploadBoardCoverImage(
  userId: string,
  dataUrl: string,
): Promise<string> {
  const { blob, ext } = await dataUrlToBlob(dataUrl);
  const path = `${userId}/covers/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BOARD_COVERS_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BOARD_COVERS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
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
