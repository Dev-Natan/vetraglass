import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [isSaasAdmin, setIsSaasAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    let currentFetchId = 0;

    const handleSession = async (newSession: Session | null, source: string) => {
      if (!isMounted) return;
      
      const fetchId = ++currentFetchId;
      
      // Update session and user immediately
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (newSession?.user) {
        setLoading(true);
        
        try {
          // Only proceed if this is still the latest fetch request
          if (fetchId !== currentFetchId || !isMounted) return;
          
          await fetchUserData(newSession.user.id);
        } catch (error) {
          console.error(`Error fetching user data (${source}):`, error);
        }
      } else {
        // Clear all user data on logout
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
        // Skip initial session event if we haven't done initial check yet
        // This prevents double-fetching
        if (event === 'INITIAL_SESSION' && !initialCheckDone) {
          return;
        }
        
        // Handle token refresh silently without clearing state
        if (event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          return;
        }
        
        handleSession(newSession, `onAuthStateChange:${event}`);
      }
    );

    // THEN check for existing session (only once)
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!isMounted) return;
      setInitialCheckDone(true);
      handleSession(existingSession, 'getSession');
    });

    return () => {
      isMounted = false;
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
