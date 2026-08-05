import { Quote, QuoteStatus } from '@/services/quoteService';
import { openWhatsapp } from '@/utils/whatsapp';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  MessageCircle, Download, Eye, MoreVertical, Edit, Copy, FileSignature,
  Printer, CheckCircle, XCircle, RotateCcw, Trash2, Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface QuotesTableViewProps {
  quotes: Quote[];
  statusConfig: any;
  formatCurrency: (val: number) => string;
  partialByQuoteId?: Map<string, { isPartial: boolean }>;
  onNewReceipt?: (quote: Quote) => void;
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

const statusBadgeClass = (status: QuoteStatus, isPartial: boolean) =>
  isPartial
    ? 'bg-blue-100 text-blue-800 border border-blue-200'
    : status === 'pending'
    ? 'bg-amber-100 text-amber-800 border border-amber-200'
    : status === 'approved' || status === 'converted'
    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    : status === 'rejected'
    ? 'bg-rose-100 text-rose-800 border border-rose-200'
    : 'bg-slate-100 text-slate-800 border border-slate-200';

export function QuotesTableView({
  quotes,
  statusConfig,
  formatCurrency,
  partialByQuoteId,
  onNewReceipt,
  onView,
  onEdit,
  onDuplicate,
  onPrint,
  onApprove,
  onReject,
  onReopen,
  onDelete,
  onGenerateContract,
  onCancelApproved,
}: QuotesTableViewProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">#</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell w-[140px]">Data</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="text-right w-[130px]">Total</TableHead>
              <TableHead className="text-right w-[190px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => {
              const status = statusConfig[quote.status as QuoteStatus] || statusConfig.pending;
              const isPartial = partialByQuoteId?.get(quote.id)?.isPartial ?? false;
              const StatusIcon = isPartial ? Wallet : status.icon;
              const isPending = quote.status === 'pending';
              const isApprovedOrConverted = quote.status === 'approved' || quote.status === 'converted';
              return (
                <TableRow
                  key={quote.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onView(quote)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{String(quote.quote_number).padStart(4, '0')}
                  </TableCell>
                  <TableCell className="font-medium line-clamp-1">{quote.customer_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(quote.status as QuoteStatus, isPartial)}`}>
                      <StatusIcon className="w-3 h-3" />
                      {isPartial ? 'Parcial' : status.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(quote.final_amount)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 w-8"
                        title="Enviar via WhatsApp"
                        onClick={() => {
                          const mensagem = `Olá ${quote.customer_name}, segue o seu orçamento #${String(quote.quote_number).padStart(4, '0')} para análise. Qualquer dúvida, estou à disposição!`;
                          openWhatsapp(quote.customer_phone, mensagem);
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8"
                        title="Gerar PDF"
                        onClick={() => onPrint(quote)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      {isPending && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-primary hover:text-primary hover:bg-primary/10 h-8 w-8"
                          title="Editar"
                          onClick={() => onEdit(quote)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      {onNewReceipt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary hover:bg-primary/10 gap-1 h-8 px-2"
                          title="Novo Recebimento"
                          onClick={() => onNewReceipt(quote)}
                        >
                          <Wallet className="w-4 h-4" />
                          <span className="hidden sm:inline">Receber</span>
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Mais ações">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onView(quote)}>
                            <Eye className="w-4 h-4 mr-2" /> Visualizar
                          </DropdownMenuItem>

                          {isPending && (
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

                          {isApprovedOrConverted && (
                            <>
                              {onNewReceipt && (
                                <DropdownMenuItem onClick={() => onNewReceipt(quote)} className="text-primary font-medium">
                                  <Wallet className="w-4 h-4 mr-2" /> Novo Recebimento
                                </DropdownMenuItem>
                              )}
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

                          {!isApprovedOrConverted && (
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
