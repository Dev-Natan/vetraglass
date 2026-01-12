import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2 } from 'lucide-react';
import { useSupportTickets, SupportTicket } from '@/hooks/useSupportTickets';
import { TicketList } from './TicketList';
import { SupportChat } from './SupportChat';
import { NewTicketDialog } from './NewTicketDialog';

interface SupportSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportSidebar({ open, onOpenChange }: SupportSidebarProps) {
  const { tickets, ticketsLoading } = useSupportTickets();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('open');

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  const openTickets = tickets.filter(
    (t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting'
  );
  const closedTickets = tickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  );

  const handleBack = () => {
    setSelectedTicketId(null);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          {selectedTicket ? (
            <SupportChat ticket={selectedTicket} onBack={handleBack} />
          ) : (
            <>
              <SheetHeader className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <SheetTitle>Suporte</SheetTitle>
                  <Button size="sm" onClick={() => setNewTicketOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Ticket
                  </Button>
                </div>
              </SheetHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="mx-4 mt-4">
                  <TabsTrigger value="open" className="flex-1">
                    Abertos ({openTickets.length})
                  </TabsTrigger>
                  <TabsTrigger value="closed" className="flex-1">
                    Fechados ({closedTickets.length})
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 p-4">
                  {ticketsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <TabsContent value="open" className="m-0">
                        <TicketList
                          tickets={openTickets}
                          selectedTicketId={selectedTicketId}
                          onSelectTicket={setSelectedTicketId}
                        />
                      </TabsContent>
                      <TabsContent value="closed" className="m-0">
                        <TicketList
                          tickets={closedTickets}
                          selectedTicketId={selectedTicketId}
                          onSelectTicket={setSelectedTicketId}
                        />
                      </TabsContent>
                    </>
                  )}
                </ScrollArea>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      <NewTicketDialog open={newTicketOpen} onOpenChange={setNewTicketOpen} />
    </>
  );
}
