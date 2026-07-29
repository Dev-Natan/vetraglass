import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, User, Receipt, Calendar, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const methodLabel: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
};

interface Payment {
  id: string;
  amount: number;
  payment_method?: string | null;
  description?: string | null;
  created_at: string;
}

interface ExtratoRecebimentosProps {
  clientName: string;
  clientDocument?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  saleNumber?: number | null;
  quoteNumber?: number | null;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  saleStatus?: string | null;
  saleType?: string | null;
  createdAt?: string | null;
  payments: Payment[];
  companyName?: string;
}

export function ExtratoRecebimentos({
  clientName,
  clientDocument,
  clientPhone,
  clientEmail,
  saleNumber,
  quoteNumber,
  totalAmount,
  paidAmount,
  pendingAmount,
  saleStatus,
  saleType,
  createdAt,
  payments,
  companyName = 'Vetra Glass',
}: ExtratoRecebimentosProps) {
  const sortedPayments = [...payments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const isPaid = pendingAmount <= 0.009;
  const isPartial = !isPaid && paidAmount > 0.009;
  const statusLabel = isPaid ? 'Quitado' : isPartial ? 'Parcial' : 'Pendente';
  const statusColor = isPaid
    ? '#10b981'
    : isPartial
    ? '#f59e0b'
    : '#ef4444';

  let runningBalance = totalAmount;

  return (
    <div className="bg-white text-slate-900 p-8" style={{ width: '794px', minHeight: '1123px', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{companyName}</h1>
          <p className="text-sm text-slate-600 mt-1">Extrato de Recebimentos</p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4" />
            {format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}
          </div>
          <p className="text-xs text-slate-500 mt-1">Documento gerado automaticamente</p>
        </div>
      </div>

      {/* Client & Sale Info */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold uppercase text-slate-500">
            <User className="h-4 w-4" /> Cliente
          </div>
          <p className="text-lg font-semibold">{clientName}</p>
          {clientDocument && <p className="text-sm text-slate-600">{clientDocument}</p>}
          {clientPhone && <p className="text-sm text-slate-600">{clientPhone}</p>}
          {clientEmail && <p className="text-sm text-slate-600">{clientEmail}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold uppercase text-slate-500">
            <FileText className="h-4 w-4" /> Vínculo
          </div>
          <p className="text-lg font-semibold">
            {saleNumber ? `Venda #${String(saleNumber).padStart(4, '0')}` : 'Venda'}
            {quoteNumber ? ` · Orç. #${String(quoteNumber).padStart(4, '0')}` : ''}
          </p>
          {createdAt && (
            <p className="text-sm text-slate-600">
              {format(new Date(createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}40` }}>
            {isPaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {statusLabel}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
          <p className="text-xs font-bold uppercase text-slate-500 mb-1">Valor Total</p>
          <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="p-4 rounded-lg border border-emerald-100 bg-emerald-50">
          <p className="text-xs font-bold uppercase text-emerald-700 mb-1">Total Recebido</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(paidAmount)}</p>
        </div>
        <div className="p-4 rounded-lg border border-amber-100 bg-amber-50">
          <p className="text-xs font-bold uppercase text-amber-700 mb-1">Saldo Devedor</p>
          <p className="text-xl font-bold text-amber-700">{formatCurrency(Math.max(0, pendingAmount))}</p>
        </div>
      </div>

      {/* Payment History */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm font-bold uppercase text-slate-500 mb-3">
          <Receipt className="h-4 w-4" /> Histórico de Recebimentos
        </div>

        {sortedPayments.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg">
            Nenhum recebimento registrado para esta venda/orçamento.
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="text-left p-3 font-semibold border border-slate-200">#</th>
                <th className="text-left p-3 font-semibold border border-slate-200">Data / Hora</th>
                <th className="text-left p-3 font-semibold border border-slate-200">Forma</th>
                <th className="text-left p-3 font-semibold border border-slate-200">Descrição</th>
                <th className="text-right p-3 font-semibold border border-slate-200">Valor</th>
                <th className="text-right p-3 font-semibold border border-slate-200">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {sortedPayments.map((payment, index) => {
                runningBalance -= Number(payment.amount) || 0;
                return (
                  <tr key={payment.id} className="border-b border-slate-100">
                    <td className="p-3 border border-slate-200 text-slate-500">{index + 1}</td>
                    <td className="p-3 border border-slate-200">
                      {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </td>
                    <td className="p-3 border border-slate-200">
                      {methodLabel[payment.payment_method ?? ''] || payment.payment_method || '—'}
                    </td>
                    <td className="p-3 border border-slate-200 text-slate-600">
                      {payment.description || 'Recebimento parcial'}
                    </td>
                    <td className="p-3 border border-slate-200 text-right font-semibold text-emerald-700">
                      + {formatCurrency(Number(payment.amount) || 0)}
                    </td>
                    <td className="p-3 border border-slate-200 text-right font-semibold">
                      {formatCurrency(Math.max(0, runningBalance))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer summary */}
      <div className="mt-auto pt-6 border-t border-slate-200">
        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-slate-600" />
            <span className="font-semibold text-slate-700">Saldo restante</span>
          </div>
          <span className="text-2xl font-bold" style={{ color: statusColor }}>
            {formatCurrency(Math.max(0, pendingAmount))}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-4 text-center">
          Este extrato é um resumo financeiro e não substitui documentos fiscais oficiais.
        </p>
      </div>
    </div>
  );
}
