import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Sparkles } from 'lucide-react';

export function TrialBanner() {
  const navigate = useNavigate();
  const { currentCompany } = useAuth();

  if (!currentCompany) return null;

  const status = currentCompany.subscription_status ?? 'trialing';
  const trialEndsAt = currentCompany.trial_ends_at ? new Date(currentCompany.trial_ends_at) : null;

  if (status === 'active') return null;
  if (!trialEndsAt) return null;

  const now = new Date();
  const msLeft = trialEndsAt.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  const expired = msLeft <= 0;

  return (
    <div
      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg border px-4 py-3 mb-4 ${
        expired
          ? 'bg-destructive/10 border-destructive/30 text-destructive'
          : daysLeft <= 2
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
          : 'bg-primary/10 border-primary/30 text-foreground'
      }`}
      role="status"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {expired ? <AlertTriangle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        <span>
          {expired
            ? 'Seu teste grátis expirou. Escolha um plano para continuar usando o Vetra.'
            : `Faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} para o fim do seu teste grátis.`}
        </span>
      </div>
      <Button size="sm" onClick={() => navigate('/planos')}>
        Ver Planos
      </Button>
    </div>
  );
}
