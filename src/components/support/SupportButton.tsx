import { useState } from 'react';
import { Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SupportSidebar } from './SupportSidebar';
import { useSupportTickets } from '@/hooks/useSupportTickets';

export function SupportButton() {
  const [open, setOpen] = useState(false);
  const { openTicketsCount } = useSupportTickets();

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
      >
        <Headphones className="h-6 w-6" />
        {openTicketsCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
          >
            {openTicketsCount}
          </Badge>
        )}
      </Button>

      <SupportSidebar open={open} onOpenChange={setOpen} />
    </>
  );
}
