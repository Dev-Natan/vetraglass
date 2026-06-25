import { Quote, QuoteStatus } from '@/services/quoteService';
import { openWhatsapp } from '@/utils/whatsapp';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  User, 
  MapPin, 
  Phone, 
  Calendar, 
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Copy,
  FileSignature,
  Printer,
  RotateCcw,
  MessageCircle,
  Download
} from 'lucide-react';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Card as UICard, CardContent as UICardContent } from '@/components/ui/card';

interface QuoteCardProps {
  quote: Quote;
  statusConfig: any;
  formatCurrency: (val: number) => string;
  onView: (quote: Quote) => void;
  onEdit: (quote: Quote) => void;
  onDuplicate: (quote: Quote) => void;
  onPrint: (quote: Quote) => void;
  onApprove: (quote: Quote) => void;
  onReject: (quote: Quote) => void;
  onReopen: (quote: Quote) => void;
  onDelete: (quote: Quote) => void;
  onGenerateContract: (quote: Quote) => void;
  onCancelApproved: (quote: Quote) => void;
}

export function QuoteCard({
  quote,
  statusConfig,
  formatCurrency,
  onView,
  onEdit,
  onDuplicate,
  onPrint,
  onApprove,
  onReject,
  onReopen,
  onDelete,
  onGenerateContract,
  onCancelApproved
}: QuoteCardProps) {
  const status = statusConfig[quote.status as QuoteStatus] || statusConfig.pending;
  const StatusIcon = status.icon;

  const statusBadgeClass =
    quote.status === 'pending'
      ? 'bg-amber-100 text-amber-800 border border-amber-200'
      : quote.status === 'approved' || quote.status === 'converted'
      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      : quote.status === 'rejected'
      ? 'bg-rose-100 text-rose-800 border border-rose-200'
      : 'bg-slate-100 text-slate-800 border border-slate-200';

  return (
    <UICard className="overflow-hidden hover:shadow-md transition-shadow">
      <UICardContent className="p-0">
        <div className="p-4 sm:p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  #{String(quote.quote_number).padStart(4, '0')}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass}`}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </span>
              </div>
              <h3 className="font-bold text-base sm:text-lg line-clamp-1">{quote.customer_name}</h3>
            </div>

            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onView(quote)}>
                  <Eye className="w-4 h-4 mr-2" /> Visualizar
                </DropdownMenuItem>
                
                {quote.status === 'pending' && (
                  <>
                    <DropdownMenuItem onClick={() => onEdit(quote)}>
                      <Edit className="w-4 h-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onApprove(quote)} className="text-primary font-medium">
                      <CheckCircle className="w-4 h-4 mr-2" /> Aprovar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onReject(quote)} className="text-destructive">
                      <XCircle className="w-4 h-4 mr-2" /> Rejeitar
                    </DropdownMenuItem>
                  </>
                )}

                {(quote.status === 'approved' || quote.status === 'converted') && (
                  <>
                    <DropdownMenuItem onClick={() => onReopen(quote)}>
                      <RotateCcw className="w-4 h-4 mr-2" /> Reabrir (Pendente)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onCancelApproved(quote)} className="text-destructive">
                      <XCircle className="w-4 h-4 mr-2" /> Cancelar Aprovação
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDuplicate(quote)}>
                  <Copy className="w-4 h-4 mr-2" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onGenerateContract(quote)}>
                  <FileSignature className="w-4 h-4 mr-2" /> Gerar Contrato
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPrint(quote)}>
                  <Printer className="w-4 h-4 mr-2" /> Imprimir
                </DropdownMenuItem>
                
                {quote.status !== 'approved' && quote.status !== 'converted' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(quote)} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2 mb-4">
            {quote.customer_address && (
              <div className="flex items-center text-xs sm:text-sm text-muted-foreground gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="line-clamp-1">{quote.customer_address}</span>
              </div>
            )}
            {quote.customer_phone && (
              <div className="flex items-center text-xs sm:text-sm text-muted-foreground gap-2">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>{quote.customer_phone}</span>
              </div>
            )}
            <div className="flex items-center text-xs sm:text-sm text-muted-foreground gap-2">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{format(new Date(quote.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}</span>
            </div>
          </div>
        </div>

        <div className="bg-muted/30 px-4 py-3 sm:px-5 flex items-center justify-between border-t mt-auto">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</span>
            <span className="text-sm sm:text-base font-bold text-foreground">
              {formatCurrency(quote.final_amount)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-2 h-8 w-8"
              title="Enviar via WhatsApp"
              onClick={() => {
                const phone = (quote.customer_phone || '').replace(/\D/g, '');
                const numero = phone ? (phone.length <= 11 ? '55' + phone : phone) : '';
                const mensagem = encodeURIComponent(
                  `Olá ${quote.customer_name}, segue o seu orçamento #${String(quote.quote_number).padStart(4, '0')} para análise. Qualquer dúvida, estou à disposição!`
                );
                const url = `https://wa.me/${numero}?text=${mensagem}`;
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 h-8 w-8"
              title="Gerar PDF"
              onClick={() => onPrint(quote)}
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary hover:bg-primary/10 gap-1 h-8 px-2"
              onClick={() => onView(quote)}
            >
              Detalhes
              <Eye className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

      </UICardContent>
    </UICard>
  );
}
