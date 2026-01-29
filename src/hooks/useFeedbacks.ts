import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type FeedbackCategory = "feature" | "improvement" | "usability" | "integration";
export type FeedbackStatus = "pending" | "under_review" | "planned" | "in_progress" | "completed" | "declined";

export interface Feedback {
  id: string;
  user_id: string;
  company_id: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  admin_response: string | null;
  votes_count: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  user_voted?: boolean;
}

export interface CreateFeedbackData {
  title: string;
  description: string;
  category: FeedbackCategory;
}

export function useFeedbacks(filter?: {
  category?: FeedbackCategory | "all";
  status?: FeedbackStatus | "all";
  onlyMine?: boolean;
  orderBy?: "votes" | "recent";
}) {
  const { user, currentCompany } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all feedbacks
  const feedbacksQuery = useQuery({
    queryKey: ["feedbacks", filter],
    queryFn: async () => {
      let query = supabase
        .from("feedbacks")
        .select("*");

      // Filter by category
      if (filter?.category && filter.category !== "all") {
        query = query.eq("category", filter.category);
      }

      // Filter by status
      if (filter?.status && filter.status !== "all") {
        query = query.eq("status", filter.status);
      }

      // Filter only mine
      if (filter?.onlyMine && user?.id) {
        query = query.eq("user_id", user.id);
      }

      // Order by
      if (filter?.orderBy === "votes") {
        query = query.order("votes_count", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Feedback[];
    },
    enabled: !!user,
  });

  // Fetch user's votes
  const votesQuery = useQuery({
    queryKey: ["feedback-votes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("feedback_votes")
        .select("feedback_id")
        .eq("user_id", user.id);

      if (error) throw error;
      return data.map((v) => v.feedback_id);
    },
    enabled: !!user,
  });

  // Combine feedbacks with vote status
  const feedbacksWithVotes = feedbacksQuery.data?.map((feedback) => ({
    ...feedback,
    user_voted: votesQuery.data?.includes(feedback.id) ?? false,
  }));

  // Create feedback mutation
  const createFeedback = useMutation({
    mutationFn: async (data: CreateFeedbackData) => {
      if (!user?.id || !currentCompany?.id) {
        throw new Error("Usuário ou empresa não encontrado");
      }

      const { data: newFeedback, error } = await supabase
        .from("feedbacks")
        .insert({
          user_id: user.id,
          company_id: currentCompany.id,
          title: data.title,
          description: data.description,
          category: data.category,
        })
        .select()
        .single();

      if (error) throw error;
      return newFeedback;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
      toast.success("Sugestão enviada com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating feedback:", error);
      toast.error("Erro ao enviar sugestão");
    },
  });

  // Toggle vote mutation
  const toggleVote = useMutation({
    mutationFn: async (feedbackId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const hasVoted = votesQuery.data?.includes(feedbackId);

      if (hasVoted) {
        // Remove vote
        const { error } = await supabase
          .from("feedback_votes")
          .delete()
          .eq("feedback_id", feedbackId)
          .eq("user_id", user.id);

        if (error) throw error;
        return { action: "removed" };
      } else {
        // Add vote
        const { error } = await supabase
          .from("feedback_votes")
          .insert({
            feedback_id: feedbackId,
            user_id: user.id,
          });

        if (error) throw error;
        return { action: "added" };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-votes"] });
      toast.success(result.action === "added" ? "Voto adicionado!" : "Voto removido");
    },
    onError: (error) => {
      console.error("Error toggling vote:", error);
      toast.error("Erro ao votar");
    },
  });

  // Delete feedback mutation
  const deleteFeedback = useMutation({
    mutationFn: async (feedbackId: string) => {
      const { error } = await supabase
        .from("feedbacks")
        .delete()
        .eq("id", feedbackId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
      toast.success("Sugestão excluída");
    },
    onError: (error) => {
      console.error("Error deleting feedback:", error);
      toast.error("Erro ao excluir sugestão");
    },
  });

  return {
    feedbacks: feedbacksWithVotes ?? [],
    isLoading: feedbacksQuery.isLoading || votesQuery.isLoading,
    error: feedbacksQuery.error || votesQuery.error,
    createFeedback,
    toggleVote,
    deleteFeedback,
    refetch: () => {
      feedbacksQuery.refetch();
      votesQuery.refetch();
    },
  };
}

// Category helpers
export const feedbackCategories: { value: FeedbackCategory; label: string; icon: string }[] = [
  { value: "feature", label: "Nova Funcionalidade", icon: "💡" },
  { value: "improvement", label: "Melhoria", icon: "📈" },
  { value: "usability", label: "Usabilidade", icon: "✨" },
  { value: "integration", label: "Integração", icon: "🔗" },
];

export const feedbackStatuses: { value: FeedbackStatus; label: string; color: string }[] = [
  { value: "pending", label: "Aguardando", color: "secondary" },
  { value: "under_review", label: "Em Análise", color: "warning" },
  { value: "planned", label: "Planejado", color: "default" },
  { value: "in_progress", label: "Em Desenvolvimento", color: "default" },
  { value: "completed", label: "Concluído", color: "success" },
  { value: "declined", label: "Não Aprovado", color: "destructive" },
];

export function getCategoryInfo(category: FeedbackCategory) {
  return feedbackCategories.find((c) => c.value === category) ?? feedbackCategories[0];
}

export function getStatusInfo(status: FeedbackStatus) {
  return feedbackStatuses.find((s) => s.value === status) ?? feedbackStatuses[0];
}
