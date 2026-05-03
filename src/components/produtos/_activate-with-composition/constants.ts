import { Package, DollarSign } from 'lucide-react';

export const itemTypeTabs = [
  { value: 'glass', label: 'VIDROS', dbType: 'glass' as const },
  { value: 'profile', label: 'PERFIS', dbType: 'profile' as const },
  { value: 'accessory', label: 'ACESSÓRIOS', dbType: 'accessory' as const },
];

export const typeColors: Record<string, string> = {
  profile: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  glass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  accessory: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

export const typeLabels: Record<string, string> = {
  profile: 'Perfil',
  glass: 'Vidro',
  accessory: 'Acessório',
};

export const wizardSteps = [
  { id: 'components' as const, label: 'Componentes', icon: Package },
  { id: 'pricing' as const, label: 'Preços', icon: DollarSign },
];
