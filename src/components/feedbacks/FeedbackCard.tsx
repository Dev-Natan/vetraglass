import { ChevronUp, Trash2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Feedback, getCategoryInfo, getStatusInfo } from "@/hooks/useFeedbacks";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FeedbackCardProps {
  feedback: Feedback;
  onVote: (id: string) => void;
  onDelete: (id: string) => void;
  isVoting?: boolean;
}

export function FeedbackCard({ feedback, onVote, onDelete, isVoting }: FeedbackCardProps) {
  const { user } = useAuth();
  const isOwner = user?.id === feedback.user_id;
  const categoryInfo = getCategoryInfo(feedback.category);
  const statusInfo = getStatusInfo(feedback.status);

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

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Vote Button */}
          <div className="flex flex-col items-center">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-12 w-12 flex flex-col p-0 hover:bg-primary/10",
                feedback.user_voted && "text-primary bg-primary/10"
              )}
              onClick={() => onVote(feedback.id)}
              disabled={isVoting}
            >
              <ChevronUp className={cn("h-5 w-5", feedback.user_voted && "fill-current")} />
              <span className="text-sm font-semibold">{feedback.votes_count}</span>
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-medium text-foreground line-clamp-2">
                {feedback.title}
              </h3>
              {isOwner && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir sugestão?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. A sugestão será removida permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(feedback.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {feedback.description}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <span className="mr-1">{categoryInfo.icon}</span>
                {categoryInfo.label}
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

            {/* Admin Response */}
            {feedback.admin_response && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <MessageSquare className="h-3 w-3" />
                  <span>Resposta da equipe</span>
                </div>
                <p className="text-sm">{feedback.admin_response}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
