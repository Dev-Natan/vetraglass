import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { rateLimitStatus, checkRateLimit, recordLoginAttempt, formatRemainingTime } = useRateLimiting();
  
  // Login form - now uses username
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form (for company owners - still uses email)
  const [signupFullName, setSignupFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

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
      // It's a username - we need to find the internal email
      // First check if it's a direct email match (for admin/owner accounts)
      const { data: employeeData } = await supabase
        .from('employees')
        .select('user_id')
        .eq('username', loginUsername.toLowerCase())
        .single();

      if (employeeData?.user_id) {
        // Get the user's email from auth metadata
        // For username-based login, we need to construct the internal email
        // We need to find which company this username belongs to
        const { data: userCompanyData } = await supabase
          .from('user_companies')
          .select('company_id')
          .eq('user_id', employeeData.user_id)
          .single();

        if (userCompanyData?.company_id) {
          emailToUse = `${loginUsername.toLowerCase()}@${userCompanyData.company_id}.internal`;
        }
      } else {
        // Try as regular email (for owner accounts)
        emailToUse = loginUsername;
      }
    }

    const { error } = await signIn(emailToUse, loginPassword);
    
    // Record login attempt
    await recordLoginAttempt(loginUsername, !error);
    
    setIsLoading(false);
    
    if (error) {
      setErrors({ password: 'Usuário ou senha incorretos' });
    } else {
      navigate('/');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
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
      navigate('/');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar via-background to-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center mb-4">
            <span className="font-display font-bold text-2xl text-primary-foreground">V</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-foreground">Vetra</h1>
          <p className="text-muted-foreground mt-1">Sistema de Gestão para Vidraçarias</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar Empresa</TabsTrigger>
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
              
              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome Completo</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Seu nome"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      disabled={isLoading}
                      maxLength={100}
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
                      maxLength={255}
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
                      maxLength={128}
                    />
                    <PasswordStrengthIndicator password={signupPassword} />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirmar Senha</Label>
                    <PasswordInput
                      id="signup-confirm"
                      placeholder="••••••••"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      maxLength={128}
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
                      'Criar Empresa'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
