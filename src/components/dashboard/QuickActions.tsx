import { Plus, FileText, Users, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';

const actions = [
  { icon: Plus, label: 'Novo Pedido', variant: 'accent' as const },
  { icon: FileText, label: 'Novo Orçamento', variant: 'default' as const },
  { icon: Users, label: 'Novo Cliente', variant: 'default' as const },
  { icon: Calculator, label: 'Calculadora', variant: 'default' as const },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.variant}
          className="gap-2"
        >
          <action.icon className="w-4 h-4" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}
