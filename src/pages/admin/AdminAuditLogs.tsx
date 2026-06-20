import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Search, 
  Filter, 
  Eye, 
  RefreshCw, 
  FileText, 
  Activity,
  Calendar,
  User,
  Database,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JsonView } from "@/components/admin/JsonView";

interface AuditLog {
  id: string;
  table_name: string;
  action: string;
  record_id: string | null;
  user_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  company_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// DB stores actions lowercase (create/update/delete). Keep aliases for legacy rows.
const actionLabels: Record<string, { label: string; color: string }> = {
  create: { label: "Criação", color: "bg-green-500" },
  insert: { label: "Criação", color: "bg-green-500" },
  update: { label: "Atualização", color: "bg-blue-500" },
  delete: { label: "Exclusão", color: "bg-red-500" },
  login: { label: "Login", color: "bg-purple-500" },
  logout: { label: "Logout", color: "bg-gray-500" },
  cancel_sale: { label: "Cancelamento de Venda", color: "bg-orange-500" },
};

const getActionInfo = (action: string) =>
  actionLabels[action?.toLowerCase()] || { label: action, color: "bg-gray-500" };

const countAction = (logs: AuditLog[] | undefined, ...keys: string[]) =>
  logs?.filter((l) => keys.includes(l.action?.toLowerCase())).length || 0;

// Build a friendly "Target / Reference" string from the log payload.
function buildTargetRef(log: AuditLog): string {
  const data =
    (log.new_data as Record<string, unknown>) ||
    (log.old_data as Record<string, unknown>) ||
    (log.metadata as Record<string, unknown>) ||
    {};
  const get = (k: string) => (data[k] != null ? String(data[k]) : "");
  const table = log.table_name;

  if (table === "quotes") {
    const num = get("quote_number") || get("numero");
    const name = get("customer_name") || get("client_name");
    if (name || num) return [name, num && `Nº ${num}`].filter(Boolean).join(" — ");
  }
  if (table === "sales" || table === "ordens_servico") {
    const num = get("sale_number") || get("os_number") || get("numero");
    const name = get("customer_name") || get("client_name");
    const short = log.record_id?.slice(0, 8);
    return [name, num ? `Nº ${num}` : short].filter(Boolean).join(" — ");
  }
  if (table === "clients") return get("name") || get("razao_social") || "-";
  if (table === "companies") return get("name") || "-";
  if (table === "expenses") return get("description") || get("category") || "-";

  return get("name") || get("title") || log.record_id?.slice(0, 8) || "-";
}

const tableLabels: Record<string, string> = {
  companies: "Empresas",
  profiles: "Perfis",
  employees: "Funcionários",
  clients: "Clientes",
  quotes: "Orçamentos",
  ordens_servico: "Ordens de Serviço",
  sales: "Vendas",
  expenses: "Despesas",
  product_templates: "Templates de Produtos",
  item_templates: "Templates de Itens",
  support_tickets: "Tickets de Suporte",
  cash_registers: "Caixa",
};

export default function AdminAuditLogs() {
  const { isSaasAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTable, setFilterTable] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: logs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["audit-logs", filterTable, filterAction],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (filterTable !== "all") {
        query = query.eq("table_name", filterTable);
      }

      if (filterAction !== "all") {
        query = query.eq("action", filterAction);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: isSaasAdmin,
  });

  // Resolve user_ids → profile name/email
  const userIds = useMemo(
    () => [...new Set((logs || []).map((l) => l.user_id).filter(Boolean) as string[])],
    [logs],
  );
  const { data: usersMap } = useQuery({
    queryKey: ["audit-logs-users", userIds],
    enabled: isSaasAdmin && userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      if (error) throw error;
      const map: Record<string, { name: string }> = {};
      for (const p of data || []) {
        map[p.user_id] = { name: p.full_name || p.user_id.slice(0, 8) };
      }
      return map;
    },
  });

  // Resolve company_ids → company name
  const companyIds = useMemo(
    () => [...new Set((logs || []).map((l) => l.company_id).filter(Boolean) as string[])],
    [logs],
  );
  const { data: companiesMap } = useQuery({
    queryKey: ["audit-logs-companies", companyIds],
    enabled: isSaasAdmin && companyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const c of data || []) {
        map[c.id] = c.name || c.id.slice(0, 8);
      }
      return map;
    },
  });

  // Get unique tables from logs
  const uniqueTables = [...new Set(logs?.map((l) => l.table_name) || [])].sort();

  // Filter logs by search term
  const filteredLogs = logs?.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const userName = log.user_id ? usersMap?.[log.user_id]?.name?.toLowerCase() : "";
    const companyName = log.company_id ? companiesMap?.[log.company_id]?.toLowerCase() : "";
    return (
      log.table_name.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.record_id?.toLowerCase().includes(term) ||
      log.user_id?.toLowerCase().includes(term) ||
      userName?.includes(term) ||
      companyName?.includes(term) ||
      buildTargetRef(log).toLowerCase().includes(term)
    );
  });

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  if (!isSaasAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6" />
              Logs de Auditoria
            </h1>
            <p className="text-sm text-muted-foreground">
              Histórico de ações e alterações no sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Atualizar</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por tabela, ação, ID..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterTable} onValueChange={setFilterTable}>
                <SelectTrigger className="w-[200px]">
                  <Database className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tabela" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as tabelas</SelectItem>
                  {uniqueTables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {tableLabels[table] || table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="create">Criação</SelectItem>
                  <SelectItem value="update">Atualização</SelectItem>
                  <SelectItem value="delete">Exclusão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-foreground">
                {logs?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Total de logs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">
                {countAction(logs, "create", "insert")}
              </div>
              <p className="text-xs text-muted-foreground">Criações</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-500">
                {countAction(logs, "update")}
              </div>
              <p className="text-xs text-muted-foreground">Atualizações</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-500">
                {countAction(logs, "delete")}
              </div>
              <p className="text-xs text-muted-foreground">Exclusões</p>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Registros
            </CardTitle>
            <CardDescription>
              Últimos {filteredLogs?.length || 0} registros encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum log encontrado
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Data/Hora</TableHead>
                      <TableHead>Tabela</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Alvo / Referência</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs?.slice(0, 100).map((log) => {
                      const actionInfo = getActionInfo(log.action);
                      const userName = log.user_id
                        ? usersMap?.[log.user_id]?.name || `${log.user_id.slice(0, 8)}…`
                        : "Sistema";
                      const companyName = log.company_id
                        ? companiesMap?.[log.company_id] || `${log.company_id.slice(0, 8)}…`
                        : "-";
                      const targetRef = buildTargetRef(log);
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(log.created_at), "dd/MM/yy HH:mm", {
                                locale: ptBR,
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {tableLabels[log.table_name] || log.table_name}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${actionInfo.color} text-white text-xs`}
                            >
                              {actionInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[220px] truncate" title={targetRef}>
                            {targetRef}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="max-w-[140px] truncate" title={userName}>
                                {userName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs max-w-[160px] truncate" title={companyName}>
                            {companyName}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(log)}
                            >
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

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]" aria-describedby="audit-log-details-description">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Detalhes do Log
              </DialogTitle>
              <p id="audit-log-details-description" className="text-sm text-muted-foreground">
                Informações detalhadas sobre a ação registrada.
              </p>
            </DialogHeader>
            {selectedLog && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Data/Hora</p>
                      <p className="font-mono">
                        {format(
                          new Date(selectedLog.created_at),
                          "dd/MM/yyyy HH:mm:ss",
                          { locale: ptBR }
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tabela</p>
                      <p className="font-medium">
                        {tableLabels[selectedLog.table_name] ||
                          selectedLog.table_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ação</p>
                      <Badge
                        className={`${
                          actionLabels[selectedLog.action]?.color || "bg-gray-500"
                        } text-white`}
                      >
                        {actionLabels[selectedLog.action]?.label ||
                          selectedLog.action}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        ID do Registro
                      </p>
                      <p className="font-mono text-sm">
                        {selectedLog.record_id || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        ID do Usuário
                      </p>
                      <p className="font-mono text-sm">
                        {selectedLog.user_id || "Sistema"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Empresa</p>
                      <p className="font-mono text-sm">
                        {selectedLog.company_id || "-"}
                      </p>
                    </div>
                  </div>

                  {/* Old Data */}
                  {selectedLog.old_data && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Dados Anteriores
                      </p>
                      <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.old_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* New Data */}
                  {selectedLog.new_data && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Dados Novos
                      </p>
                      <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.new_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Metadata */}
                  {selectedLog.metadata && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        {selectedLog.action === 'CANCEL_SALE' ? 'Detalhes do Cancelamento' : 'Metadados'}
                      </p>
                      <div className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                        {selectedLog.action === 'CANCEL_SALE' ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="font-bold">Motivo:</span> {String((selectedLog.metadata as any).reason || 'Não informado')}
                              </div>
                              <div>
                                <span className="font-bold">Venda:</span> #{(selectedLog.metadata as any).sale_number}
                              </div>
                              <div>
                                <span className="font-bold">Cliente:</span> {String((selectedLog.metadata as any).customer_name || 'N/A')}
                              </div>
                              <div>
                                <span className="font-bold">Valor Total:</span> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number((selectedLog.metadata as any).total_amount || 0))}
                              </div>
                            </div>
                            
                            {(selectedLog.metadata as any).removed_cash_movements && ((selectedLog.metadata as any).removed_cash_movements as any[]).length > 0 && (
                              <div className="space-y-1">
                                <p className="font-bold text-red-500">Movimentações de Caixa Removidas:</p>
                                <ul className="list-disc pl-4">
                                  {((selectedLog.metadata as any).removed_cash_movements as any[]).map((m: any, i: number) => (
                                    <li key={i}>
                                      ID: {m.id} | Tipo: {m.type} | Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.amount)} | Data: {m.created_at}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {(selectedLog.metadata as any).cancelled_accounts_receivable && ((selectedLog.metadata as any).cancelled_accounts_receivable as any[]).length > 0 && (
                              <div className="space-y-1">
                                <p className="font-bold text-orange-500">Contas a Receber Canceladas:</p>
                                <ul className="list-disc pl-4">
                                  {((selectedLog.metadata as any).cancelled_accounts_receivable as any[]).map((r: any, i: number) => (
                                    <li key={i}>
                                      ID: {r.id} | Parcela: {r.installment_number}/{r.total_installments} | Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.total_amount)} | Vencimento: {r.due_date}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {(selectedLog.metadata as any).stock_restorations && ((selectedLog.metadata as any).stock_restorations as any[]).length > 0 && (
                              <div className="space-y-1">
                                <p className="font-bold text-green-600">Estoque Restaurado:</p>
                                <ul className="list-disc pl-4">
                                  {((selectedLog.metadata as any).stock_restorations as any[]).map((s: any, i: number) => (
                                    <li key={i}>
                                      Item ID: {s.item_id} | Quantidade: {s.quantity}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                        )}
                      </div>
                    </div>
                  )}

                  {/* IP/User Agent */}
                  {(selectedLog.ip_address || selectedLog.user_agent) && (
                    <div className="grid grid-cols-2 gap-4">
                      {selectedLog.ip_address && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Endereço IP
                          </p>
                          <p className="font-mono text-sm">
                            {selectedLog.ip_address}
                          </p>
                        </div>
                      )}
                      {selectedLog.user_agent && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            User Agent
                          </p>
                          <p className="font-mono text-xs truncate">
                            {selectedLog.user_agent}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
