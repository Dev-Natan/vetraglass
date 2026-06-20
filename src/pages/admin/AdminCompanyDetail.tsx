import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, CreditCard, Activity, FileText, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Clock, Calendar, User, Eye,
  MapPin, Mail, Phone, Crown, Undo2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JsonView } from "@/components/admin/JsonView";
import { buildNarrative, diffFields } from "@/utils/auditLogNarrative";

interface CompanyRow {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  street: string | null;
  neighborhood: string | null;
  logo_url: string | null;
  created_at: string;
}

interface Subscription {
  id: string;
  company_id: string;
  plan_name: string;
  plan_price: number;
  status: string;
  started_at: string;
  expires_at: string | null;
  renewed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
}

interface AuditLog {
  id: string;
  table_name: string;
  action: string;
  record_id: string | null;
  user_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface QuoteRow {
  id: string;
  quote_number: number | null;
  customer_name: string | null;
  status: string | null;
  final_amount: number | null;
  total_amount: number | null;
  created_at: string;
}

const actionLabels: Record<string, { label: string; color: string }> = {
  create: { label: "Criação", color: "bg-green-500" },
  insert: { label: "Criação", color: "bg-green-500" },
  update: { label: "Atualização", color: "bg-blue-500" },
  delete: { label: "Exclusão", color: "bg-red-500" },
  login: { label: "Login", color: "bg-purple-500" },
  logout: { label: "Logout", color: "bg-gray-500" },
  cancel_sale: { label: "Cancelamento de Venda", color: "bg-orange-500" },
};

const tableLabels: Record<string, string> = {
  companies: "Empresas", profiles: "Perfis", employees: "Funcionários",
  clients: "Clientes", quotes: "Orçamentos", ordens_servico: "OS",
  sales: "Vendas", expenses: "Despesas", product_templates: "Templates",
  item_templates: "Itens", support_tickets: "Suporte", cash_registers: "Caixa",
};

const planLabel = (p: string) =>
  ({ basico: "Básico", fiscal: "Fiscal", trial: "Trial" } as Record<string, string>)[p] || p;

const quoteStatusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
  convertido: { label: "Convertido", variant: "default" },
};

export default function AdminCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSaasAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [onlyDeletes, setOnlyDeletes] = useState(false);
  const [revertTarget, setRevertTarget] = useState<AuditLog | null>(null);
  const [subForm, setSubForm] = useState({
    plan_name: "basico",
    plan_price: 98.99,
    status: "active",
    expires_at: "",
    notes: "",
  });

  const { data: company, isLoading: loadingCompany } = useQuery({
    queryKey: ["admin-company", id],
    enabled: isSaasAdmin && !!id,
    queryFn: async (): Promise<CompanyRow | null> => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, cnpj, email, phone, address, city, state, zip_code, street, neighborhood, logo_url, created_at")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as CompanyRow | null;
    },
  });

  const { data: subscription } = useQuery({
    queryKey: ["admin-company-sub", id],
    enabled: isSaasAdmin && !!id,
    queryFn: async (): Promise<Subscription | null> => {
      const { data, error } = await supabase
        .from("company_subscriptions")
        .select("*")
        .eq("company_id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Subscription | null;
    },
  });

  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["admin-company-logs", id],
    enabled: isSaasAdmin && !!id,
    queryFn: async (): Promise<AuditLog[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, table_name, action, record_id, user_id, old_data, new_data, metadata, created_at")
        .eq("company_id", id!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as AuditLog[];
    },
  });

  const { data: quotes = [], isLoading: loadingQuotes } = useQuery({
    queryKey: ["admin-company-quotes", id],
    enabled: isSaasAdmin && !!id,
    queryFn: async (): Promise<QuoteRow[]> => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, quote_number, customer_name, status, final_amount, total_amount, created_at")
        .eq("company_id", id!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as QuoteRow[];
    },
  });

  const userIds = useMemo(
    () => [...new Set(logs.map((l) => l.user_id).filter(Boolean) as string[])],
    [logs],
  );
  const { data: usersMap } = useQuery({
    queryKey: ["admin-company-log-users", userIds],
    enabled: isSaasAdmin && userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data || []) map[p.user_id] = p.full_name || p.user_id.slice(0, 8);
      return map;
    },
  });

  const upsertSubscription = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: id!,
        plan_name: subForm.plan_name,
        plan_price: subForm.plan_price,
        status: subForm.status,
        expires_at: subForm.expires_at || null,
        notes: subForm.notes || null,
        updated_at: new Date().toISOString(),
      };
      if (subscription) {
        const { error } = await supabase.from("company_subscriptions").update(payload).eq("id", subscription.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_subscriptions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Assinatura atualizada");
      queryClient.invalidateQueries({ queryKey: ["admin-company-sub", id] });
      setSubDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar"),
  });

  const toggleStatus = useMutation({
    mutationFn: async (newStatus: "active" | "suspended") => {
      if (subscription) {
        const { error } = await supabase
          .from("company_subscriptions")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", subscription.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_subscriptions").insert({
          company_id: id!,
          plan_name: "basico",
          plan_price: 98.99,
          status: newStatus,
          expires_at: format(addMonths(new Date(), 1), "yyyy-MM-dd"),
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, status) => {
      toast.success(status === "active" ? "Empresa ativada" : "Empresa desativada");
      queryClient.invalidateQueries({ queryKey: ["admin-company-sub", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openSubDialog = () => {
    setSubForm({
      plan_name: subscription?.plan_name || "basico",
      plan_price: subscription?.plan_price ?? 98.99,
      status: subscription?.status || "active",
      expires_at: subscription?.expires_at
        ? subscription.expires_at.split("T")[0]
        : format(addMonths(new Date(), 1), "yyyy-MM-dd"),
      notes: subscription?.notes || "",
    });
    setSubDialogOpen(true);
  };

  if (!isSaasAdmin) {
    return (
      <AdminLayout>
        <div className="p-6 text-center text-muted-foreground">Acesso negado.</div>
      </AdminLayout>
    );
  }

  if (loadingCompany) {
    return (
      <AdminLayout>
        <div className="p-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!company) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Button variant="ghost" asChild>
            <Link to="/admin/companies"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link>
          </Button>
          <p className="mt-4 text-muted-foreground">Empresa não encontrada.</p>
        </div>
      </AdminLayout>
    );
  }

  const subStatus = subscription?.status;
  const isActive = subStatus === "active";
  const daysLeft = subscription?.expires_at
    ? differenceInDays(new Date(subscription.expires_at), new Date())
    : null;

  const formatDoc = (d: string | null) => {
    if (!d) return "-";
    const c = d.replace(/\D/g, "");
    if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return d;
  };
  const formatPhone = (p: string | null) => {
    if (!p) return "-";
    const c = p.replace(/\D/g, "");
    if (c.length === 11) return c.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (c.length === 10) return c.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return p;
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/companies")}>
              <ArrowLeft className="h-4 w-4 mr-2" />Empresas
            </Button>
            <div className="flex items-center gap-3">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-12 h-12 rounded-lg object-cover border" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <h1 className="font-bold text-2xl text-foreground uppercase">{company.name}</h1>
                <p className="text-sm text-muted-foreground">{formatDoc(company.cnpj)}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {subscription && (
              <Badge variant={isActive ? "default" : "outline"} className="gap-1">
                {isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {planLabel(subscription.plan_name)} — {subscription.status}
              </Badge>
            )}
          </div>
        </div>

        <Tabs defaultValue="geral" className="space-y-4">
          <TabsList>
            <TabsTrigger value="geral"><Building2 className="h-4 w-4 mr-2" />Geral</TabsTrigger>
            <TabsTrigger value="auditoria"><Activity className="h-4 w-4 mr-2" />Registros / Auditoria</TabsTrigger>
            <TabsTrigger value="orcamentos"><FileText className="h-4 w-4 mr-2" />Orçamentos</TabsTrigger>
          </TabsList>

          {/* ============== GERAL ============== */}
          <TabsContent value="geral" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dados da Vidraçaria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Email" icon={Mail} value={company.email} />
                    <Field label="Telefone" icon={Phone} value={formatPhone(company.phone)} />
                  </div>
                  <Field
                    label="Endereço"
                    icon={MapPin}
                    value={[
                      company.street,
                      company.neighborhood,
                      company.city,
                      company.state,
                      company.zip_code,
                    ].filter(Boolean).join(", ") || company.address || "-"}
                  />
                  <Field
                    label="Cadastrada em"
                    icon={Calendar}
                    value={format(new Date(company.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />Assinatura
                  </CardTitle>
                  {subscription && (
                    <Badge variant={isActive ? "default" : "outline"} className="gap-1">
                      {isActive ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {subscription.status}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {subscription ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Plano" icon={Crown} value={`${planLabel(subscription.plan_name)} — R$ ${Number(subscription.plan_price).toFixed(2)}`} />
                        <Field
                          label="Vencimento"
                          icon={Clock}
                          value={subscription.expires_at
                            ? `${format(new Date(subscription.expires_at), "dd/MM/yyyy", { locale: ptBR })}${daysLeft !== null ? ` (${daysLeft}d)` : ""}`
                            : "-"}
                        />
                      </div>
                      {subscription.notes && (
                        <div>
                          <p className="text-xs text-muted-foreground">Observações</p>
                          <p>{subscription.notes}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">Nenhuma assinatura configurada.</p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button size="sm" onClick={openSubDialog}>
                      <CreditCard className="h-4 w-4 mr-2" />Alterar plano
                    </Button>
                    {isActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleStatus.mutate("suspended")}
                        disabled={toggleStatus.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-2" />Desativar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleStatus.mutate("active")}
                        disabled={toggleStatus.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />Ativar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ============== AUDITORIA ============== */}
          <TabsContent value="auditoria">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" />Registros desta empresa
                </CardTitle>
                <CardDescription>
                  {loadingLogs ? "Carregando..." : `${logs.length} registro(s) — últimos 500`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLogs ? (
                  <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : logs.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">Nenhum registro.</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[150px]">Data/Hora</TableHead>
                          <TableHead>Tabela</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead className="text-right">Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.slice(0, 200).map((log) => {
                          const info = actionLabels[log.action?.toLowerCase()] || { label: log.action, color: "bg-gray-500" };
                          const userName = log.user_id ? usersMap?.[log.user_id] || `${log.user_id.slice(0, 8)}…` : "Sistema";
                          return (
                            <TableRow key={log.id}>
                              <TableCell className="font-mono text-xs">
                                {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {tableLabels[log.table_name] || log.table_name}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={`${info.color} text-white text-xs`}>{info.label}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="max-w-[160px] truncate" title={userName}>{userName}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============== ORÇAMENTOS ============== */}
          <TabsContent value="orcamentos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />Orçamentos
                </CardTitle>
                <CardDescription>
                  {loadingQuotes ? "Carregando..." : `${quotes.length} orçamento(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingQuotes ? (
                  <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : quotes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">Nenhum orçamento.</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nº</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quotes.map((q) => {
                          const s = quoteStatusLabel[q.status || ""] || { label: q.status || "-", variant: "outline" as const };
                          const value = q.final_amount ?? q.total_amount ?? 0;
                          return (
                            <TableRow key={q.id}>
                              <TableCell className="font-mono text-sm">#{q.quote_number ?? "—"}</TableCell>
                              <TableCell className="text-sm">{q.customer_name || "-"}</TableCell>
                              <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                              <TableCell className="text-right font-medium">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value))}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(q.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Log detail */}
      <Dialog open={!!selectedLog} onOpenChange={(o) => !o && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />Detalhes do Log
            </DialogTitle>
            <DialogDescription>Informações detalhadas sobre a ação registrada.</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Data/Hora" value={format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })} />
                  <Field label="Tabela" value={tableLabels[selectedLog.table_name] || selectedLog.table_name} />
                  <Field label="Ação" value={actionLabels[selectedLog.action?.toLowerCase()]?.label || selectedLog.action} />
                  <Field label="Registro" value={selectedLog.record_id || "-"} />
                  <Field label="Usuário" value={selectedLog.user_id ? usersMap?.[selectedLog.user_id] || selectedLog.user_id : "Sistema"} />
                </div>
                {selectedLog.old_data && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Dados Anteriores</p>
                    <JsonView data={selectedLog.old_data} />
                  </div>
                )}
                {selectedLog.new_data && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Dados Novos</p>
                    <JsonView data={selectedLog.new_data} />
                  </div>
                )}
                {selectedLog.metadata && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Metadados</p>
                    <JsonView data={selectedLog.metadata} />
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Subscription dialog */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Assinatura</DialogTitle>
            <DialogDescription>Configure manualmente o plano e o status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select
                  value={subForm.plan_name}
                  onValueChange={(v) => {
                    const prices: Record<string, number> = { basico: 98.99, fiscal: 245.0, trial: 0 };
                    setSubForm((f) => ({ ...f, plan_name: v, plan_price: prices[v] ?? f.plan_price }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial (Gratuito)</SelectItem>
                    <SelectItem value="basico">Básico — R$ 98,99</SelectItem>
                    <SelectItem value="fiscal">Fiscal — R$ 245,00</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number" step="0.01"
                  value={subForm.plan_price}
                  onChange={(e) => setSubForm((f) => ({ ...f, plan_price: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={subForm.status} onValueChange={(v) => setSubForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={subForm.expires_at}
                  onChange={(e) => setSubForm((f) => ({ ...f, expires_at: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                rows={3}
                value={subForm.notes}
                onChange={(e) => setSubForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsertSubscription.mutate()} disabled={upsertSubscription.isPending}>
              {upsertSubscription.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

interface FieldProps {
  label: string;
  value: string | null;
  icon?: React.ComponentType<{ className?: string }>;
}
function Field({ label, value, icon: Icon }: FieldProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}{label}
      </p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}
