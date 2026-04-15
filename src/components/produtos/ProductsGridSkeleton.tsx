import { cn } from '@/lib/utils';

interface ProductsGridSkeletonProps {
  viewMode: 'grid' | 'list';
  count?: number;
}

export function ProductsGridSkeleton({ viewMode, count = 8 }: ProductsGridSkeletonProps) {
  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {[...Array(count)].map((_, i) => (
          <div 
            key={i} 
            className="h-[74px] bg-muted/50 rounded-xl animate-pulse flex items-center gap-4 p-4"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="w-14 h-14 rounded-xl bg-muted/70" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted/70 rounded" />
              <div className="h-3 w-16 bg-muted/70 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {[...Array(count)].map((_, i) => (
        <div 
          key={i} 
          className={cn(
            "rounded-xl animate-pulse overflow-hidden",
            "bg-muted/30"
          )}
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="h-28 bg-muted/50" />
          <div className="p-4 pt-5 space-y-3">
            <div className="space-y-2">
              <div className="h-4 w-20 bg-muted/50 rounded mx-auto" />
              <div className="h-3 w-24 bg-muted/50 rounded mx-auto" />
            </div>
            <div className="h-9 bg-muted/50 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
