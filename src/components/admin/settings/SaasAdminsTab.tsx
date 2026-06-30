import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "sonner";
import { Shield, Lock, Trash2, UserPlus, Mail, Calendar } from "lucide-react";

const MASTER_EMAIL = "natanjk7@gmail.com";

interface SaasAdmin {
  user_id: string;
  email: string;
  created_at: string;
}

export function SaasAdminsTab() {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [pendingRemove, setPendingRemove] = useState<SaasAdmin | null>(null);

  const { data: admins, isLoading } = useQuery<SaasAdmin[]>({
    queryKey: ["saas-admins-list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_saas_admins");
      if (error) throw error;
      return (data || []) as SaasAdmin[];
    },
  });

  const grantMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.rpc("grant_saas_admin", { _email: email.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Administrador adicionado com sucesso");
      setNewEmail("");
      queryClient.invalidateQueries({ queryKey: ["saas-admins-list"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Falha ao adicionar administrador");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("revoke_saas_admin", { _user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Administrador removido");
      setPendingRemove(null);
      queryClient.invalidateQueries({ queryKey: ["saas-admins-list"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Falha ao remover administrador");
      setPendingRemove(null);
    },
  });

  const isMaster = (email: string) => email.toLowerCase() === MASTER_EMAIL;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Administradores SaaS
          </CardTitle>
          <CardDescription>
            Apenas administradores SaaS podem gerenciar templates de produtos, itens, linhas e categorias do sistema.
            A conta mestra <code className="font-mono text-xs">{MASTER_EMAIL}</code> é protegida e não pode ser removida.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newEmail.trim()) return;
              grantMutation.mutate(newEmail);
            }}
            className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="new-admin-email">Adicionar administrador por e-mail</Label>
              <Input
                id="new-admin-email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={grantMutation.isPending}
              />
            </div>
            <Button type="submit" disabled={grantMutation.isPending || !newEmail.trim()} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Conceder acesso
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            O usuário precisa já ter uma conta no sistema. Caso contrário, peça para ele se cadastrar primeiro em <code className="font-mono">/auth</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administradores ativos</CardTitle>
          <CardDescription>
            {admins?.length ?? 0} administrador{(admins?.length ?? 0) === 1 ? "" : "es"} com acesso total ao painel SaaS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !admins || admins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum administrador cadastrado.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-md border">
              {admins.map((admin) => {
                const master = isMaster(admin.email);
                return (
                  <div
                    key={admin.user_id}
                    className="flex items-center justify-between gap-3 p-3 sm:p-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {master ? (
                          <Lock className="h-4 w-4 text-primary" />
                        ) : (
                          <Shield className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {admin.email}
                          </span>
                          {master && (
                            <Badge variant="secondary" className="text-xs">
                              Conta mestra
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="h-3 w-3" />
                          Desde {new Date(admin.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    </div>
                    {!master && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => setPendingRemove(admin)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingRemove} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingRemove?.email}</strong> perderá acesso ao painel administrativo do SaaS.
              Esta ação pode ser revertida adicionando o e-mail novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRemove && revokeMutation.mutate(pendingRemove.user_id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
