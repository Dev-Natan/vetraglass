import { Package, Star, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyProductsStateProps {
  type: 'no-results' | 'no-favorites' | 'empty';
  searchTerm?: string;
  onClearSearch?: () => void;
  onClearFavorites?: () => void;
}

export function EmptyProductsState({ 
  type, 
  searchTerm, 
  onClearSearch,
  onClearFavorites 
}: EmptyProductsStateProps) {
  const configs = {
    'no-results': {
      icon: Search,
      title: 'Nenhuma linha encontrada',
      description: `Não encontramos resultados para "${searchTerm}". Tente buscar por outro termo.`,
      action: onClearSearch && (
        <Button variant="outline" onClick={onClearSearch} className="mt-4">
          Limpar busca
        </Button>
      ),
    },
    'no-favorites': {
      icon: Star,
      title: 'Nenhum favorito ainda',
      description: 'Adicione linhas aos favoritos clicando na estrela para acessá-las rapidamente.',
      action: onClearFavorites && (
        <Button variant="outline" onClick={onClearFavorites} className="mt-4">
          Ver todas as linhas
        </Button>
      ),
    },
    'empty': {
      icon: Package,
      title: 'Nenhuma linha cadastrada',
      description: 'As linhas de produtos serão exibidas aqui quando estiverem disponíveis.',
      action: null,
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-muted-foreground/50" />
      </div>
      <h3 className="font-semibold text-lg text-foreground mb-2">
        {config.title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        {config.description}
      </p>
      {config.action}
    </div>
  );
}
