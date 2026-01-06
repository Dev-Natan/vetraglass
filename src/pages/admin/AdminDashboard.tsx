import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Layers, Users, Settings } from "lucide-react";

export default function AdminDashboard() {
  const { isSaasAdmin } = useAuth();

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
      title: "Empresas",
      description: "Visualize e gerencie empresas cadastradas",
      icon: Users,
      path: "/admin/companies",
      color: "bg-purple-500",
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
          <p className="text-muted-foreground">Visão geral do sistema</p>
        </div>

        {/* Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {adminModules.map((module) => (
            <Link key={module.path} to={module.path}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary/50">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${module.color} flex items-center justify-center mb-3`}>
                    <module.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4">Estatísticas Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-primary">-</div>
                <p className="text-sm text-muted-foreground">Empresas Ativas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-primary">-</div>
                <p className="text-sm text-muted-foreground">Item Templates</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-primary">-</div>
                <p className="text-sm text-muted-foreground">Product Templates</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
