import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function LazyPageLoader() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header skeleton */}
      <div className="h-16 border-b border-border/50 flex items-center px-4 gap-4">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-32" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      
      {/* Content skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    </div>
  );
}

export function LazyContentLoader() {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}
