import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Trash2, Loader2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmployeePhotoUploadProps {
  photoUrl: string | null;
  employeeName: string;
  employeeId?: string;
  companyId?: string;
  onPhotoChange: (url: string | null) => void;
  disabled?: boolean;
}

export function EmployeePhotoUpload({
  photoUrl,
  employeeName,
  employeeId,
  companyId,
  onPhotoChange,
  disabled = false,
}: EmployeePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB');
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${companyId || 'temp'}/${employeeId || Date.now()}-${Date.now()}.${fileExt}`;

      // Delete old photo if exists
      if (photoUrl) {
        const oldPath = photoUrl.split('/employee-photos/')[1];
        if (oldPath) {
          await supabase.storage.from('employee-photos').remove([oldPath]);
        }
      }

      // Upload new photo
      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(fileName);

      onPhotoChange(publicUrl);
      toast.success('Foto atualizada!');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error('Erro ao fazer upload da foto: ' + error.message);
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!photoUrl) return;

    setUploading(true);

    try {
      const path = photoUrl.split('/employee-photos/')[1];
      if (path) {
        await supabase.storage.from('employee-photos').remove([path]);
      }
      onPhotoChange(null);
      toast.success('Foto removida!');
    } catch (error: any) {
      console.error('Error removing photo:', error);
      toast.error('Erro ao remover foto: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
        disabled={disabled || uploading}
      />
      
      <Avatar className="w-24 h-24 border-2 border-border">
        <AvatarImage src={photoUrl || undefined} alt={employeeName} className="object-cover" />
        <AvatarFallback className="text-lg bg-primary/10 text-primary">
          {employeeName ? getInitials(employeeName) : <User className="w-8 h-8" />}
        </AvatarFallback>
      </Avatar>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Camera className="w-4 h-4 mr-1" />
          )}
          {photoUrl ? 'Alterar' : 'Adicionar foto'}
        </Button>
        
        {photoUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={disabled || uploading}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        Esta foto será usada no crachá
      </p>
    </div>
  );
}
