import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { Loader2, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface InviteInfo {
  valid: boolean;
  email?: string;
  employee_name?: string;
  company_name?: string;
  role?: string;
  error?: string;
}

export default function AceitarConvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!token) {
      setInviteInfo({ valid: false, error: 'Token não encontrado' });
      setLoading(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase.rpc('validate_invite_token', {
        _token: token,
      });

      if (error) throw error;

      const inviteData = data as unknown as InviteInfo;
      setInviteInfo(inviteData);
      if (inviteData?.employee_name) {
        setFullName(inviteData.employee_name);
      }
    } catch (error) {
      console.error('Error validating token:', error);
      setInviteInfo({ valid: false, error: 'Erro ao validar convite' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (password.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create the user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: inviteInfo?.email || '',
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error('Erro ao criar conta');
      }

      // 2. Accept the invite (this links user_id to employee and creates user_companies)
      const { data: acceptResult, error: acceptError } = await supabase.rpc('accept_employee_invite', {
        _token: token,
        _user_id: authData.user.id,
      });

      if (acceptError) throw acceptError;

      const result = acceptResult as { success: boolean; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao aceitar convite');
      }

      toast.success('Conta criada com sucesso! Você já pode fazer login.');
      
      // Sign out and redirect to login
      await supabase.auth.signOut();
      navigate('/auth');

    } catch (error: any) {
      console.error('Error accepting invite:', error);
      
      if (error.message?.includes('already registered')) {
        toast.error('Este email já está registrado. Faça login normalmente.');
        navigate('/auth');
      } else {
        toast.error(error.message || 'Erro ao criar conta');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Validando convite...</p>
        </div>
      </div>
    );
  }

  if (!inviteInfo?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Convite Inválido</CardTitle>
            <CardDescription>
              {inviteInfo?.error || 'Este convite não é válido ou já expirou.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Entre em contato com o administrador da sua empresa para solicitar um novo convite.
            </p>
            <Button onClick={() => navigate('/auth')}>
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Bem-vindo ao Sistema!</CardTitle>
          <CardDescription>
            Você foi convidado para fazer parte de <strong>{inviteInfo.company_name}</strong>.
            Complete seu cadastro abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteInfo.email}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
              />
              <PasswordStrengthIndicator password={password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite a senha novamente"
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-sm text-destructive">As senhas não coincidem</p>
              )}
            </div>

            <div className="pt-2">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={submitting || password !== confirmPassword}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Criar Minha Conta
                  </>
                )}
              </Button>
            </div>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Ao criar sua conta, você concorda com os termos de uso do sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
