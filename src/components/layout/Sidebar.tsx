import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Boxes,
  FileText, 
  ClipboardList,
  DollarSign,
  UserCog,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  Scissors,
  Settings,
  Receipt,
  Ruler,
  Headphones,
  Lightbulb,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { SupportSidebar } from '@/components/support/SupportSidebar';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { usePermissions, Module } from '@/hooks/usePermissions';
import { useEnabledModulesMap } from '@/hooks/useModuleSettings';

// MenuItem interface moved below imports

// Menu organizado por fluxo de trabalho
interface MenuItem {
  icon: LucideIcon;
  label: string;
  path: string;
  module?: Module;
  tutorialId?: string;
}

// Menu organizado por fluxo de trabalho
const menuItems: MenuItem[] = [
  // Visão Geral
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', module: 'dashboard', tutorialId: 'menu-dashboard' },
  
  // Comercial
  { icon: Users, label: 'Clientes', path: '/clientes', module: 'clientes', tutorialId: 'menu-clientes' },
  
  { icon: Boxes, label: 'Estoque', path: '/estoque', module: 'estoque', tutorialId: 'menu-estoque' },
  
  { icon: FileText, label: 'Orçamentos', path: '/orcamentos', module: 'orcamentos', tutorialId: 'menu-orcamentos' },
  { icon: ShoppingCart, label: 'Caixa', path: '/caixa-vendas', module: 'caixa-vendas', tutorialId: 'menu-caixa' },
  { icon: ClipboardList, label: 'Ordens de Serviço', path: '/ordens-servico', module: 'ordens-servico', tutorialId: 'menu-ordens-servico' },
  
  // Operacional
  { icon: Ruler, label: 'Medições', path: '/medicoes', module: 'medicoes', tutorialId: 'menu-medicoes' },
  { icon: Scissors, label: 'Plano de Corte', path: '/plano-corte', module: 'plano-corte', tutorialId: 'menu-plano-corte' },
  { icon: ClipboardList, label: 'Produção', path: '/producao', module: 'producao', tutorialId: 'menu-producao' },
  
  // Financeiro
  { icon: DollarSign, label: 'Financeiro', path: '/financeiro', module: 'financeiro', tutorialId: 'menu-financeiro' },
  { icon: Receipt, label: 'Fiscal', path: '/notas-fiscais', module: 'notas-fiscais', tutorialId: 'menu-notas-fiscais' },
  
  // Administração
  { icon: UserCog, label: 'Funcionários', path: '/funcionarios', module: 'funcionarios', tutorialId: 'menu-funcionarios' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes', module: 'configuracoes', tutorialId: 'menu-configuracoes' },
  
  // Feedback
  { icon: Lightbulb, label: 'Sugestões', path: '/feedbacks', tutorialId: 'menu-feedbacks' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, currentCompany } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const { openTicketsCount } = useSupportTickets();
  const { canAccess, isAdmin } = usePermissions();
  const enabledModules = useEnabledModulesMap();

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      // Sempre navegar para auth, mesmo se houver erro
      navigate('/auth');
    }
  };

  // Check if a module is globally disabled
  const isModuleDisabled = (moduleKey: string | undefined): boolean => {
    if (!moduleKey) return false;
    // Map module permission key to module_key in settings
    const keyMap: Record<string, string> = {
      'dashboard': 'dashboard',
      'clientes': 'clientes',
      'orcamentos': 'orcamentos',
      'ordens-servico': 'ordens-servico',
      'agenda': 'agenda',
      'medicoes': 'medicoes',
      'plano-corte': 'plano-corte',
      'produtos': 'produtos',
      'estoque': 'estoque',
      'pedidos-compra': 'pedidos-compra',
      'caixa-vendas': 'caixa-vendas',
      'financeiro': 'financeiro',
      'notas-fiscais': 'notas-fiscais',
      'funcionarios': 'funcionarios',
      'relatorios': 'relatorios',
      'configuracoes': 'configuracoes',
    };
    const settingsKey = keyMap[moduleKey] || moduleKey;
    return enabledModules[settingsKey] === false;
  };

  // Filter menu items based on permissions AND module enabled status
  const visibleMenuItems = menuItems.filter(item => {
    // First check if module is globally disabled - hide completely
    if (isModuleDisabled(item.module)) return false;
    // If no module defined, always show (like dashboard)
    if (!item.module) return true;
    // Admin sees everything
    if (isAdmin) return true;
    // Check permission for the module
    return canAccess(item.module);
  });

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
        "fixed left-0 top-0 h-screen w-60 bg-sidebar flex flex-col z-40 transition-transform duration-300",
        "lg:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border" data-tutorial="logo">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white text-xl font-bold">V</span>
              </div>
              <div>
                <h1 className="font-display font-bold text-lg text-sidebar-foreground">Vetra</h1>
                <p className="text-xs text-sidebar-foreground/50">Sistema de Gestão</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSupportOpen(true)}
              className="relative text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <Headphones className="h-5 w-5" />
              {openTicketsCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                >
                  {openTicketsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleMenuItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                data-tutorial={item.tutorialId}
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
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Support Sidebar */}
      <SupportSidebar open={supportOpen} onOpenChange={setSupportOpen} />
    </>
  );
}
