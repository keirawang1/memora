import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { cropImageToDataUrl } from '../utils/cropImage';

interface ImageCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  onCropped: (dataUrl: string) => void;
  title?: string;
}

export function ImageCropDialog({
  open,
  imageSrc,
  onOpenChange,
  onCropped,
  title = 'Crop thumbnail',
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  // Wait for dialog layout so cropper media size isn't miscalculated.
  const [cropperReady, setCropperReady] = useState(false);

  useEffect(() => {
    if (!open || !imageSrc) {
      setCropperReady(false);
      return;
    }
    const id = window.setTimeout(() => setCropperReady(true), 50);
    return () => window.clearTimeout(id);
  }, [open, imageSrc]);

  const onCropComplete = useCallback((area: Area) => {
    setCroppedArea(area);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
      setSaving(false);
      setCropperReady(false);
    }
    onOpenChange(next);
  };

  const handleApply = async () => {
    if (!imageSrc || !croppedArea || saving) return;
    setSaving(true);
    try {
      const dataUrl = await cropImageToDataUrl(imageSrc, croppedArea);
      onCropped(dataUrl);
      handleOpenChange(false);
    } catch (err) {
      console.error('Failed to crop image', err);
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Drag and zoom to crop a square thumbnail
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-muted">
          {imageSrc && cropperReady && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              objectFit="contain"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="crop-zoom">Zoom</Label>
          <input
            id="crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleApply()} disabled={saving || !croppedArea}>
            {saving ? 'Applying…' : 'Apply crop'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
