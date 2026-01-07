import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';

interface AddLinhaCardProps {
  onClick: () => void;
}

export function AddLinhaCard({ onClick }: AddLinhaCardProps) {
  return (
    <Card 
      onClick={onClick}
      className="cursor-pointer hover:shadow-lg transition-all duration-200 border-dashed border-2 border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10"
    >
      <CardContent className="p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
          <Plus className="w-6 h-6 text-primary" />
        </div>
        <span className="font-medium text-primary">Adicionar</span>
      </CardContent>
    </Card>
  );
}
