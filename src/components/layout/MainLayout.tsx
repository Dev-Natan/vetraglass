import { Sidebar } from './Sidebar';
import { Bell, Settings, Search, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { profile, currentCompany } = useAuth();
  const navigate = useNavigate();

  // Query cash register status
  const { data: openCashRegister } = useQuery({
    queryKey: ['cash-register-status', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from('cash_registers')
        .select('id, opened_at, opening_amount')
        .eq('company_id', currentCompany.id)
        .eq('status', 'open')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const isCaixaAberto = !!openCashRegister;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-60 min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-6 py-3">
          <div className="pl-12 lg:pl-0">
              <Button 
                variant={isCaixaAberto ? "default" : "destructive"} 
                className="gap-2 rounded-full px-5 h-auto py-2"
                onClick={() => navigate('/caixa')}
              >
                <Wallet className="w-4 h-4" />
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium">
                    {isCaixaAberto ? 'Caixa Aberto' : 'Caixa Fechado'}
                  </span>
                  {isCaixaAberto && openCashRegister?.opened_at && (
                    <span className="text-[10px] opacity-80">
                      desde {format(new Date(openCashRegister.opened_at), 'HH:mm')}
                    </span>
                  )}
                </div>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Bell className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Company Header */}
        {currentCompany && (
          <div className="px-6 py-5 border-b border-border bg-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
                  <span className="font-display font-bold text-primary-foreground text-xl">
                    {currentCompany.logo_url || currentCompany.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h1 className="font-display font-bold text-xl text-foreground uppercase tracking-wide">
                    {currentCompany.name}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {getGreeting()}, <span className="font-medium text-foreground">{profile?.full_name || 'Usuário'}</span>
                  </p>
                </div>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar produtos, clientes..." 
                  className="pl-10 bg-background"
                />
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
