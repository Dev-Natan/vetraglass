import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Database, Download, FileSpreadsheet, Users, ShoppingCart, FileText, Package, Wallet, Loader2, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/usePermissions";
import { Shield } from "lucide-react";
import { CompanyDataResetCard } from "@/components/configuracoes/CompanyDataResetCard";

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  table: string;
  columns: string[];
}

const exportOptions: ExportOption[] = [
  { 
    id: 'clients', 
    label: 'Clientes', 
    description: 'Cadastro completo de clientes',
    icon: Users,
    table: 'clients',
    columns: ['name', 'email', 'phone', 'document', 'document_type', 'address', 'city', 'state', 'zip_code', 'notes', 'created_at']
  },
  { 
    id: 'quotes', 
    label: 'Orçamentos', 
    description: 'Histórico de orçamentos',
    icon: FileText,
    table: 'quotes',
    columns: ['quote_number', 'customer_name', 'customer_email', 'customer_phone', 'total_amount', 'discount_percent', 'final_amount', 'status', 'created_at']
  },
  { 
    id: 'sales', 
    label: 'Vendas', 
    description: 'Histórico de vendas e pagamentos',
    icon: ShoppingCart,
    table: 'sales',
    columns: ['sale_number', 'customer_name', 'subtotal', 'discount_amount', 'total', 'paid_amount', 'pending_amount', 'payment_method', 'payment_status', 'created_at']
  },
  { 
    id: 'stock', 
    label: 'Estoque', 
    description: 'Inventário atual de produtos',
    icon: Package,
    table: 'company_stock',
    columns: ['item_template_id', 'quantity', 'min_quantity', 'location', 'is_active', 'created_at']
  },
  { 
    id: 'expenses', 
    label: 'Despesas', 
    description: 'Registro de despesas',
    icon: Wallet,
    table: 'expenses',
    columns: ['category', 'description', 'amount', 'due_date', 'paid_date', 'status', 'payment_method', 'notes', 'created_at']
  },
  { 
    id: 'employees', 
    label: 'Funcionários', 
    description: 'Cadastro de funcionários',
    icon: Users,
    table: 'employees',
    columns: ['name', 'email', 'phone', 'role', 'specialty', 'hourly_rate', 'commission_enabled', 'commission_percent', 'is_active', 'created_at']
  },
];

export default function ConfiguracoesDados() {
  const { currentCompany } = useAuth();
  const { isAdmin } = usePermissions();
  const [exporting, setExporting] = useState<string | null>(null);
  const [exported, setExported] = useState<string[]>([]);

  // Get counts for each table
  const { data: counts = {} } = useQuery({
    queryKey: ['export-counts', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return {};
      
      const results: Record<string, number> = {};
      
      for (const opt of exportOptions) {
        const { count } = await supabase
          .from(opt.table as any)
          .select('*', { count: 'exact', head: true })
          .eq('company_id', currentCompany.id);
        
        results[opt.id] = count || 0;
      }
      
      return results;
    },
    enabled: !!currentCompany?.id,
  });

  const handleExport = async (option: ExportOption) => {
    if (!currentCompany?.id) return;
    
    setExporting(option.id);
    
    try {
      const { data, error } = await supabase
        .from(option.table as any)
        .select(option.columns.join(','))
        .eq('company_id', currentCompany.id);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("Nenhum dado para exportar");
        return;
      }

      // Convert to CSV
      const headers = option.columns;
      const rows = data.map((row: any) => 
        headers.map(h => {
          const value = row[h];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
          return String(value);
        }).join(';')
      );
      
      const csv = [headers.join(';'), ...rows].join('\n');
      const bom = '\uFEFF'; // BOM for Excel UTF-8
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${option.id}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      setExported(prev => [...prev, option.id]);
      toast.success(`${option.label} exportado com sucesso!`);
    } catch (error: any) {
      toast.error(`Erro ao exportar: ${error.message}`);
    } finally {
      setExporting(null);
    }
  };

  const handleExportAll = async () => {
    for (const option of exportOptions) {
      if (counts[option.id] && counts[option.id] > 0) {
        await handleExport(option);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between exports
      }
    }
  };

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">Apenas administradores podem exportar dados.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 pt-12 lg:pt-0">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-in">
          <Link to="/configuracoes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-display font-bold text-foreground">Dados e Exportação</h1>
            <p className="text-muted-foreground mt-1">Exporte seus dados em formato CSV para backup ou análise.</p>
          </div>
          <Button 
            onClick={handleExportAll}
            disabled={exporting !== null}
            className="hidden md:flex"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Tudo
          </Button>
        </div>

        {/* Export Options */}
        <Card className="animate-slide-up">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Exportar Dados</CardTitle>
                <CardDescription>Baixe seus dados em formato CSV compatível com Excel.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exportOptions.map((option) => (
                <div 
                  key={option.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center">
                      <option.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{option.label}</p>
                        {exported.includes(option.id) && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {counts[option.id] ?? '...'} registros
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(option)}
                    disabled={exporting !== null || !counts[option.id]}
                  >
                    {exporting === option.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Backup Info */}
        <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
          <CardHeader>
            <CardTitle>Backup Automático</CardTitle>
            <CardDescription>Seus dados são armazenados com segurança na nuvem.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">Backups Ativos</p>
                  <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                    O sistema realiza backups automáticos diários de todos os seus dados. 
                    Os backups são mantidos por 30 dias e podem ser restaurados em caso de necessidade.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle>Retenção de Dados</CardTitle>
            <CardDescription>Informações sobre como seus dados são armazenados.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">Dados de clientes e vendas</span>
                <span className="text-sm font-medium">Permanente</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">Histórico de login</span>
                <span className="text-sm font-medium">90 dias</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">Logs de atividade</span>
                <span className="text-sm font-medium">1 ano</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">Backups automáticos</span>
                <span className="text-sm font-medium">30 dias</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zona de Perigo - Reset Controlado de Dados */}
        <CompanyDataResetCard />

        {/* Mobile Export All Button */}
        <div className="md:hidden">
          <Button 
            onClick={handleExportAll}
            disabled={exporting !== null}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Todos os Dados
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
