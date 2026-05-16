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
import { getTimeBasedGreeting } from '@/utils/dateUtils';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { profile, currentCompany } = useAuth();
  
  // Ativa monitoramento de timeout de sessão por inatividade
  useSessionTimeout();

  return (
    <TutorialProvider>
      <ModuleTutorialProvider>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <main className="lg:pl-64 min-h-screen overflow-y-auto transition-all duration-300">
            {/* Top Header */}
            <header className="fixed top-0 right-0 left-0 lg:left-64 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm transition-all duration-300">
              <div className="flex items-center justify-between px-8 py-3 max-w-7xl mx-auto w-full">
                <div className="pl-12 lg:pl-0 flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <h2 className="text-xs font-bold text-muted-foreground/60 tracking-widest uppercase">
                    Vetra Cloud Console
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <OverdueOrdersNotification />
                  <div className="h-6 w-px bg-border/60 mx-1 hidden sm:block" />
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all">
                    <Settings className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </header>

            {/* Spacer for fixed header */}
            <div className="h-[61px]" />

            {/* Company Header */}
            {currentCompany && (
              <div className="px-8 py-8 border-b border-border/50 bg-white/50 dark:bg-card/30 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-7xl mx-auto">
                  <div className="flex items-center gap-5">
                    {currentCompany.logo_url ? (
                      <img 
                        src={currentCompany.logo_url} 
                        alt={currentCompany.name}
                        className="w-16 h-16 rounded-2xl object-contain bg-white border border-border shadow-sm ring-4 ring-background"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 ring-4 ring-background">
                        <span className="font-display font-bold text-primary-foreground text-2xl">
                          {currentCompany.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
                        {currentCompany.name}
                      </h1>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {getTimeBasedGreeting()}, <span className="font-semibold text-primary">{profile?.full_name || 'Usuário'}</span>
                      </p>
                    </div>
                  </div>
                  <div className="relative w-full md:w-80 group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      placeholder="Buscar por atalhos..." 
                      className="pl-11 h-12 bg-background border-border/50 rounded-2xl shadow-sm focus-visible:ring-primary/20 focus-visible:border-primary transition-all group-hover:border-border"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Page Content */}
            <div className="p-8 max-w-7xl mx-auto min-h-[calc(100vh-210px)]">
              <div className="animate-fade-in">
                <AnnouncementBanner />
                {children}
              </div>
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
