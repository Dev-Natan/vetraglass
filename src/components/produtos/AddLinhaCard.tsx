import { Card } from '@/components/ui/card';
import { Plus } from 'lucide-react';

interface AddLinhaCardProps {
  onClick: () => void;
}

export function AddLinhaCard({ onClick }: AddLinhaCardProps) {
  return (
    <Card 
      onClick={onClick}
      className="relative bg-card border-2 border-dashed border-primary/50 rounded-lg overflow-hidden hover:border-primary/80 transition-colors cursor-pointer group"
    >
      <div className="p-4 flex flex-col items-center justify-center min-h-[140px]">
        <span className="text-primary font-semibold text-sm mb-3 text-center">Adicionar novas linhas de produtos ao sistema</span>
        <div className="w-10 h-10 rounded-full bg-primary group-hover:opacity-90 flex items-center justify-center transition-opacity">
          <Plus className="w-6 h-6 text-primary-foreground" />
        </div>
      </div>
    </Card>
  );
}
