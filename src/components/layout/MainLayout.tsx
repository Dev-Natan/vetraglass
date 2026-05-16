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
            <header className="fixed top-0 right-0 left-0 lg:left-64 z-30 bg-background/60 backdrop-blur-md border-b border-border/50">
              <div className="flex items-center justify-between px-8 py-3.5">
                <div className="pl-12 lg:pl-0">
                  <h2 className="text-sm font-semibold text-muted-foreground/80 tracking-wide uppercase">
                    Vetra Cloud
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <OverdueOrdersNotification />
                  <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-full">
                    <Settings className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </header>

            {/* Spacer for fixed header */}
            <div className="h-[61px]" />

            {/* Company Header */}
            {currentCompany && (
              <div className="px-4 sm:px-8 py-6 sm:py-10 border-b border-border/40 bg-gradient-to-b from-white to-transparent dark:from-card/40 dark:to-transparent">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 max-w-7xl mx-auto">
                  <div className="flex items-center gap-6">
                    {currentCompany.logo_url ? (
                      <div className="relative group">
                        <img 
                          src={currentCompany.logo_url} 
                          alt={currentCompany.name}
                          className="w-20 h-20 rounded-[2rem] object-contain bg-white border border-border/50 shadow-xl ring-8 ring-background/50 transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 rounded-[2rem] shadow-inner pointer-events-none" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-primary via-primary/90 to-blue-600 flex items-center justify-center shadow-2xl shadow-primary/30 ring-8 ring-background/50 transition-transform duration-500 hover:scale-105">
                        <span className="font-display font-bold text-primary-foreground text-3xl">
                          {currentCompany.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="space-y-1">
                      <h1 className="font-display font-black text-3xl text-foreground tracking-tight sm:text-4xl">
                        {currentCompany.name}
                      </h1>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground/80">
                          {getTimeBasedGreeting()},
                        </span>
                        <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          {profile?.full_name || 'Usuário'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-all duration-300" />
                    <Input 
                      placeholder="Buscar por atalhos ou comandos..." 
                      className="pl-12 h-14 bg-background/50 backdrop-blur-sm border-border/50 rounded-2xl shadow-inner-lg focus-visible:ring-primary/10 focus-visible:border-primary/50 transition-all duration-300 group-hover:bg-background"
                    />
                    <kbd className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 group-focus-within:hidden">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </div>
                </div>
              </div>
            )}

            {/* Page Content */}
            <div className="p-4 sm:p-8 max-w-7xl mx-auto min-h-[calc(100vh-210px)]">
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
