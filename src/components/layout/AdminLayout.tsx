import { useState, forwardRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Layers,
  Package,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileSpreadsheet,
  Shield,
  Headphones,
  Megaphone,
  
  Tags,
  Image as ImageIcon,
  Database,
  
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";

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
    title: "Matérias-primas",
    path: "/admin/material-families",
    icon: Layers,
  },
  {
    title: "Product Templates",
    path: "/admin/product-templates",
    icon: Package,
  },
  {
    title: "Categorias",
    path: "/admin/categories",
    icon: Tags,
  },
  {
    title: "Empresas",
    path: "/admin/companies",
    icon: Users,
  },
  {
    title: "Avisos",
    path: "/admin/announcements",
    icon: Megaphone,
  },
  {
    title: "Suporte",
    path: "/admin/support",
    icon: Headphones,
    showBadge: true,
  },
  {
    title: "Feedbacks",
    path: "/admin/feedbacks",
    icon: Megaphone,
  },
  {
    title: "Migrações",
    path: "/admin/migrations",
    icon: Database,
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
  const [collapsed, setCollapsed] = useState(false);
  const { data: stats } = useAdminStats();
  const openTicketsCount = stats?.openTicketsCount || 0;
  
  // Ativa monitoramento de timeout de sessão por inatividade
  useSessionTimeout();

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  const NavItemContent = forwardRef<HTMLAnchorElement, { item: (typeof adminMenuItems)[0]; hasBadge: boolean }>(
    ({ item, hasBadge, ...props }, ref) => (
      <Link
        ref={ref}
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative",
          isActive(item.path)
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
        {...props}
      >
        <div className="relative">
          <item.icon className={cn("shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")} />
          {hasBadge && collapsed && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[10px] font-bold bg-rose-500 text-white rounded-full flex items-center justify-center animate-pulse">
              {openTicketsCount > 9 ? "9+" : openTicketsCount}
            </span>
          )}
        </div>
        {!collapsed && (
          <span className="flex-1 flex items-center justify-between">
            {item.title}
            {hasBadge && (
              <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-[10px] animate-pulse">
                {openTicketsCount}
              </Badge>
            )}
          </span>
        )}
      </Link>
    )
  );
  NavItemContent.displayName = "NavItemContent";

  const NavItem = ({ item }: { item: (typeof adminMenuItems)[0] }) => {
    const hasBadge = item.showBadge && openTicketsCount > 0;

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <NavItemContent item={item} hasBadge={hasBadge} />
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium flex items-center gap-2">
            {item.title}
            {hasBadge && (
              <Badge variant="destructive" className="px-1.5 py-0.5 text-[10px]">
                {openTicketsCount}
              </Badge>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <NavItemContent item={item} hasBadge={hasBadge} />;
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-screen border-r bg-card flex flex-col transition-all duration-300 ease-in-out z-40",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo/Header */}
        <div className={cn(
          "p-4 border-b flex items-center gap-3",
          collapsed && "justify-center"
        )}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-bold text-foreground truncate">SaaS Admin</h1>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.full_name || "Administrador"}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {adminMenuItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t space-y-2">
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => signOut()}
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sair do Sistema</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => signOut()}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair do Sistema
            </Button>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-20 -right-3 w-6 h-6 bg-background border rounded-full flex items-center justify-center shadow-sm hover:bg-muted transition-colors"
          style={{ left: collapsed ? "52px" : "248px" }}
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-auto transition-all duration-300",
        collapsed ? "ml-16" : "ml-64"
      )}>
        {children}
      </main>
    </div>
  );
}
