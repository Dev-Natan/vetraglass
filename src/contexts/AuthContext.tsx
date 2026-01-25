import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Company {
  id: string;
  name: string;
  cnpj: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  login_token: string | null;
}

interface UserCompany {
  id: string;
  company_id: string;
  role: 'admin' | 'manager' | 'employee';
  is_active: boolean;
  company: Company;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  companies: UserCompany[];
  currentCompany: Company | null;
  setCurrentCompany: (company: Company) => void;
  loading: boolean;
  isSaasAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [isSaasAdmin, setIsSaasAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Use refs for values that need to persist across renders and be accessible in closures
  const initialCheckDoneRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const clearAppStateForSecurity = () => {
      // Limpa estado + cache para evitar qualquer vazamento de dados entre contas
      localStorage.removeItem('currentCompanyId');
      setProfile(null);
      setCompanies([]);
      setCurrentCompany(null);
      setIsSaasAdmin(false);
      // React Query pode manter dados da conta anterior em cache
      queryClient.clear();
    };

    const hardResetAuthState = () => {
      currentUserIdRef.current = null;
      setUser(null);
      setSession(null);
      clearAppStateForSecurity();
      setLoading(false);
    };
    
    const handleSession = async (newSession: Session | null, source: string) => {
      if (!isMountedRef.current) return;
      
      const newUserId = newSession?.user?.id ?? null;

      // Se a sessão mudou de usuário, limpamos TUDO antes de carregar dados do novo usuário.
      // Isso evita que qualquer dado em cache (ou estado) “vaze” entre contas.
      const previousUserId = currentUserIdRef.current;
      if (previousUserId && newUserId && previousUserId !== newUserId) {
        clearAppStateForSecurity();
      }
      
      // Update session and user immediately
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (newSession?.user) {
        // Track current user to prevent stale data from overwriting
        currentUserIdRef.current = newUserId;
        setLoading(true);
        
        try {
          // Pass a check function to ensure we don't apply stale data
          await fetchUserData(newSession.user.id, () => 
            isMountedRef.current && currentUserIdRef.current === newUserId
          );
        } catch (error) {
          console.error(`Error fetching user data (${source}):`, error);
          if (isMountedRef.current) setLoading(false);
        }
      } else {
        // Clear all user data on logout
        currentUserIdRef.current = null;
        setProfile(null);
        setCompanies([]);
        setCurrentCompany(null);
        setIsSaasAdmin(false);
        setLoading(false);
      }
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('Auth event:', event, 'Session:', !!newSession);

        const newUserId = newSession?.user?.id ?? null;
        const currentUserId = currentUserIdRef.current;
        
        // TOKEN_REFRESHED pode acontecer em background. Se por qualquer motivo vier com outro user_id
        // (ex.: múltiplas abas/dispositivos), tratamos como troca completa de sessão.
        if (event === 'TOKEN_REFRESHED') {
          // Se não houver sessão válida, por segurança reseta tudo.
          if (!newSession?.user || !newUserId) {
            hardResetAuthState();
            return;
          }

          // Se houve mudança de usuário DURANTE refresh, não troque silenciosamente:
          // por segurança, desloga localmente e exige novo login.
          if (currentUserId && currentUserId !== newUserId) {
            console.warn('Token refresh retornou outro usuário. Fazendo logout por segurança.');
            hardResetAuthState();
            return;
          }

          currentUserIdRef.current = newUserId;
          setSession(newSession);
          setUser(newSession.user);
          return;
        }
        
        // Handle signed out - clear state immediately and don't try to refetch
        if (event === 'SIGNED_OUT') {
          hardResetAuthState();
          return;
        }
        
        // For INITIAL_SESSION, only handle if we haven't done initial check yet
        if (event === 'INITIAL_SESSION') {
          if (!initialCheckDoneRef.current) {
            initialCheckDoneRef.current = true;
            handleSession(newSession, `onAuthStateChange:${event}`);
          }
          return;
        }
        
        handleSession(newSession, `onAuthStateChange:${event}`);
      }
    );

    // THEN check for existing session (only once)
    supabase.auth.getSession().then(({ data: { session: existingSession }, error }) => {
      if (!isMountedRef.current) return;
      
      // If there's an error getting session (invalid/expired token), clear state
      if (error) {
        console.warn('Error getting session, clearing auth state:', error.message);
        initialCheckDoneRef.current = true;
        hardResetAuthState();
        return;
      }
      
      // Only process if listener hasn't already handled it
      if (!initialCheckDoneRef.current) {
        initialCheckDoneRef.current = true;
        handleSession(existingSession, 'getSession');
      }
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserData = async (userId: string, isCurrent?: () => boolean) => {
    const isSafe = () => !isCurrent || isCurrent();
    const safe = (fn: () => void) => {
      if (isSafe()) fn();
    };

    try {
      if (!isSafe()) return;

      // Check if user is SaaS admin
      const { data: saasAdminData } = await supabase
        .from('saas_admins')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      safe(() => setIsSaasAdmin(!!saasAdminData));
      if (!isSafe()) return;

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (profileData) safe(() => setProfile(profileData));
      if (!isSafe()) return;

      // Fetch user companies with company details
      const { data: userCompaniesData } = await supabase
        .from('user_companies')
        .select(`
          id,
          company_id,
          role,
          is_active,
          company:companies (
            id,
            name,
            cnpj,
            logo_url,
            address,
            phone,
            email,
            login_token
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (!isSafe()) return;

      if (userCompaniesData && userCompaniesData.length > 0) {
        const formattedCompanies = userCompaniesData.map(uc => ({
          id: uc.id,
          company_id: uc.company_id,
          role: uc.role as 'admin' | 'manager' | 'employee',
          is_active: uc.is_active,
          company: uc.company as unknown as Company
        }));
        safe(() => setCompanies(formattedCompanies));
        
        // Set first company as current if none selected
        const savedCompanyId = localStorage.getItem('currentCompanyId');
        const savedCompany = formattedCompanies.find(c => c.company.id === savedCompanyId);
        safe(() => setCurrentCompany(savedCompany?.company ?? formattedCompanies[0].company));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      safe(() => setLoading(false));
    }
  };

  const handleSetCurrentCompany = (company: Company) => {
    setCurrentCompany(company);
    localStorage.setItem('currentCompanyId', company.id);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      toast({
        title: "Erro ao entrar",
        description: error.message,
        variant: "destructive",
      });
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    if (error) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Conta criada com sucesso!",
        description: "Você já pode fazer login.",
      });
    }
    
    return { error };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.warn('Erro ao fazer logout no servidor:', error.message);
      }
    } catch (error) {
      console.warn('Erro inesperado no logout:', error);
    } finally {
      // SEMPRE limpar o estado local, independente do resultado
      localStorage.removeItem('currentCompanyId');
      setUser(null);
      setSession(null);
      setProfile(null);
      setCompanies([]);
      setCurrentCompany(null);
      setIsSaasAdmin(false);

      // Limpa cache para não exibir dados da conta anterior
      queryClient.clear();
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      companies,
      currentCompany,
      setCurrentCompany: handleSetCurrentCompany,
      loading,
      isSaasAdmin,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
