import { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAnnouncements, Announcement } from '@/hooks/useAnnouncements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Megaphone, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  XCircle,
  Calendar 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreateAnnouncementDialog } from '@/components/admin/announcements/CreateAnnouncementDialog';
import { EditAnnouncementDialog } from '@/components/admin/announcements/EditAnnouncementDialog';
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

const typeConfig = {
  info: { icon: Info, label: 'Informação', color: 'bg-blue-500' },
  warning: { icon: AlertTriangle, label: 'Aviso', color: 'bg-yellow-500' },
  success: { icon: CheckCircle, label: 'Sucesso', color: 'bg-green-500' },
  error: { icon: XCircle, label: 'Erro/Urgente', color: 'bg-red-500' },
};

export default function AdminAnnouncements() {
  const { isSaasAdmin } = useAuth();
  const { announcements, isLoading, deleteAnnouncement } = useAdminAnnouncements();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isSaasAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Acesso negado</p>
        </div>
      </AdminLayout>
    );
  }

  const getStatusBadge = (announcement: Announcement) => {
    const now = new Date();
    const startsAt = announcement.starts_at ? new Date(announcement.starts_at) : null;
    const endsAt = announcement.ends_at ? new Date(announcement.ends_at) : null;

    if (!announcement.is_active) {
      return <Badge variant="secondary">Inativo</Badge>;
    }
    if (startsAt && startsAt > now) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Agendado</Badge>;
    }
    if (endsAt && endsAt < now) {
      return <Badge variant="secondary">Expirado</Badge>;
    }
    return <Badge className="bg-green-500">Ativo</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Megaphone className="w-8 h-8 text-primary" />
              Avisos do Sistema
            </h1>
            <p className="text-muted-foreground mt-1">
              Envie comunicados para todas as empresas cadastradas
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Aviso
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-1/3" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Megaphone className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhum aviso criado</h3>
              <p className="text-muted-foreground text-center mt-1">
                Crie avisos para comunicar atualizações, manutenções ou informações importantes.
              </p>
              <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Aviso
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {announcements.map((announcement) => {
              const TypeIcon = typeConfig[announcement.type]?.icon || Info;
              
              return (
                <Card key={announcement.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${typeConfig[announcement.type]?.color || 'bg-blue-500'}`}>
                          <TypeIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{announcement.title}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(announcement.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(announcement)}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingAnnouncement(announcement)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletingId(announcement.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    {(announcement.starts_at || announcement.ends_at) && (
                      <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                        {announcement.starts_at && (
                          <span>
                            Início: {format(new Date(announcement.starts_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        )}
                        {announcement.ends_at && (
                          <span>
                            Fim: {format(new Date(announcement.ends_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CreateAnnouncementDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />

      {editingAnnouncement && (
        <EditAnnouncementDialog
          announcement={editingAnnouncement}
          open={!!editingAnnouncement}
          onOpenChange={(open) => !open && setEditingAnnouncement(null)}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este aviso? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingId) {
                  deleteAnnouncement(deletingId);
                  setDeletingId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
