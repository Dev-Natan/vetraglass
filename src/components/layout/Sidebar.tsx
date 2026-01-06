import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Boxes,
  FileText, 
  ClipboardList,
  DollarSign,
  UserCog,
  ChevronDown,
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
  { icon: Users, label: 'Clientes', path: '/clientes' },
  { icon: Package, label: 'Produtos', path: '/produtos' },
  { icon: Boxes, label: 'Estoque', path: '/estoque' },
  { icon: FileText, label: 'Orçamentos', path: '/orcamentos' },
  { icon: ClipboardList, label: 'Ordens de Serviço', path: '/ordens-servico' },
  { icon: DollarSign, label: 'Financeiro', path: '/financeiro' },
  { icon: UserCog, label: 'Funcionários', path: '/funcionarios' },
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
        className="fixed top-4 left-4 z-50 lg:hidden bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent"
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
        "fixed left-0 top-0 h-screen w-60 bg-sidebar flex flex-col z-50 transition-transform duration-300",
        "lg:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center font-display font-bold text-sidebar-primary-foreground text-lg">
              V
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-sidebar-foreground">Vetra</h1>
              <p className="text-xs text-sidebar-foreground/50">Sistema de Gestão</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border">
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}