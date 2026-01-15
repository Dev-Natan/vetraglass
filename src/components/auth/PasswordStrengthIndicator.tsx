import { calculatePasswordStrength, validatePassword } from '@/utils/passwordValidation';
import { Check, X } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

export function PasswordStrengthIndicator({ 
  password, 
  showRequirements = true 
}: PasswordStrengthIndicatorProps) {
  const strength = calculatePasswordStrength(password);
  const validation = validatePassword(password);

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index <= strength.score ? strength.color : 'bg-muted'
            }`}
          />
        ))}
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          Força: <span className={`font-medium ${strength.score >= 3 ? 'text-green-600' : 'text-orange-500'}`}>
            {strength.label}
          </span>
        </span>
      </div>

      {/* Requirements checklist */}
      {showRequirements && (
        <div className="grid grid-cols-2 gap-1 text-xs">
          <RequirementItem 
            met={password.length >= 8} 
            text="8+ caracteres" 
          />
          <RequirementItem 
            met={/[A-Z]/.test(password)} 
            text="Maiúscula" 
          />
          <RequirementItem 
            met={/[a-z]/.test(password)} 
            text="Minúscula" 
          />
          <RequirementItem 
            met={/[0-9]/.test(password)} 
            text="Número" 
          />
          <RequirementItem 
            met={/[^A-Za-z0-9]/.test(password)} 
            text="Especial (!@#$)" 
          />
        </div>
      )}
    </div>
  );
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1 ${met ? 'text-green-600' : 'text-muted-foreground'}`}>
      {met ? (
        <Check className="h-3 w-3" />
      ) : (
        <X className="h-3 w-3" />
      )}
      <span>{text}</span>
    </div>
  );
}
