import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FolderOpen, Search, Calendar, Layers, Trash2, Eye, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SavedProject {
  id: string;
  name: string;
  vao_width: number;
  vao_height: number;
  quantity: number;
  lock_height: number;
  panels: any;
  notes: string | null;
  created_at: string;
  product_template_id: string | null;
  product_templates?: {
    name: string;
    image_url: string | null;
  } | null;
}

interface SavedProjectsSheetProps {
  onLoadProject: (project: SavedProject) => void;
}

export function SavedProjectsSheet({ onLoadProject }: SavedProjectsSheetProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { currentCompany } = useAuth();

  const { data: projects, isLoading, refetch } = useQuery({
    queryKey: ['glass-projects', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('glass_projects')
        .select(`
          id,
          name,
          vao_width,
          vao_height,
          quantity,
          lock_height,
          panels,
          notes,
          created_at,
          product_template_id,
          product_templates (
            name,
            image_url
          )
        `)
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as SavedProject[];
    },
    enabled: !!currentCompany?.id && open
  });

  const filteredProjects = projects?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.product_templates?.name?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleLoad = (project: SavedProject) => {
    onLoadProject(project);
    setOpen(false);
    toast.success(`Projeto "${project.name}" carregado!`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('glass_projects')
        .delete()
        .eq('id', deleteId);
      
      if (error) throw error;
      
      toast.success('Projeto excluído com sucesso!');
      refetch();
    } catch (error: any) {
      toast.error('Erro ao excluir projeto: ' + error.message);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            Projetos Salvos
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Projetos Salvos
            </SheetTitle>
          </SheetHeader>
          
          <div className="mt-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar projetos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Projects list */}
            <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {search ? 'Nenhum projeto encontrado' : 'Nenhum projeto salvo ainda'}
                </div>
              ) : (
                filteredProjects.map(project => (
                  <Card key={project.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">{project.name}</h4>
                          {project.product_templates?.name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {project.product_templates.name}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <Layers className="w-2.5 h-2.5" />
                              {project.vao_width} × {project.vao_height}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              Qtd: {project.quantity}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(project.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                          
                          {project.notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {project.notes}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-1.5">
                          <Button 
                            size="sm" 
                            variant="default"
                            className="h-8 gap-1.5"
                            onClick={() => handleLoad(project)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Carregar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-8 gap-1.5 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(project.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O projeto será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
