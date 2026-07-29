import { useMemo, useRef, useState } from 'react';
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
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { format, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, User, Phone, Mail, MapPin, FileText,
  AlertTriangle, Receipt, TrendingUp, Wallet, ShieldCheck,
  MessageCircle, Eye, Download, Loader2, LineChart,
} from 'lucide-react';
import { openWhatsapp } from '@/utils/whatsapp';
import { downloadElementAsPdf } from '@/utils/printableToPdf';
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
  const { currentCompany } = useAuth();
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

  const saleIds = useMemo(() => sales.map(s => s.id), [sales]);
  const quoteIds = useMemo(() => quotes.map(q => q.id), [quotes]);

  const { data: payments = [] } = useQuery({
    queryKey: ['client-payments', clientId, saleIds, quoteIds],
    queryFn: async () => {
      if ((!saleIds.length && !quoteIds.length) || !companyId) return [];
      const filters: string[] = [];
      if (saleIds.length)  filters.push(`sale_id.in.(${saleIds.join(',')})`);
      if (quoteIds.length) filters.push(`quote_id.in.(${quoteIds.join(',')})`);

      const { data, error } = await supabase
        .from('cash_movements')
        .select('id,amount,payment_method,description,created_at,sale_id,quote_id,category')
        .eq('company_id', companyId)
        .eq('type', 'entrada')
        .or(filters.join(','))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && (saleIds.length > 0 || quoteIds.length > 0),
  });

  const kpis = useMemo(() => {
    const activeQuotes = quotes.filter(q => q.status !== 'cancelled' && q.status !== 'rejected');
    const totalOrcado = activeQuotes.reduce((s, q) => s + (Number(q.final_amount) || 0), 0);
    const totalPago = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
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
              WhatsApp
            </Button>
          )}
        </div>

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

        {/* Tabs */}
        <Tabs defaultValue="orcamentos" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="orcamentos" className="gap-2">
              <FileText className="h-4 w-4" />
              Orçamentos ({quotes.length})
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="gap-2">
              <Receipt className="h-4 w-4" />
              Pagamentos ({payments.length})
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
                              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                <Link to={`/orcamentos?ver=${q.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map(p => {
                        const mc = methodConfig[p.payment_method ?? ''] || { label: p.payment_method || '—', className: 'bg-muted text-muted-foreground' };
                        const linkedQuote = p.quote_id
                          ? quoteNumberById.get(p.quote_id)
                          : p.sale_id
                            ? quoteNumberBySaleId.get(p.sale_id)
                            : null;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs">
                              {format(new Date(p.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-xs">
                              {linkedQuote
                                ? <span className="font-mono">Orç. #{String(linkedQuote).padStart(4, '0')}</span>
                                : p.description || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={mc.className}>{mc.label}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                              + {formatCurrency(Number(p.amount) || 0)}
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
    </MainLayout>
  );
}
