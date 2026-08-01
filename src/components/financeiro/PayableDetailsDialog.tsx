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
  Building2,
  Phone,
  Mail,
  IdCard,
  CalendarDays,
  FileText,
  CheckCircle,
  MessageCircle,
} from 'lucide-react';

export interface PayableDetails {
  id: string;
  description: string;
  amount: number;
  paid_amount: number | null;
  due_date: string | null;
  paid_date: string | null;
  status: string;
  supplier_name: string | null;
  supplier_document: string | null;
  document_number: string | null;
  installment_number: number;
  total_installments: number;
  notes: string | null;
  supplier?: {
    name: string | null;
    phone: string | null;
    email: string | null;
    document: string | null;
  } | null;
  categoryName?: string | null;
}

interface PayableDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payable: PayableDetails | null;
  onPay?: (payable: PayableDetails) => void;
}

const fmt = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const onlyDigits = (v: string) => v.replace(/\D/g, '');

export function PayableDetailsDialog({
  open,
  onOpenChange,
  payable,
  onPay,
}: PayableDetailsDialogProps) {
  if (!payable) return null;

  const supplier = payable.supplier;
  const name = supplier?.name || payable.supplier_name || 'Fornecedor não informado';
  const phone = supplier?.phone || null;
  const document = supplier?.document || payable.supplier_document || null;
  const due = payable.due_date ? parseISO(payable.due_date) : null;
  const overdue = !!due && payable.status !== 'paid' && isPast(due) && !isToday(due);

  const whatsappHref = phone
    ? `https://wa.me/55${onlyDigits(phone)}?text=${encodeURIComponent(
        `Olá ${name}, tudo bem? Estamos entrando em contato sobre o título "${payable.description}" no valor de ${fmt(
          Number(payable.amount),
        )} com vencimento em ${due ? format(due, 'dd/MM/yyyy') : '—'}.`,
      )}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Detalhes da conta a pagar
          </DialogTitle>
          <DialogDescription>
            Dados completos do título e do fornecedor de destino.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{name}</span>
            </div>
            {document && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IdCard className="w-3.5 h-3.5" />
                {document}
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                {phone}
              </div>
            )}
            {supplier?.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />
                {supplier.email}
              </div>
            )}
            {!phone && !supplier?.email && (
              <p className="text-xs text-muted-foreground">
                Nenhum contato cadastrado para este fornecedor.
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
                {payable.total_installments > 1
                  ? `${payable.installment_number}/${payable.total_installments}`
                  : 'À vista'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="font-semibold">{fmt(Number(payable.amount))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {payable.status === 'paid' ? 'Pago em' : 'Categoria'}
              </p>
              <p className="font-medium">
                {payable.status === 'paid'
                  ? payable.paid_date
                    ? format(parseISO(payable.paid_date), 'dd/MM/yyyy')
                    : '—'
                  : payable.categoryName || '—'}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Descrição</span>
              {payable.document_number && (
                <Badge variant="outline" className="ml-auto">
                  Doc: {payable.document_number}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {payable.description || 'Sem descrição registrada.'}
            </p>
            {payable.notes && (
              <p className="text-xs text-muted-foreground italic">{payable.notes}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {whatsappHref && (
            <Button variant="outline" asChild>
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle className="w-4 h-4 mr-1" />
                Falar no WhatsApp
              </a>
            </Button>
          )}
          {onPay && payable.status !== 'paid' && payable.status !== 'cancelled' && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onPay(payable);
              }}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Registrar pagamento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
