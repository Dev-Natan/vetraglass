import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Download, MessageCircle, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateReciboPdf, type ReciboData, type ReciboCompany } from '@/utils/generateReciboPdf';
import { openWhatsapp } from '@/utils/whatsapp';
import { toast } from 'sonner';

interface ReciboOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  os: {
    os_number: number;
    customer_name: string;
    customer_phone?: string | null;
    customer_document?: string | null;
    customer_address?: string | null;
    total_amount: number;
    paid_amount?: number | null;
  };
  company: ReciboCompany | null;
}

export function ReciboOSDialog({ open, onOpenChange, os, company }: ReciboOSDialogProps) {
  const defaultPaid = Number(os.paid_amount ?? os.total_amount ?? 0);
  const [amount, setAmount] = useState<number>(defaultPaid);
  const [description, setDescription] = useState<string>('');

  const buildData = (): ReciboData => ({
    os_number: os.os_number,
    customer_name: os.customer_name,
    customer_document: os.customer_document ?? null,
    customer_address: os.customer_address ?? null,
    total_amount: Number(os.total_amount || 0),
    paid_amount: Number(amount || 0),
    payment_date: new Date().toISOString(),
    description: description.trim() || null,
  });

  const handleDownload = () => {
    try {
      generateReciboPdf(buildData(), company, 'download');
      toast.success('Recibo gerado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar recibo');
    }
  };

  const handleWhatsApp = () => {
    if (!os.customer_phone) {
      toast.error('Cliente sem telefone cadastrado');
      return;
    }
    const message =
      `*Recibo de Pagamento*\n\n` +
      `Olá ${os.customer_name},\n\n` +
      `Confirmamos o recebimento de *${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}* ` +
      `referente à OS Nº ${os.os_number.toString().padStart(4, '0')}.\n\n` +
      `Data: ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}\n` +
      (company?.name ? `\n_${company.name}_` : '');

    // Also trigger PDF download so user can attach manually on WhatsApp Web
    try {
      generateReciboPdf(buildData(), company, 'download');
    } catch {
      // ignore
    }
    const opened = openWhatsapp(os.customer_phone, message);
    if (opened) {
      toast.success('WhatsApp aberto. O PDF foi baixado — anexe-o à conversa.');
    } else {
      toast.error('Não foi possível abrir o WhatsApp');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Emitir Recibo — OS #{os.os_number.toString().padStart(4, '0')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{os.customer_name}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Total da OS</span>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  Number(os.total_amount || 0),
                )}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recibo-amount">Valor recebido (R$)</Label>
            <Input
              id="recibo-amount"
              type="number"
              step="0.01"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recibo-desc">Descrição (opcional)</Label>
            <Textarea
              id="recibo-desc"
              rows={2}
              placeholder="Ex: Pagamento final referente à instalação dos vidros."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleWhatsApp}
            className="gap-2 w-full sm:w-auto"
            disabled={!os.customer_phone || amount <= 0}
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </Button>
          <Button onClick={handleDownload} className="gap-2 w-full sm:w-auto" disabled={amount <= 0}>
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
