import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Phone,
  Mail,
  IdCard,
  CalendarDays,
  Receipt,
  FileText,
  MessageCircle,
} from 'lucide-react';

export interface ReceivableDetails {
  id: string;
  customer_name: string | null;
  description: string | null;
  total_amount: number;
  paid_amount: number | null;
  installment_number: number;
  total_installments: number;
  due_date: string;
  status: string;
  notes: string | null;
  sale_id: string | null;
  quote_id: string | null;
  ordem_servico_id: string | null;
  client?: {
    name: string | null;
    phone: string | null;
    email: string | null;
    document: string | null;
  } | null;
}

interface ReceivableDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivable: ReceivableDetails | null;
  onReceive?: (receivable: ReceivableDetails) => void;
}

const fmt = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const onlyDigits = (v: string) => v.replace(/\D/g, '');

export function getReceivableOrigin(r: {
  sale_id: string | null;
  quote_id: string | null;
  ordem_servico_id: string | null;
}) {
  if (r.ordem_servico_id) return 'Ordem de Serviço';
  if (r.sale_id) return 'Venda';
  if (r.quote_id) return 'Orçamento';
  return 'Lançamento manual';
}

export function ReceivableDetailsDialog({
  open,
  onOpenChange,
  receivable,
  onReceive,
}: ReceivableDetailsDialogProps) {
  if (!receivable) return null;

  const client = receivable.client;
  const name = client?.name || receivable.customer_name || 'Cliente não informado';
  const phone = client?.phone || null;
  const due = receivable.due_date ? parseISO(receivable.due_date) : null;
  const overdue =
    !!due && receivable.status !== 'paid' && isPast(due) && !isToday(due);
  const saldo = Math.max(
    0,
    Number(receivable.total_amount || 0) - Number(receivable.paid_amount || 0),
  );

  const whatsappHref = phone
    ? `https://wa.me/55${onlyDigits(phone)}?text=${encodeURIComponent(
        `Olá ${name}, tudo bem? Estamos entrando em contato sobre a parcela de ${fmt(
          saldo,
        )} com vencimento em ${due ? format(due, 'dd/MM/yyyy') : '—'}.`,
      )}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Detalhes da cobrança
          </DialogTitle>
          <DialogDescription>
            Informações completas para facilitar o contato e a cobrança.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{name}</span>
            </div>
            {client?.document && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IdCard className="w-3.5 h-3.5" />
                {client.document}
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                {phone}
              </div>
            )}
            {client?.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />
                {client.email}
              </div>
            )}
            {!phone && !client?.email && (
              <p className="text-xs text-muted-foreground">
                Nenhum contato cadastrado para este cliente.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Vencimento</p>
              <p className={`font-medium flex items-center gap-1 ${overdue ? 'text-destructive' : ''}`}>
                <CalendarDays className="w-3.5 h-3.5" />
                {due ? format(due, 'dd/MM/yyyy', { locale: ptBR }) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Parcela</p>
              <p className="font-medium">
                {receivable.installment_number}/{receivable.total_installments}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor da parcela</p>
              <p className="font-semibold">{fmt(Number(receivable.total_amount))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo em aberto</p>
              <p className="font-semibold text-primary">{fmt(saldo)}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">O que foi vendido</span>
              <Badge variant="outline" className="ml-auto">
                {getReceivableOrigin(receivable)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {receivable.description || 'Sem descrição registrada.'}
            </p>
            {receivable.notes && (
              <p className="text-xs text-muted-foreground italic">{receivable.notes}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {whatsappHref && (
            <Button variant="outline" asChild>
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle className="w-4 h-4 mr-1" />
                Cobrar no WhatsApp
              </a>
            </Button>
          )}
          {onReceive && receivable.status !== 'paid' && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onReceive(receivable);
              }}
            >
              <Receipt className="w-4 h-4 mr-1" />
              Registrar recebimento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
