import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImagePlus, Loader2, Trash2, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { processFileWithWhiteBackground } from '@/utils/imageBackgroundProcessor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImageUploadFieldProps {
  label?: string;
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
  bucket: 'company-item-images' | 'company-product-images';
  path: string; // e.g., "{company_id}/{item_id}"
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE_MB = 5;

export function ImageUploadField({
  label = 'Imagem',
  imageUrl,
  onImageChange,
  bucket,
  path,
  disabled = false,
  size = 'md',
  className,
}: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32',
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Formato inválido. Use PNG, JPEG ou WebP.');
      return;
    }

    // Validate size
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Máximo ${MAX_SIZE_MB}MB.`);
      return;
    }

    setIsUploading(true);
    try {
      // Process image with white background
      const processedFile = await processFileWithWhiteBackground(file);
      
      // Generate unique filename
      const fileName = `${path}.png`;

      // Delete existing file if any
      if (imageUrl) {
        const oldPath = imageUrl.split(`/${bucket}/`)[1];
        if (oldPath) {
          await supabase.storage.from(bucket).remove([oldPath]);
        }
      }

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, processedFile, {
          upsert: true,
          contentType: 'image/png',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      // Add cache buster to force refresh
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      onImageChange(newUrl);
      toast.success('Imagem enviada com sucesso!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar imagem: ' + error.message);
    } finally {
      setIsUploading(false);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!imageUrl) return;

    setIsUploading(true);
    try {
      const oldPath = imageUrl.split(`/${bucket}/`)[1]?.split('?')[0];
      if (oldPath) {
        const { error } = await supabase.storage.from(bucket).remove([oldPath]);
        if (error) throw error;
      }
      onImageChange(null);
      toast.success('Imagem removida');
    } catch (error: any) {
      console.error('Remove error:', error);
      toast.error('Erro ao remover: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label className="text-sm font-medium">{label}</Label>}
      
      <div className="flex items-center gap-3">
        {/* Image Preview */}
        <div 
          className={cn(
            'rounded-lg border bg-muted/50 flex items-center justify-center overflow-hidden shrink-0',
            sizeClasses[size]
          )}
        >
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="Preview"
              className="h-full w-full object-contain p-1"
              loading="lazy"
            />
          ) : (
            <Package className="h-8 w-8 text-muted-foreground/50" />
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || isUploading}
          />
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
            className="gap-1.5"
          >
            <ImagePlus className="h-4 w-4" />
            {imageUrl ? 'Alterar' : 'Adicionar'}
          </Button>
          
          {imageUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled || isUploading}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          )}
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground">
        PNG, JPEG ou WebP. Máximo {MAX_SIZE_MB}MB.
      </p>
    </div>
  );
}
