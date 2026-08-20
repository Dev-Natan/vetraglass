import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ShieldAlert, User } from 'lucide-react';
import { z } from 'zod';
import { useRateLimiting } from '@/hooks/useRateLimiting';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { strongPasswordSchema } from '@/utils/passwordValidation';
import { supabase } from '@/integrations/supabase/client';
import { useSystemSettings } from '@/hooks/useSystemSettings';

const SIGNUP_DISABLED_MESSAGE = 'Cadastros temporariamente suspensos para manutenção do sistema. Voltaremos em breve!';

const loginSchema = z.object({
  username: z.string().min(1, 'Usuário é obrigatório'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
  password: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const { allowNewSignups } = useSystemSettings();
  const signupDisabled = !allowNewSignups;
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { rateLimitStatus, checkRateLimit, recordLoginAttempt, formatRemainingTime } = useRateLimiting();
  
  // Get initial tab from URL parameter
  const initialTab = !signupDisabled && searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Login form - now uses username
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form (for company owners - still uses email)
  const [signupFullName, setSignupFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  const nextParam = searchParams.get('next');
  const isSafeNext = (n: string | null): n is string =>
    !!n && n.startsWith('/') && !n.startsWith('//');
  const postLoginTarget = isSafeNext(nextParam) ? nextParam : '/dashboard';

  useEffect(() => {
    if (user) {
      navigate(postLoginTarget);
    }
  }, [user, navigate, postLoginTarget]);
  
  // Update active tab when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'signup') {
      setActiveTab('signup');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const validation = loginSchema.safeParse({
      username: loginUsername,
      password: loginPassword,
    });
    
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Check rate limit before attempting login
    const rateLimit = await checkRateLimit(loginUsername);
    if (rateLimit?.isBlocked) {
      setErrors({
        username: `Conta bloqueada temporariamente. Tente novamente em ${formatRemainingTime(rateLimit.remainingSeconds)}`
      });
      return;
    }
    
    setIsLoading(true);

    // Determine if input is email or username
    const isEmail = loginUsername.includes('@');
    let emailToUse = loginUsername;

    if (!isEmail) {
      // It's a username - use secure function to get internal email
      const { data: internalEmail } = await supabase
        .rpc('get_employee_login_email', { p_username: loginUsername.toLowerCase() });

      if (internalEmail) {
        emailToUse = internalEmail;
      }
      // If no internal email found, will try as-is (fallback for other account types)
    }

    const { error } = await signIn(emailToUse, loginPassword);
    
    // Record login attempt
    await recordLoginAttempt(loginUsername, !error);
    
    setIsLoading(false);
    
    if (error) {
      setErrors({ password: 'Usuário ou senha incorretos' });
    } else {
      navigate(postLoginTarget);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupDisabled) return;
    setErrors({});
    
    const validation = signupSchema.safeParse({
      fullName: signupFullName,
      email: signupEmail,
      password: signupPassword,
      confirmPassword: signupConfirmPassword,
    });
    
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }
    
    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupFullName);
    setIsLoading(false);
    
    if (!error) {
      // Etapa 2: redireciona para configuração obrigatória da empresa B2B
      navigate('/empresa/nova');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isBlocked = rateLimitStatus?.isBlocked ?? false;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sidebar via-background to-background p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary/80 mx-auto flex items-center justify-center mb-6 shadow-xl shadow-primary/20 ring-4 ring-background">
            <span className="font-display font-bold text-3xl text-primary-foreground">V</span>
          </div>
          <h1 className="font-display font-bold text-4xl text-foreground tracking-tight">Vetra</h1>
          <p className="text-muted-foreground mt-2 font-medium">Sistema de Gestão para Vidraçarias</p>
        </div>

        <Card className="border-border/40 shadow-2xl backdrop-blur-sm bg-card/95 rounded-3xl overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <CardHeader className="pb-4">
              <TabsList className={`grid w-full ${signupDisabled ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <TabsTrigger value="login">Entrar</TabsTrigger>
                {!signupDisabled && <TabsTrigger value="signup">Criar Conta</TabsTrigger>}
              </TabsList>
            </CardHeader>
            
            <CardContent>
              {isBlocked && (
                <Alert variant="destructive" className="mb-4">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription>
                    Muitas tentativas de login. Aguarde {formatRemainingTime(rateLimitStatus?.remainingSeconds ?? 0)} para tentar novamente.
                  </AlertDescription>
                </Alert>
              )}

              {signupDisabled && (
                <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800">
                  <ShieldAlert className="h-4 w-4 !text-amber-600" />
                  <AlertDescription className="font-medium">
                    {SIGNUP_DISABLED_MESSAGE}
                  </AlertDescription>
                </Alert>
              )}

              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Usuário</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-username"
                        type="text"
                        placeholder="seu.usuario ou email"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        disabled={isLoading || isBlocked}
                        className="pl-10"
                        autoComplete="username"
                      />
                    </div>
                    {errors.username && (
                      <p className="text-sm text-destructive">{errors.username}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <PasswordInput
                      id="login-password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading || isBlocked}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading || isBlocked}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                  <div className="text-center">
                    <Link 
                      to="/recuperar-senha" 
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      Esqueceu sua senha?
                    </Link>
                  </div>
                </form>
              </TabsContent>
              
              {!signupDisabled && (
                <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-fullname">Nome Completo</Label>
                    <Input
                      id="signup-fullname"
                      type="text"
                      placeholder="Seu nome"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.fullName && (
                      <p className="text-sm text-destructive">{errors.fullName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <PasswordInput
                      id="signup-password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <PasswordStrengthIndicator password={signupPassword} />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirmar Senha</Label>
                    <PasswordInput
                      id="signup-confirm-password"
                      placeholder="••••••••"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      'Criar Conta'
                    )}
                  </Button>
                </form>
                </TabsContent>
              )}

            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
