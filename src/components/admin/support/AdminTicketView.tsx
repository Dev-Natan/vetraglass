import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useSupportTickets, SupportTicket } from '@/hooks/useSupportTickets';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Loader2, User, Shield, Building2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageAttachments } from '@/components/support/MessageAttachments';
import { FileUploadButton } from '@/components/support/FileUploadButton';

interface AdminTicketViewProps {
  ticket: SupportTicket;
  onClose: () => void;
}

const statusOptions = [
  { value: 'open', label: 'Aberto' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'waiting', label: 'Aguardando resposta' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'closed', label: 'Fechado' },
];

const categoryLabels = {
  bug: 'Bug',
  feature: 'Sugestão',
  question: 'Dúvida',
  billing: 'Financeiro',
  other: 'Outro',
};

const priorityLabels = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export function AdminTicketView({ ticket, onClose }: AdminTicketViewProps) {
  const { user } = useAuth();
  const {
    useTicketMessages,
    sendMessage,
    sendMessageLoading,
    updateTicketStatus,
    updateTicketStatusLoading,
  } = useSupportTickets();
  const { data: messages = [], isLoading } = useTicketMessages(ticket.id);
  const [newMessage, setNewMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim() && files.length === 0) return;

    sendMessage(
      { ticketId: ticket.id, content: newMessage || '(arquivo anexado)', files: files.length > 0 ? files : undefined },
      {
        onSuccess: () => {
          setNewMessage('');
          setFiles([]);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStatusChange = (status: string) => {
    updateTicketStatus({ ticketId: ticket.id, status });
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Ticket Info */}
      <div className="space-y-3 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">#{ticket.ticket_number}</p>
            <h3 className="font-medium">{ticket.subject}</h3>
          </div>
          <Select
            value={ticket.status}
            onValueChange={handleStatusChange}
            disabled={updateTicketStatusLoading}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {ticket.company && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span>{ticket.company.name}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR,
              })}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">
            {categoryLabels[ticket.category]}
          </Badge>
          <Badge
            variant={ticket.priority === 'urgent' || ticket.priority === 'high' ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {priorityLabels[ticket.priority]}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Messages */}
      <ScrollArea className="flex-1 py-3" ref={scrollRef}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isOwn = message.user_id === user?.id;

              return (
                <div
                  key={message.id}
                  className={cn('flex gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center h-7 w-7 rounded-full shrink-0',
                      message.is_admin
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {message.is_admin ? (
                      <Shield className="h-3 w-3" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg p-2',
                      isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.attachments && message.attachments.length > 0 && (
                      <MessageAttachments attachments={message.attachments} isOwn={isOwn} />
                    )}
                    <p
                      className={cn(
                        'text-xs mt-1',
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      {format(new Date(message.created_at), "dd/MM 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <Separator />

      {/* Input */}
      <div className="pt-3">
        <div className="flex items-end gap-2">
          <FileUploadButton
            files={files}
            onFilesChange={setFiles}
            disabled={sendMessageLoading}
          />
          <div className="flex-1">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua resposta..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={(!newMessage.trim() && files.length === 0) || sendMessageLoading}
            size="icon"
            className="shrink-0"
          >
            {sendMessageLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
