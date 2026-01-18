import { cn } from '@/lib/utils';

interface GlassPreviewProps {
  width: number;
  height: number;
  name?: string;
  className?: string;
}

export function GlassPreview({ width, height, name, className }: GlassPreviewProps) {
  // Calculate aspect ratio for preview (max 60x80px container)
  const maxWidth = 60;
  const maxHeight = 50;
  
  const aspectRatio = width / height;
  
  let previewWidth: number;
  let previewHeight: number;
  
  if (aspectRatio > maxWidth / maxHeight) {
    // Width-constrained
    previewWidth = maxWidth;
    previewHeight = maxWidth / aspectRatio;
  } else {
    // Height-constrained
    previewHeight = maxHeight;
    previewWidth = maxHeight * aspectRatio;
  }
  
  // Ensure minimum sizes
  previewWidth = Math.max(20, previewWidth);
  previewHeight = Math.max(20, previewHeight);

  return (
    <div 
      className={cn(
        "flex items-center justify-center w-16 h-14 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 rounded border border-purple-200 dark:border-purple-700",
        className
      )}
    >
      <div
        className="relative bg-gradient-to-br from-sky-200/80 via-sky-100/60 to-white/80 dark:from-sky-400/30 dark:via-sky-300/20 dark:to-white/10 border-2 border-sky-400/60 dark:border-sky-500/50 rounded-sm shadow-inner"
        style={{
          width: `${previewWidth}px`,
          height: `${previewHeight}px`,
        }}
      >
        {/* Glass reflection effect */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-transparent"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
          }}
        />
        {/* Inner border for glass depth */}
        <div className="absolute inset-1 border border-white/30 rounded-sm" />
      </div>
    </div>
  );
}
