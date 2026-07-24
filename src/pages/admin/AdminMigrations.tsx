import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Database, Search, CheckCircle2, Clock, FileCode, Copy, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface MigrationRow {
  version: string;
  name: string | null;
  applied_at: string | null;
  statements_count: number;
  preview: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminMigrations() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MigrationRow | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "schema-migrations"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_schema_migrations");
      if (error) throw error;
      return (data ?? []) as MigrationRow[];
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (m) =>
        m.version.toLowerCase().includes(q) ||
        (m.name ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const stats = useMemo(() => {
    const total = data?.length ?? 0;
    const last = data?.[0]?.applied_at ?? null;
    const totalStmts = data?.reduce((sum, m) => sum + (m.statements_count || 0), 0) ?? 0;
    return { total, last, totalStmts };
  }, [data]);

  const copyPreview = async (m: MigrationRow) => {
    if (!m.preview) return;
    await navigator.clipboard.writeText(m.preview);
    toast({ title: "SQL copiado", description: `Migração ${m.version}` });
  };

  const downloadSql = (m: MigrationRow) => {
    if (!m.preview) return;
    const safeName = (m.name ?? "migration").replace(/[^a-z0-9_-]+/gi, "_");
    const filename = `${m.version}_${safeName}.sql`;
    const header = `-- Migração: ${m.name ?? ""}\n-- Versão: ${m.version}\n-- Aplicada em: ${m.applied_at ?? "—"}\n-- Comandos: ${m.statements_count}\n\n`;
    const blob = new Blob([header + m.preview], { type: "text/sql;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Download iniciado", description: filename });
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Migrações do Sistema</h1>
          <p className="text-muted-foreground">
            Histórico e status de todas as migrações aplicadas ao banco de dados.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-4 w-4 text-primary" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-6 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                )}
                <p className="text-xs text-muted-foreground">Migrações aplicadas</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <FileCode className="h-4 w-4 text-green-500" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-6 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">{stats.totalStmts}</div>
                )}
                <p className="text-xs text-muted-foreground">Comandos SQL executados</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-6 w-32" />
                ) : (
                  <div className="text-sm font-semibold text-foreground">
                    {formatDate(stats.last)}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Última migração</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por versão ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-sm text-destructive">
                Erro ao carregar migrações: {(error as Error).message}
              </p>
            ) : isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma migração encontrada.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((m) => (
                  <button
                    key={m.version}
                    onClick={() => setSelected(m)}
                    className="w-full text-left flex items-center gap-4 py-3 hover:bg-muted/50 rounded-md px-2 transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">
                          {m.version}
                        </span>
                        {m.name && (
                          <span className="text-sm font-medium text-foreground truncate">
                            {m.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(m.applied_at)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {m.statements_count} {m.statements_count === 1 ? "comando" : "comandos"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              {selected?.name || "Migração"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Versão</p>
                  <p className="font-mono">{selected.version}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aplicada em</p>
                  <p>{formatDate(selected.applied_at)}</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">
                    SQL ({selected.statements_count} comando{selected.statements_count === 1 ? "" : "s"})
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyPreview(selected)} disabled={!selected.preview}>
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar
                    </Button>
                    <Button size="sm" onClick={() => downloadSql(selected)} disabled={!selected.preview}>
                      <Download className="w-3 h-3 mr-1" />
                      Baixar .sql
                    </Button>
                  </div>
                </div>
                <pre className="bg-muted border border-border p-4 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                  {selected.preview || "(vazio)"}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
