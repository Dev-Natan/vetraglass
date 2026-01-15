import { z } from 'zod';

// Strong password requirements
export const strongPasswordSchema = z
  .string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .max(128, 'Senha deve ter no máximo 128 caracteres')
  .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial (!@#$%^&*)');

// Password strength calculator
export function calculatePasswordStrength(password: string): {
  score: number; // 0-4
  label: string;
  color: string;
} {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  // Normalize to 0-4
  score = Math.min(4, Math.floor(score * 0.8));
  
  const labels = ['Muito fraca', 'Fraca', 'Regular', 'Boa', 'Forte'];
  const colors = ['bg-destructive', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
  
  return {
    score,
    label: labels[score],
    color: colors[score]
  };
}

// Check for common weak passwords
const commonWeakPasswords = [
  '12345678', '123456789', '1234567890', 'password', 'password1',
  'qwerty123', 'abc12345', 'senha123', 'admin123', 'user1234',
  'welcome1', 'letmein1', 'monkey12', 'dragon12', 'master12'
];

export function isCommonPassword(password: string): boolean {
  return commonWeakPasswords.some(weak => 
    password.toLowerCase().includes(weak.toLowerCase())
  );
}

// Validate password with detailed errors
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Mínimo de 8 caracteres');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Uma letra maiúscula');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Uma letra minúscula');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Um número');
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Um caractere especial');
  }
  
  if (isCommonPassword(password)) {
    errors.push('Evite senhas comuns');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
