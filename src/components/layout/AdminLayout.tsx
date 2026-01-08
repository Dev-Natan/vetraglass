import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Layers,
  Package,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  Upload,
} from "lucide-react";

const adminMenuItems = [
  {
    title: "Dashboard",
    path: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Item Templates",
    path: "/admin/item-templates",
    icon: Layers,
  },
  {
    title: "Product Templates",
    path: "/admin/product-templates",
    icon: Package,
  },
  {
    title: "Importar Produtos",
    path: "/admin/import-products",
    icon: Upload,
  },
  {
    title: "Empresas",
    path: "/admin/companies",
    icon: Users,
  },
  {
    title: "Configurações",
    path: "/admin/settings",
    icon: Settings,
  },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { signOut, profile } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        {/* Logo/Header */}
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-foreground">SaaS Admin</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {profile?.full_name || "Administrador"}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {adminMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive(item.path)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.title}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t space-y-3">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar ao Sistema
          </Link>
          <Button
            variant="destructive"
            size="sm"
            className="w-full justify-start"
            onClick={() => signOut()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair do Sistema
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
