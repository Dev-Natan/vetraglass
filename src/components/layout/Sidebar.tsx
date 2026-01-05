import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Package, 
  Settings, 
  ChevronDown,
  Building2,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Company } from '@/types';
import { Button } from '@/components/ui/button';

const mockCompanies: Company[] = [
  { id: '1', name: 'Vidraçaria Central', cnpj: '12.345.678/0001-90' },
  { id: '2', name: 'Vidros Premium', cnpj: '98.765.432/0001-10' },
  { id: '3', name: 'Glass & Design', cnpj: '55.444.333/0001-22' },
];

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: FileText, label: 'Orçamentos', path: '/orcamentos' },
  { icon: Package, label: 'Pedidos', path: '/pedidos' },
  { icon: Users, label: 'Clientes', path: '/clientes' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

interface SidebarProps {
  currentCompany: Company;
  onCompanyChange: (company: Company) => void;
}

export function Sidebar({ currentCompany, onCompanyChange }: SidebarProps) {
  const location = useLocation();
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-screen w-72 bg-sidebar flex flex-col z-50 transition-transform duration-300",
        "lg:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-sidebar-foreground">VidroGest</h1>
              <p className="text-xs text-sidebar-foreground/60">Gestão de Vidraçarias</p>
            </div>
          </div>
        </div>

        {/* Company Selector */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="relative">
            <button
              onClick={() => setIsCompanyOpen(!isCompanyOpen)}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
                  <span className="text-sm font-semibold text-sidebar-primary">
                    {currentCompany.name.charAt(0)}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-sidebar-foreground truncate max-w-[140px]">
                    {currentCompany.name}
                  </p>
                  <p className="text-xs text-sidebar-foreground/50">{currentCompany.cnpj}</p>
                </div>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-sidebar-foreground/50 transition-transform",
                isCompanyOpen && "rotate-180"
              )} />
            </button>

            {/* Dropdown */}
            {isCompanyOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 py-2 bg-sidebar-accent rounded-lg shadow-lg border border-sidebar-border animate-scale-in z-10">
                {mockCompanies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => {
                      onCompanyChange(company);
                      setIsCompanyOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 hover:bg-sidebar-border/50 transition-colors",
                      company.id === currentCompany.id && "bg-sidebar-border/30"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
                      <span className="text-sm font-semibold text-sidebar-primary">
                        {company.name.charAt(0)}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-sidebar-foreground">{company.name}</p>
                      <p className="text-xs text-sidebar-foreground/50">{company.cnpj}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
