import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSupportTickets, SupportTicket } from '@/hooks/useSupportTickets';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Send, Loader2, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageAttachments } from './MessageAttachments';
import { FileUploadButton } from './FileUploadButton';

interface SupportChatProps {
  ticket: SupportTicket;
  onBack: () => void;
}

const statusConfig = {
  open: { label: 'Aberto', variant: 'default' as const },
  in_progress: { label: 'Em andamento', variant: 'secondary' as const },
  waiting: { label: 'Aguardando', variant: 'outline' as const },
  resolved: { label: 'Resolvido', variant: 'default' as const },
  closed: { label: 'Fechado', variant: 'secondary' as const },
};

export function SupportChat({ ticket, onBack }: SupportChatProps) {
  const { user } = useAuth();
  const { useTicketMessages, sendMessage, sendMessageLoading } = useSupportTickets();
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

  const status = statusConfig[ticket.status];
  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                #{ticket.ticket_number}
              </span>
              <Badge variant={status.variant} className="text-xs">
                {status.label}
              </Badge>
            </div>
            <h3 className="font-medium truncate">{ticket.subject}</h3>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwn = message.user_id === user?.id;
              
              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    isOwn ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center h-8 w-8 rounded-full shrink-0',
                      message.is_admin
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {message.is_admin ? (
                      <Shield className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'max-w-[75%] rounded-lg p-3',
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
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

      {/* Input */}
      {!isClosed ? (
        <div className="p-4 border-t border-border">
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
                placeholder="Digite sua mensagem..."
                rows={2}
                className="resize-none"
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
      ) : (
        <div className="p-4 border-t border-border text-center text-sm text-muted-foreground">
          Este ticket foi {ticket.status === 'resolved' ? 'resolvido' : 'fechado'}
        </div>
      )}
    </div>
  );
}
