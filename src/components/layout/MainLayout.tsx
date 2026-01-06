import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Company } from '@/types';
import { Bell, Settings, Search, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const defaultCompany: Company = {
  id: '1',
  name: 'Vidraçaria Central',
  cnpj: '12.345.678/0001-90',
  logo: 'VC',
};

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [currentCompany, setCurrentCompany] = useState<Company>(defaultCompany);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        currentCompany={currentCompany} 
        onCompanyChange={setCurrentCompany} 
      />
      <main className="lg:ml-60 min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="pl-12 lg:pl-0">
              <Button variant="destructive" className="gap-2 rounded-full px-5">
                <Wallet className="w-4 h-4" />
                Caixa Fechado
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
        <div className="px-6 py-5 border-b border-border bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
                <span className="font-display font-bold text-primary-foreground text-xl">
                  {currentCompany.logo || currentCompany.name.charAt(0)}
                </span>
              </div>
              <div>
                <h1 className="font-display font-bold text-xl text-foreground uppercase tracking-wide">
                  {currentCompany.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {getGreeting()}, <span className="font-medium text-foreground">Usuário</span>
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

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}