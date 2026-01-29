import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Lightbulb, Plus, TrendingUp, Clock } from "lucide-react";
import {
  useFeedbacks,
  feedbackCategories,
  FeedbackCategory,
} from "@/hooks/useFeedbacks";
import { FeedbackCard } from "@/components/feedbacks/FeedbackCard";
import { NewFeedbackDialog } from "@/components/feedbacks/NewFeedbackDialog";

export default function Feedbacks() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "mine" | "roadmap" | "completed">("all");
  const [category, setCategory] = useState<FeedbackCategory | "all">("all");
  const [orderBy, setOrderBy] = useState<"votes" | "recent">("votes");

  // Determine filter based on tab
  const getFilter = () => {
    const baseFilter = {
      category: category as FeedbackCategory | "all",
      orderBy,
    };

    switch (tab) {
      case "mine":
        return { ...baseFilter, onlyMine: true };
      case "roadmap":
        return { ...baseFilter, status: "planned" as const };
      case "completed":
        return { ...baseFilter, status: "completed" as const };
      default:
        return baseFilter;
    }
  };

  const { feedbacks, isLoading, toggleVote, deleteFeedback } = useFeedbacks(getFilter());

  const handleVote = (id: string) => {
    toggleVote.mutate(id);
  };

  const handleDelete = (id: string) => {
    deleteFeedback.mutate(id);
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Sugestões e Melhorias</h1>
            </div>
            <p className="text-muted-foreground">
              Compartilhe suas ideias e vote nas sugestões da comunidade
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Sugestão
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="mine">Minhas</TabsTrigger>
            <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
            <TabsTrigger value="completed">Concluídas</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={category} onValueChange={(v) => setCategory(v as FeedbackCategory | "all")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {feedbackCategories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  <span className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={orderBy} onValueChange={(v) => setOrderBy(v as "votes" | "recent")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="votes">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Mais votadas
                </span>
              </SelectItem>
              <SelectItem value="recent">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Mais recentes
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma sugestão encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {tab === "mine"
                ? "Você ainda não enviou nenhuma sugestão"
                : "Seja o primeiro a compartilhar uma ideia!"}
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar sugestão
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((feedback) => (
              <FeedbackCard
                key={feedback.id}
                feedback={feedback}
                onVote={handleVote}
                onDelete={handleDelete}
                isVoting={toggleVote.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <NewFeedbackDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </MainLayout>
  );
}
