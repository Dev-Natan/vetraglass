import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, MessageSquare, ChevronUp } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Feedback,
  FeedbackStatus,
  feedbackStatuses,
  getCategoryInfo,
  getStatusInfo,
} from "@/hooks/useFeedbacks";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminFeedbacks() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [newStatus, setNewStatus] = useState<FeedbackStatus>("pending");
  const [adminResponse, setAdminResponse] = useState("");

  // Fetch all feedbacks
  const { data: feedbacks, isLoading } = useQuery({
    queryKey: ["admin-feedbacks", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("feedbacks")
        .select("*")
        .order("votes_count", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Feedback[];
    },
  });

  // Update feedback mutation
  const updateFeedback = useMutation({
    mutationFn: async ({
      id,
      status,
      admin_response,
    }: {
      id: string;
      status: FeedbackStatus;
      admin_response?: string;
    }) => {
      const { error } = await supabase
        .from("feedbacks")
        .update({
          status,
          admin_response: admin_response || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedbacks"] });
      toast.success("Feedback atualizado!");
      setSelectedFeedback(null);
    },
    onError: (error) => {
      console.error("Error updating feedback:", error);
      toast.error("Erro ao atualizar feedback");
    },
  });

  const handleOpenDialog = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setNewStatus(feedback.status);
    setAdminResponse(feedback.admin_response || "");
  };

  const handleSave = () => {
    if (!selectedFeedback) return;
    updateFeedback.mutate({
      id: selectedFeedback.id,
      status: newStatus,
      admin_response: adminResponse,
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default" as const;
      case "in_progress":
        return "default" as const;
      case "planned":
        return "secondary" as const;
      case "under_review":
        return "outline" as const;
      case "declined":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  const pendingCount = feedbacks?.filter((f) => f.status === "pending").length ?? 0;

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Gerenciar Feedbacks</h1>
            <p className="text-muted-foreground">
              {pendingCount > 0
                ? `${pendingCount} sugestões aguardando análise`
                : "Todas as sugestões foram analisadas"}
            </p>
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as FeedbackStatus | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {feedbackStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : feedbacks?.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum feedback encontrado</h3>
          </div>
        ) : (
          <div className="grid gap-4">
            {feedbacks?.map((feedback) => {
              const categoryInfo = getCategoryInfo(feedback.category);
              const statusInfo = getStatusInfo(feedback.status);

              return (
                <Card key={feedback.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Votes */}
                      <div className="flex flex-col items-center justify-center px-3 py-2 bg-muted/50 rounded-lg">
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        <span className="text-lg font-bold">{feedback.votes_count}</span>
                        <span className="text-xs text-muted-foreground">votos</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-medium">{feedback.title}</h3>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(feedback)}
                          >
                            Gerenciar
                          </Button>
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {feedback.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {categoryInfo.icon} {categoryInfo.label}
                          </Badge>
                          <Badge variant={getStatusVariant(feedback.status)} className="text-xs">
                            {statusInfo.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatDistanceToNow(new Date(feedback.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>

                        {feedback.admin_response && (
                          <div className="mt-2 p-2 bg-primary/5 rounded text-sm">
                            <span className="text-xs text-muted-foreground">Resposta: </span>
                            {feedback.admin_response}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Gerenciar Feedback</DialogTitle>
              <DialogDescription>{selectedFeedback?.title}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                {selectedFeedback?.description}
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as FeedbackStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {feedbackStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Resposta (opcional)</Label>
                <Textarea
                  placeholder="Adicione uma resposta ou comentário para o usuário..."
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedFeedback(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={updateFeedback.isPending}>
                {updateFeedback.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
