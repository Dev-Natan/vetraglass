import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Package, 
  Layers, 
  Users, 
  Settings, 
  Headphones, 
  Tags, 
  Activity,
  TrendingUp,
  Building2,
  FileText
} from "lucide-react";
import { useAdminStats } from "@/hooks/useAdminStats";

export default function AdminDashboard() {
  const { isSaasAdmin } = useAuth();
  const { data: stats, isLoading } = useAdminStats();

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

  const adminModules = [
    {
      title: "Item Templates",
      description: "Gerencie vidros, perfis e acessórios globais",
      icon: Layers,
      path: "/admin/item-templates",
      color: "bg-blue-500",
    },
    {
      title: "Product Templates",
      description: "Gerencie modelos de produtos (Box, Portas, Janelas)",
      icon: Package,
      path: "/admin/product-templates",
      color: "bg-green-500",
    },
    {
      title: "Categorias",
      description: "Linhas, categorias e tipos de itens",
      icon: Tags,
      path: "/admin/categories",
      color: "bg-cyan-500",
    },
    {
      title: "Empresas",
      description: "Visualize e gerencie empresas cadastradas",
      icon: Users,
      path: "/admin/companies",
      color: "bg-purple-500",
    },
    {
      title: "Suporte",
      description: "Tickets de suporte dos clientes",
      icon: Headphones,
      path: "/admin/support",
      color: "bg-rose-500",
      badge: stats?.openTicketsCount,
    },
    {
      title: "Logs de Auditoria",
      description: "Histórico de ações do sistema",
      icon: Activity,
      path: "/admin/audit-logs",
      color: "bg-amber-500",
    },
    {
      title: "Configurações",
      description: "Configurações gerais do sistema",
      icon: Settings,
      path: "/admin/settings",
      color: "bg-orange-500",
    },
  ];

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do sistema SaaS</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-6 w-12" />
                  ) : (
                    <div className="text-2xl font-bold text-foreground">
                      {stats?.companiesCount || 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Empresas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Layers className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-6 w-12" />
                  ) : (
                    <div className="text-2xl font-bold text-foreground">
                      {stats?.itemTemplatesCount || 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Item Templates</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Package className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-6 w-12" />
                  ) : (
                    <div className="text-2xl font-bold text-foreground">
                      {stats?.productTemplatesCount || 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Products</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <TrendingUp className="h-4 w-4 text-cyan-500" />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-6 w-12" />
                  ) : (
                    <div className="text-2xl font-bold text-foreground">
                      {stats?.productLinhasCount || 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Linhas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Users className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-6 w-12" />
                  ) : (
                    <div className="text-2xl font-bold text-foreground">
                      {stats?.usersCount || 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={stats?.openTicketsCount ? "border-rose-500/50" : ""}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/10">
                  <Headphones className="h-4 w-4 text-rose-500" />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-6 w-12" />
                  ) : (
                    <div className="text-2xl font-bold text-foreground">
                      {stats?.openTicketsCount || 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Tickets Abertos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modules Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Módulos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {adminModules.map((module) => (
              <Link key={module.path} to={module.path}>
                <Card className="h-full hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50 group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={`w-10 h-10 rounded-lg ${module.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                        <module.icon className="w-5 h-5 text-white" />
                      </div>
                      {module.badge ? (
                        <span className="px-2 py-0.5 text-xs font-bold bg-rose-500 text-white rounded-full animate-pulse">
                          {module.badge}
                        </span>
                      ) : null}
                    </div>
                    <CardTitle className="text-base">{module.title}</CardTitle>
                    <CardDescription className="text-sm">{module.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/admin/item-templates">
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="pt-4 flex items-center gap-3">
                  <Layers className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Novo Item Template</span>
                </CardContent>
              </Card>
            </Link>
            <Link to="/admin/product-templates">
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="pt-4 flex items-center gap-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Novo Produto</span>
                </CardContent>
              </Card>
            </Link>
            <Link to="/admin/categories">
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="pt-4 flex items-center gap-3">
                  <Tags className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Nova Categoria</span>
                </CardContent>
              </Card>
            </Link>
            <Link to="/admin/audit-logs">
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="pt-4 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Ver Logs</span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
