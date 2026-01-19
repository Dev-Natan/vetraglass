import { Card } from '@/components/ui/card';
import { Plus } from 'lucide-react';

interface AddLinhaCardProps {
  onClick: () => void;
}

export function AddLinhaCard({ onClick }: AddLinhaCardProps) {
  return (
    <Card 
      onClick={onClick}
      className="relative bg-card border-2 border-dashed border-sky-400 rounded-lg overflow-hidden hover:border-sky-500 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="p-4 pt-10 pb-4 flex flex-col items-center justify-center min-h-[140px]">
        <span className="text-sky-500 font-semibold text-sm mb-3">Adicionar</span>
        <div className="w-10 h-10 rounded-full bg-sky-500 group-hover:bg-sky-600 flex items-center justify-center transition-colors">
          <Plus className="w-6 h-6 text-white" />
        </div>
      </div>
    </Card>
  );
}
