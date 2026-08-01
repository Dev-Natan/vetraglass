import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { format, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, User, Phone, Mail, MapPin, FileText,
  AlertTriangle, Receipt, TrendingUp, Wallet, ShieldCheck,
  MessageCircle, Eye, Download, Loader2, LineChart,
  Share2, Send, CreditCard, FileDown, ClipboardList,
} from 'lucide-react';
import { ExtratoRecebimentos } from '@/components/caixa/ExtratoRecebimentos';
import { openWhatsapp } from '@/utils/whatsapp';
import { downloadElementAsPdf, elementToPdfBlob } from '@/utils/printableToPdf';
import { uploadPdfForSharing, shareViaWhatsApp, shareViaEmail } from '@/utils/sharePdf';
import { toast } from 'sonner';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const methodConfig: Record<string, { label: string; className: string }> = {
  dinheiro: { label: 'Dinheiro', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  cartao:   { label: 'Cartão',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  pix:      { label: 'PIX',      className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
};

const quoteStatusBadge = (q: { status: string; sale_type?: string | null; pending_amount?: number | null }) => {
  if (q.status === 'pending')   return { label: 'Pendente',  className: 'bg-amber-100 text-amber-800 border-amber-200' };
  if (q.status === 'rejected')  return { label: 'Rejeitado', className: 'bg-rose-100 text-rose-800 border-rose-200' };
  if (q.status === 'cancelled') return { label: 'Cancelado', className: 'bg-slate-100 text-slate-800 border-slate-200' };
  if (q.status === 'completed') return { label: 'Quitado',   className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if ((q.pending_amount ?? 0) > 0 && (q.sale_type === 'partial'))
    return { label: 'Parcial', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  return { label: 'Aprovado', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
};

export default function ClienteHistorico() {
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany, user } = useAuth();
  const companyId = currentCompany?.id;

  const { data: client } = useQuery({
    queryKey: ['client-profile', clientId, companyId],
    queryFn: async () => {
      if (!clientId || !companyId) return null;
      const { data, error } = await supabase
        .from('clients')
        .select('id,name,document,document_type,email,phone,address,city,state,created_at')
        .eq('id', clientId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && !!companyId,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['client-quotes', clientId, companyId],
    queryFn: async () => {
      if (!clientId || !companyId) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('id,quote_number,status,final_amount,total_amount,created_at')
        .eq('client_id', clientId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && !!companyId,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['client-sales', clientId, companyId],
    queryFn: async () => {
      if (!clientId || !companyId) return [];
      const { data, error } = await supabase
        .from('sales')
        .select('id,sale_number,total_amount,paid_amount,pending_amount,payment_status,sale_type,quote_id,created_at')
        .eq('client_id', clientId)
        .eq('company_id', companyId)
        .neq('payment_status', 'cancelled')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && !!companyId,
  });

  const { data: osData = [] } = useQuery({
    queryKey: ['client-os', clientId, companyId],
    queryFn: async () => {
      if (!clientId || !companyId) return [];
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('id,os_number,status,total_amount,created_at')
        .eq('client_id', clientId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && !!companyId,
  });

  const saleIds = useMemo(() => sales.map(s => s.id), [sales]);
  const quoteIds = useMemo(() => quotes.map(q => q.id), [quotes]);

  const { data: payments = [] } = useQuery({
    queryKey: ['client-payments', clientId, companyId],
    queryFn: async () => {
      if (!clientId || !companyId) return [];
      
      const { data, error } = await supabase
        .from('cash_movements')
        .select('id,amount,payment_method,description,created_at,sale_id,quote_id,category,type')
        .eq('company_id', companyId)
        .or(`cliente_id.eq.${clientId},fornecedor_id.eq.${clientId}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && !!clientId,
  });

  const kpis = useMemo(() => {
    const activeQuotes = quotes.filter(q => q.status !== 'cancelled' && q.status !== 'rejected');
    const totalOrcado = activeQuotes.reduce((s, q) => s + (Number(q.final_amount) || 0), 0);
    const totalPago = payments
      .filter(p => p.type === 'entrada')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const saldoDevedor = sales.reduce((s, sl) => s + Math.max(0, Number(sl.pending_amount) || 0), 0);
    const adimplente = saldoDevedor <= 0.009;
    return { totalOrcado, totalPago, saldoDevedor, adimplente };
  }, [quotes, sales, payments]);

  const quoteNumberBySaleId = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(s => {
      if (!s.quote_id) return;
      const q = quotes.find(qq => qq.id === s.quote_id);
      if (q) map.set(s.id, q.quote_number);
    });
    return map;
  }, [sales, quotes]);

  const quoteNumberById = useMemo(() => {
    const map = new Map<string, number>();
    quotes.forEach(q => map.set(q.id, q.quote_number));
    return map;
  }, [quotes]);

  // Chart data — daily totals + cumulative received amount over time
  const chartData = useMemo(() => {
    if (!payments.length) return [];
    const byDay = new Map<string, number>();
    const sorted = [...payments]
      .filter(p => p.type === 'entrada')
      .sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    sorted.forEach(p => {
      const key = format(startOfDay(new Date(p.created_at)), 'yyyy-MM-dd');
      byDay.set(key, (byDay.get(key) || 0) + (Number(p.amount) || 0));
    });
    let acc = 0;
    return Array.from(byDay.entries()).map(([date, total]) => {
      acc += total;
      return {
        date,
        label: format(parseISO(date), 'dd/MM/yy', { locale: ptBR }),
        diario: Math.round(total * 100) / 100,
        acumulado: Math.round(acc * 100) / 100,
      };
    });
  }, [payments]);

  const printableRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState<'whatsapp' | 'email' | null>(null);

  const handleExportPdf = async () => {
    if (!printableRef.current || !client) {
      toast.error('Aguarde os dados carregarem');
      return;
    }
    try {
      setExporting(true);
      const safeName = client.name.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
      const stamp = format(new Date(), 'yyyy-MM-dd');
      await downloadElementAsPdf(printableRef.current, `ficha_${safeName}_${stamp}.pdf`);
      toast.success('PDF exportado com sucesso');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao gerar PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleSharePdf = async (channel: 'whatsapp' | 'email') => {
    if (!printableRef.current || !client || !user?.id) {
      toast.error('Aguarde os dados carregarem');
      return;
    }
    try {
      setSharing(channel);
      const safeName = client.name.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
      const stamp = format(new Date(), 'yyyy-MM-dd');
      const fileName = `ficha_${safeName}_${stamp}.pdf`;

      const { publicUrl } = await uploadPdfForSharing({
        element: printableRef.current,
        fileName,
        userId: user.id,
        companyId: currentCompany?.id,
        clientId: client.id,
      });

      const shareOptions = {
        url: publicUrl,
        recipientName: client.name,
        documentLabel: 'ficha completa em PDF',
      };

      if (channel === 'whatsapp') {
        const ok = shareViaWhatsApp(client.phone, shareOptions);
        if (!ok) toast.error('Telefone do cliente não disponível para WhatsApp');
      } else {
        const ok = shareViaEmail(client.email, `Ficha do Cliente - ${client.name}`, shareOptions);
        if (!ok) toast.error('E-mail do cliente não disponível');
      }
    } catch (err) {
      console.error(err);
      toast.error('Falha ao preparar PDF para compartilhamento');
    } finally {
      setSharing(null);
    }
  };

  const generateExtratoPdf = async (
    sale: {
      id: string;
      sale_number?: number | null;
      total_amount: number;
      paid_amount: number;
      pending_amount: number;
      payment_status?: string | null;
      sale_type?: string | null;
      quote_id?: string | null;
      created_at: string;
    },
    linkedQuote?: { quote_number?: number | null; final_amount?: number | null; created_at?: string | null } | null,
  ): Promise<Blob> => {
    const salePayments = payments.filter(
      p => p.sale_id === sale.id || (sale.quote_id && p.quote_id === sale.quote_id),
    );

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      <ExtratoRecebimentos
        clientName={client?.name || 'Cliente'}
        company={currentCompany}
        clientDocument={client?.document_type && client?.document ? `${client.document_type}: ${client.document}` : client?.document}
        clientPhone={client?.phone}
        clientEmail={client?.email}
        saleNumber={sale.sale_number}
        quoteNumber={linkedQuote?.quote_number ?? quoteNumberById.get(sale.quote_id || '')}
        totalAmount={Number(linkedQuote?.final_amount ?? sale.total_amount)}
        paidAmount={Number(sale.paid_amount)}
        pendingAmount={Number(sale.pending_amount)}
        saleStatus={sale.payment_status}
        saleType={sale.sale_type}
        createdAt={sale.created_at}
        payments={salePayments.map(p => ({
          id: p.id,
          amount: Number(p.amount) || 0,
          payment_method: p.payment_method,
          description: p.description,
          created_at: p.created_at,
        }))}
      />,
    );

    // Allow React to paint before rasterizing.
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const blob = await elementToPdfBlob(container);
      return blob;
    } finally {
      root.unmount();
      container.remove();
    }
  };

  const handleDownloadExtrato = async (
    sale: {
      id: string;
      sale_number?: number | null;
      total_amount: number;
      paid_amount: number;
      pending_amount: number;
      payment_status?: string | null;
      sale_type?: string | null;
      quote_id?: string | null;
      created_at: string;
    },
    linkedQuote?: { quote_number?: number | null; final_amount?: number | null; created_at?: string | null } | null,
  ) => {
    try {
      setExporting(true);
      const blob = await generateExtratoPdf(sale, linkedQuote);
      const safeName = (client?.name || 'cliente').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
      const ref = sale.sale_number
        ? `venda_${String(sale.sale_number).padStart(4, '0')}`
        : `orc_${String(linkedQuote?.quote_number ?? quoteNumberById.get(sale.quote_id || '') ?? 0).padStart(4, '0')}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extrato_${safeName}_${ref}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Extrato de recebimentos baixado');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao gerar extrato');
    } finally {
      setExporting(false);
    }
  };

  return (
    <MainLayout>
      <div className="pb-20 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/clientes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Ficha do Cliente
            </p>
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              {client?.name || 'Carregando...'}
            </h1>
          </div>
          {client?.phone && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => openWhatsapp(client.phone, `Olá ${client.name}, tudo bem?`)}
            >
              <MessageCircle className="h-4 w-4 text-green-600" />
              <span className="hidden sm:inline">WhatsApp</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="gap-2"
                disabled={exporting || sharing !== null || !client}
              >
                {sharing || exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {sharing ? 'Enviando...' : exporting ? 'Gerando...' : 'Compartilhar'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={handleExportPdf}
              >
                <Download className="h-4 w-4" /> Baixar PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => handleSharePdf('whatsapp')}
                disabled={sharing === 'whatsapp'}
              >
                <MessageCircle className="h-4 w-4 text-green-600" /> Enviar por WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => handleSharePdf('email')}
                disabled={sharing === 'email'}
              >
                <Mail className="h-4 w-4 text-primary" /> Enviar por E-mail
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div ref={printableRef} className="space-y-4 bg-background">
        {/* Client Contact Card */}
        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Documento</p>
                <p className="font-medium truncate">
                  {client?.document_type ? `${client.document_type} · ` : ''}
                  {client?.document || '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Telefone</p>
                <p className="font-medium truncate">{client?.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">E-mail</p>
                <p className="font-medium truncate">{client?.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Endereço</p>
                <p className="font-medium truncate">
                  {[client?.address, client?.city, client?.state].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Total em Orçamentos</p>
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xl font-bold">{formatCurrency(kpis.totalOrcado)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {quotes.length} {quotes.length === 1 ? 'orçamento' : 'orçamentos'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Pago</p>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(kpis.totalPago)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {payments.length} {payments.length === 1 ? 'recebimento' : 'recebimentos'}
              </p>
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${kpis.saldoDevedor > 0 ? 'border-l-amber-500' : 'border-l-slate-300'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Saldo Devedor</p>
                <Wallet className={`h-4 w-4 ${kpis.saldoDevedor > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
              </div>
              <p className={`text-xl font-bold ${kpis.saldoDevedor > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                {formatCurrency(kpis.saldoDevedor)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {sales.filter(s => (Number(s.pending_amount) || 0) > 0).length} venda(s) em aberto
              </p>
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${kpis.adimplente ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Status Geral</p>
                {kpis.adimplente ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                )}
              </div>
              <p className={`text-xl font-bold ${kpis.adimplente ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {kpis.adimplente ? 'Adimplente' : 'Em Débito'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {kpis.adimplente ? 'Sem pendências' : 'Possui saldo em aberto'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recebimentos ao longo do tempo */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Recebimentos ao longo do tempo</CardTitle>
            </div>
            {chartData.length > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {chartData.length} {chartData.length === 1 ? 'dia' : 'dias'} com movimento
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-2">
            {chartData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                Sem recebimentos registrados para exibir o gráfico.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDiario" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) =>
                        v >= 1000
                          ? `R$ ${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
                          : `R$ ${v}`
                      }
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        formatCurrency(v),
                        name === 'diario' ? 'Recebido no dia' : 'Acumulado',
                      ]}
                      labelFormatter={(l) => `Dia ${l}`}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(v) => (v === 'diario' ? 'Recebido no dia' : 'Acumulado')}
                    />
                    <Area
                      type="monotone"
                      dataKey="acumulado"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#colorAcumulado)"
                    />
                    <Area
                      type="monotone"
                      dataKey="diario"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#colorDiario)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="orcamentos" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="orcamentos" className="gap-2">
              <FileText className="h-4 w-4" />
              Orçamentos ({quotes.length})
            </TabsTrigger>
            <TabsTrigger value="os" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              OS ({osData.length})
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="gap-2">
              <Receipt className="h-4 w-4" />
              Financeiro ({payments.length})
            </TabsTrigger>
          </TabsList>

          {/* Orçamentos */}
          <TabsContent value="orcamentos" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Orçamentos do Cliente</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {quotes.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum orçamento criado para este cliente ainda.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Nº</TableHead>
                        <TableHead className="w-32">Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotes.map(q => {
                        const sale = sales.find(s => s.quote_id === q.id);
                        const badge = quoteStatusBadge({
                          status: q.status,
                          sale_type: sale?.sale_type ?? null,
                          pending_amount: sale?.pending_amount ?? null,
                        });
                        const saldo = sale ? Math.max(0, Number(sale.pending_amount) || 0) : 0;
                        return (
                          <TableRow key={q.id}>
                            <TableCell className="font-mono text-xs">
                              #{String(q.quote_number).padStart(4, '0')}
                            </TableCell>
                            <TableCell className="text-xs">
                              {format(new Date(q.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={badge.className}>
                                {badge.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(Number(q.final_amount) || 0)}
                            </TableCell>
                            <TableCell className={`text-right text-xs ${saldo > 0 ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-muted-foreground'}`}>
                              {formatCurrency(saldo)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                {sale && Number(sale.pending_amount) > 0.01 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-primary"
                                    title="Extrato de Recebimentos"
                                    onClick={() => handleDownloadExtrato(sale, q)}
                                    disabled={exporting}
                                  >
                                    <FileDown className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                  <Link to={`/orcamentos?ver=${q.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ordens de Serviço */}
          <TabsContent value="os" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ordens de Serviço</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {osData.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhuma ordem de serviço registrada.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Nº</TableHead>
                        <TableHead className="w-32">Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {osData.map(os => (
                        <TableRow key={os.id}>
                          <TableCell className="font-mono text-xs">
                            #{String(os.os_number).padStart(4, '0')}
                          </TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(os.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getOSStatusBadgeClass(os.status)}>
                              {getOSStatusLabel(os.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(os.total_amount) || 0)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                <Link to={`/ordens-servico?ver=${os.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pagamentos */}
          <TabsContent value="pagamentos" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Histórico de Pagamentos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {payments.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum pagamento registrado.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-40">Data / Hora</TableHead>
                        <TableHead>Vínculo</TableHead>
                        <TableHead className="w-32">Forma</TableHead>
                        <TableHead className="text-right w-32">Valor</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map(p => {
                        const mc = methodConfig[p.payment_method ?? ''] || { label: p.payment_method || '—', className: 'bg-muted text-muted-foreground' };
                        const linkedQuoteNumber = p.quote_id
                          ? quoteNumberById.get(p.quote_id)
                          : p.sale_id
                            ? quoteNumberBySaleId.get(p.sale_id)
                            : null;
                        const linkedQuote = p.quote_id
                          ? quotes.find(q => q.id === p.quote_id)
                          : p.sale_id
                            ? quotes.find(q => q.id === sales.find(s => s.id === p.sale_id)?.quote_id)
                            : null;
                        const linkedSale = p.sale_id
                          ? sales.find(s => s.id === p.sale_id)
                          : null;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs">
                              {format(new Date(p.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-xs">
                              {linkedQuoteNumber
                                ? <span className="font-mono">Orç. #{String(linkedQuoteNumber).padStart(4, '0')}</span>
                                : p.description || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={mc.className}>{mc.label}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                              + {formatCurrency(Number(p.amount) || 0)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                {(linkedSale && Number(linkedSale.pending_amount) > 0.01) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-primary"
                                    title="Extrato de Recebimentos"
                                    onClick={() => handleDownloadExtrato(linkedSale, linkedQuote)}
                                    disabled={exporting}
                                  >
                                    <FileDown className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}

function getOSStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    in_progress: 'Em Andamento',
    completed: 'Concluída',
    delivered: 'Entregue',
    cancelled: 'Cancelada'
  };
  return labels[status] || status;
}

function getOSStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    delivered: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    cancelled: 'bg-slate-100 text-slate-800 border-slate-200'
  };
  return classes[status] || 'bg-slate-100 text-slate-800 border-slate-200';
}
