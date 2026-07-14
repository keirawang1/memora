import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Label } from './ui/label';
import { ImageCropDialog } from './ImageCropDialog';
import { readFileAsDataUrl } from '../utils/cropImage';

interface CoverImageUploadProps {
  label?: string;
  inputId: string;
  value: string;
  existingUrl?: string;
  onChange: (dataUrl: string) => void;
}

export function CoverImageUpload({
  label = 'Image',
  inputId,
  value,
  existingUrl,
  onChange,
}: CoverImageUploadProps) {
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const preview = value || existingUrl;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCropSrc(dataUrl);
      setCropOpen(true);
    } catch (err) {
      console.error('Failed to read image', err);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => void handleFileChange(e)}
          className="hidden"
          id={inputId}
        />
        <label htmlFor={inputId} className="cursor-pointer block">
          {preview ? (
            <div>
              <img
                src={preview}
                alt="Preview"
                className="max-h-32 mx-auto rounded mb-2 aspect-square object-cover"
              />
              <p className="text-sm text-muted-foreground">Click to change image</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm">Click to upload an image</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 5MB</p>
              </div>
            </div>
          )}
        </label>
      </div>

      <ImageCropDialog
        open={cropOpen}
        imageSrc={cropSrc}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open) setCropSrc(null);
        }}
        onCropped={onChange}
      />
    </div>
  );
}
