import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Camera, 
  Plus, 
  Trash2, 
  Image as ImageIcon,
  Loader2,
  Download,
  ZoomIn
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OSPhotosGalleryProps {
  ordemServicoId: string;
}

interface OSPhoto {
  id: string;
  file_path: string;
  file_name: string;
  description: string | null;
  photo_type: string;
  created_at: string;
}

const photoTypeConfig: Record<string, { label: string; color: string }> = {
  before: { label: 'Antes', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400' },
  after: { label: 'Depois', color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400' },
  progress: { label: 'Em Progresso', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400' },
  general: { label: 'Geral', color: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-950/30 dark:text-gray-400' },
};

export function OSPhotosGallery({ ordemServicoId }: OSPhotosGalleryProps) {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoType, setPhotoType] = useState('general');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<OSPhoto | null>(null);

  // Fetch photos
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['os-photos', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_photos')
        .select('*')
        .eq('ordem_servico_id', ordemServicoId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as OSPhoto[];
    },
    enabled: !!ordemServicoId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !currentCompany?.id || !user?.id) {
        throw new Error('Dados inválidos');
      }

      setIsUploading(true);

      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${ordemServicoId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('os-photos')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Save record in database
      const { error: insertError } = await supabase
        .from('os_photos')
        .insert({
          ordem_servico_id: ordemServicoId,
          company_id: currentCompany.id,
          file_path: fileName,
          file_name: selectedFile.name,
          description: description || null,
          photo_type: photoType,
          uploaded_by: user.id,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['os-photos', ordemServicoId] });
      toast.success('Foto adicionada com sucesso!');
      handleCloseUploadDialog();
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar foto: ' + error.message);
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const photo = photos.find(p => p.id === photoId);
      if (!photo) throw new Error('Foto não encontrada');

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('os-photos')
        .remove([photo.file_path]);

      if (storageError) console.warn('Erro ao remover do storage:', storageError);

      // Delete from database
      const { error: dbError } = await supabase
        .from('os_photos')
        .delete()
        .eq('id', photoId);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['os-photos', ordemServicoId] });
      toast.success('Foto removida!');
      setDeletePhotoId(null);
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover foto: ' + error.message);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB');
      return;
    }

    setSelectedFile(file);
    setUploadDialogOpen(true);
  };

  const handleCloseUploadDialog = () => {
    setUploadDialogOpen(false);
    setSelectedFile(null);
    setPhotoType('general');
    setDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getPhotoUrl = (filePath: string) => {
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/os-photos/${filePath}`;
  };

  const handleDownload = (photo: OSPhoto) => {
    const url = getPhotoUrl(photo.file_path);
    const link = document.createElement('a');
    link.href = url;
    link.download = photo.file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Fotos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="aspect-square rounded-lg" />
            <Skeleton className="aspect-square rounded-lg" />
            <Skeleton className="aspect-square rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="h-5 w-5" />
          Fotos da OS
          {photos.length > 0 && (
            <Badge variant="secondary" className="ml-1">{photos.length}</Badge>
          )}
        </CardTitle>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Foto
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma foto adicionada</p>
            <p className="text-sm">Clique em "Adicionar Foto" para registrar imagens da OS</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((photo) => {
              const typeConfig = photoTypeConfig[photo.photo_type] || photoTypeConfig.general;
              return (
                <div 
                  key={photo.id} 
                  className="group relative aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
                  onClick={() => setPreviewPhoto(photo)}
                >
                  <img
                    src={getPhotoUrl(photo.file_path)}
                    alt={photo.description || photo.file_name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                  
                  {/* Type badge */}
                  <div className="absolute top-2 left-2">
                    <Badge variant="outline" className={`text-xs ${typeConfig.color}`}>
                      {typeConfig.label}
                    </Badge>
                  </div>

                  {/* Actions overlay */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewPhoto(photo);
                      }}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(photo);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletePhotoId(photo.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Date */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white/80">
                      {format(new Date(photo.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Foto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFile && (
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo da Foto</Label>
              <Select value={photoType} onValueChange={setPhotoType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Antes</SelectItem>
                  <SelectItem value="after">Depois</SelectItem>
                  <SelectItem value="progress">Em Progresso</SelectItem>
                  <SelectItem value="general">Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Ex: Vista da janela instalada"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseUploadDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={() => uploadMutation.mutate()} 
              disabled={isUploading || !selectedFile}
            >
              {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isUploading ? 'Enviando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewPhoto?.description || previewPhoto?.file_name}
              {previewPhoto && (
                <Badge variant="outline" className={photoTypeConfig[previewPhoto.photo_type]?.color}>
                  {photoTypeConfig[previewPhoto.photo_type]?.label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewPhoto && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden bg-muted">
                <img
                  src={getPhotoUrl(previewPhoto.file_path)}
                  alt={previewPhoto.description || previewPhoto.file_name}
                  className="w-full max-h-[70vh] object-contain"
                />
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Adicionada em {format(new Date(previewPhoto.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                <Button variant="outline" size="sm" onClick={() => handleDownload(previewPhoto)}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePhotoId} onOpenChange={() => setDeletePhotoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A foto será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePhotoId && deleteMutation.mutate(deletePhotoId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
