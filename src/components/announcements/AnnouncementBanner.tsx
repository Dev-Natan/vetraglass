import { useState } from 'react';
import { X, AlertTriangle, Info, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnnouncements, Announcement } from '@/hooks/useAnnouncements';
import { cn } from '@/lib/utils';

const typeConfig = {
  info: {
    icon: Info,
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    textClass: 'text-blue-600 dark:text-blue-400',
    iconClass: 'text-blue-500',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-yellow-500/10 border-yellow-500/30',
    textClass: 'text-yellow-700 dark:text-yellow-400',
    iconClass: 'text-yellow-500',
  },
  success: {
    icon: CheckCircle,
    bgClass: 'bg-green-500/10 border-green-500/30',
    textClass: 'text-green-600 dark:text-green-400',
    iconClass: 'text-green-500',
  },
  error: {
    icon: XCircle,
    bgClass: 'bg-red-500/10 border-red-500/30',
    textClass: 'text-red-600 dark:text-red-400',
    iconClass: 'text-red-500',
  },
};

function AnnouncementItem({ 
  announcement, 
  onDismiss 
}: { 
  announcement: Announcement; 
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[announcement.type] || typeConfig.info;
  const Icon = config.icon;

  const isLongContent = announcement.content.length > 150;
  const displayContent = isLongContent && !expanded 
    ? announcement.content.slice(0, 150) + '...' 
    : announcement.content;

  return (
    <div className={cn(
      'flex items-start gap-3 p-4 rounded-lg border',
      config.bgClass
    )}>
      <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', config.iconClass)} />
      <div className="flex-1 min-w-0">
        <h4 className={cn('font-semibold text-sm', config.textClass)}>
          {announcement.title}
        </h4>
        <p className={cn('text-sm mt-1 whitespace-pre-wrap', config.textClass, 'opacity-90')}>
          {displayContent}
        </p>
        {isLongContent && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className={cn('p-0 h-auto mt-1', config.textClass)}
          >
            {expanded ? (
              <>Ver menos <ChevronUp className="w-4 h-4 ml-1" /></>
            ) : (
              <>Ver mais <ChevronDown className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDismiss(announcement.id)}
        className={cn('flex-shrink-0 h-8 w-8', config.textClass, 'hover:bg-transparent opacity-60 hover:opacity-100')}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function AnnouncementBanner() {
  const { announcements, dismissAnnouncement } = useAnnouncements();

  if (announcements.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {announcements.map((announcement) => (
        <AnnouncementItem
          key={announcement.id}
          announcement={announcement}
          onDismiss={dismissAnnouncement}
        />
      ))}
    </div>
  );
}
