import type { Area } from 'react-easy-crop';

const JPEG_QUALITY = 0.85;
const OUTPUT_SIZE = 800;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Crop using percentage area from react-easy-crop (more accurate than rounded pixels).
 * Avoids the slight side-clip that can happen with croppedAreaPixels rounding.
 */
export async function cropImageToDataUrl(
  imageSrc: string,
  croppedAreaPercentages: Area,
  size = OUTPUT_SIZE,
): Promise<string> {
  const image = await loadImage(imageSrc);

  const rawX = (croppedAreaPercentages.x / 100) * image.naturalWidth;
  const rawY = (croppedAreaPercentages.y / 100) * image.naturalHeight;
  const rawW = (croppedAreaPercentages.width / 100) * image.naturalWidth;
  const rawH = (croppedAreaPercentages.height / 100) * image.naturalHeight;

  // Use the smaller side so we never stretch; keep crop centered if rounding differs.
  const side = Math.min(rawW, rawH);
  const x = Math.max(0, Math.min(image.naturalWidth - side, rawX + (rawW - side) / 2));
  const y = Math.max(0, Math.min(image.naturalHeight - side, rawY + (rawH - side) / 2));

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to process image');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, x, y, side, side, 0, 0, size, size);

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
