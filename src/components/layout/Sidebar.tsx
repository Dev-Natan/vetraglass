import { useState, useEffect } from 'react';
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
  Tag,
  CalendarDays,
  Layers,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { SupportSidebar } from '@/components/support/SupportSidebar';
import vetraLogo from '@/assets/vetra-logo.png.asset.json';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { usePermissions, Module } from '@/hooks/usePermissions';
import { useEnabledModulesMap } from '@/hooks/useModuleSettings';
import { CompanySwitcher } from '@/components/layout/CompanySwitcher';

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
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', module: 'dashboard', tutorialId: 'menu-dashboard' },
  { icon: ShoppingCart, label: 'Caixa & Vendas', path: '/caixa-vendas', module: 'caixa-vendas' },
  { icon: Users, label: 'Clientes', path: '/clientes', module: 'clientes', tutorialId: 'menu-clientes' },
  { icon: FileText, label: 'Orçamentos', path: '/orcamentos', module: 'orcamentos', tutorialId: 'menu-orcamentos' },
  { icon: Package, label: 'Produtos', path: '/produtos', module: 'produtos', tutorialId: 'menu-produtos' },
  { icon: Boxes, label: 'Estoque', path: '/estoque', module: 'estoque', tutorialId: 'menu-estoque' },

  { icon: Tag, label: 'Meus Preços', path: '/meus-precos', module: 'produtos' },
  { icon: ClipboardList, label: 'Ordens de Serviço', path: '/ordens-servico', module: 'ordens-servico', tutorialId: 'menu-ordens-servico' },
  { icon: Scissors, label: 'Plano de Corte', path: '/plano-de-corte' },
  { icon: CalendarDays, label: 'Agenda', path: '/agenda', module: 'agenda', tutorialId: 'menu-agenda' },
  { icon: Ruler, label: 'Medições', path: '/medicoes', module: 'medicoes', tutorialId: 'menu-medicoes' },
  { icon: DollarSign, label: 'Financeiro', path: '/financeiro', module: 'financeiro', tutorialId: 'menu-financeiro' },
  { icon: UserCog, label: 'Funcionários', path: '/funcionarios', module: 'funcionarios', tutorialId: 'menu-funcionarios' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes', module: 'configuracoes', tutorialId: 'menu-configuracoes' },
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
        className="fixed top-3 left-3 z-50 lg:hidden bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent h-10 w-10 shadow-lg border border-white/10"
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
        "fixed left-0 top-0 h-screen w-72 lg:w-64 bg-sidebar flex flex-col z-40 transition-all duration-300 ease-in-out shadow-2xl",
        "lg:translate-x-0 lg:shadow-none",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border/30" data-tutorial="logo">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 overflow-hidden">
                <img src={vetraLogo.url} alt="Vetra" className="w-9 h-9 object-contain" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg text-sidebar-foreground tracking-tight">Vetra</h1>
                <p className="text-[10px] text-sidebar-foreground/50 uppercase font-semibold tracking-wider">Gestão Inteligente</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSupportOpen(true)}
              className="relative text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/10"
            >
              <Headphones className="h-5 w-5" />
              {openTicketsCount > 0 && (
                <span 
                  className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive animate-pulse"
                />
              )}
            </Button>
          </div>
        </div>

        {/* Company Switcher */}
        <div className="px-4 pt-3">
          <CompanySwitcher className="w-full justify-start bg-white/5 border-white/10 text-sidebar-foreground hover:bg-white/10" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          {visibleMenuItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                data-tutorial={item.tutorialId}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20" 
                    : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-white" : "text-sidebar-foreground/60"
                )} />
                <span className="text-sm font-medium">{item.label}</span>
                {isActive && (
                  <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />
                )}
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
