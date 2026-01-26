import { memo } from 'react';
import { Plus, FileText, Users, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const actions = [
  { icon: ShoppingCart, label: 'Nova Venda', path: '/caixa-vendas', variant: 'accent' as const },
  { icon: FileText, label: 'Novo Orçamento', path: '/orcamentos', variant: 'default' as const },
  { icon: Users, label: 'Novo Cliente', path: '/clientes', variant: 'default' as const },
  { icon: Plus, label: 'Nova OS', path: '/ordens-servico', variant: 'default' as const },
];

export const QuickActions = memo(function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.variant}
          className="gap-2"
          onClick={() => navigate(action.path)}
        >
          <action.icon className="w-4 h-4" />
          {action.label}
        </Button>
      ))}
    </div>
  );
});
