import { Sidebar } from './Sidebar';
import { Settings, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { OverdueOrdersNotification } from '@/components/notifications/OverdueOrdersNotification';
import { AnnouncementBanner } from '@/components/announcements/AnnouncementBanner';
import { TutorialProvider } from '@/contexts/TutorialContext';
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay';
import { ModuleTutorialProvider } from '@/contexts/ModuleTutorialContext';
import { ModuleTutorialOverlay } from '@/components/tutorial/ModuleTutorialOverlay';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { profile, currentCompany } = useAuth();
  
  // Ativa monitoramento de timeout de sessão por inatividade
  useSessionTimeout();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <TutorialProvider>
      <ModuleTutorialProvider>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <main className="lg:pl-60 min-h-screen">
            {/* Top Header */}
            <header className="fixed top-0 right-0 left-0 lg:left-60 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
              <div className="flex items-center justify-between px-6 py-3">
                <div className="pl-12 lg:pl-0" />
                <div className="flex items-center gap-2">
                  <OverdueOrdersNotification />
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Settings className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </header>

            {/* Spacer for fixed header */}
            <div className="h-[52px]" />

            {/* Company Header */}
            {currentCompany && (
              <div className="px-6 py-5 border-b border-border bg-card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {currentCompany.logo_url ? (
                      <img 
                        src={currentCompany.logo_url} 
                        alt={currentCompany.name}
                        className="w-14 h-14 rounded-xl object-contain bg-background border border-border"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
                        <span className="font-display font-bold text-primary-foreground text-xl">
                          {currentCompany.name.charAt(0)}
                        </span>
                      </div>
                    )}
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
              <AnnouncementBanner />
              {children}
            </div>
          </main>

          {/* Tutorial Overlays */}
          <TutorialOverlay />
          <ModuleTutorialOverlay />
        </div>
      </ModuleTutorialProvider>
    </TutorialProvider>
  );
}
