import { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSupportTickets, SupportTicket } from '@/hooks/useSupportTickets';
import { AdminTicketList } from '@/components/admin/support/AdminTicketList';
import { AdminTicketView } from '@/components/admin/support/AdminTicketView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Ticket, Clock, CheckCircle, AlertTriangle, Search, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AdminSupport() {
  const { isSaasAdmin } = useAuth();
  const { adminTickets, adminTicketsLoading } = useSupportTickets();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  if (!isSaasAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <p className="text-muted-foreground">Acesso negado</p>
        </div>
      </AdminLayout>
    );
  }

  const selectedTicket = adminTickets.find((t) => t.id === selectedTicketId);

  // Filter tickets based on search and tab
  const filteredTickets = adminTickets.filter((ticket) => {
    const matchesSearch =
      searchQuery === '' ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.company?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticket_number.toString().includes(searchQuery);

    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'open') return matchesSearch && ticket.status === 'open';
    if (activeTab === 'in_progress')
      return matchesSearch && (ticket.status === 'in_progress' || ticket.status === 'waiting');
    if (activeTab === 'resolved')
      return matchesSearch && (ticket.status === 'resolved' || ticket.status === 'closed');
    if (activeTab === 'urgent')
      return matchesSearch && (ticket.priority === 'urgent' || ticket.priority === 'high');

    return matchesSearch;
  });

  // Stats
  const stats = {
    total: adminTickets.length,
    open: adminTickets.filter((t) => t.status === 'open').length,
    inProgress: adminTickets.filter(
      (t) => t.status === 'in_progress' || t.status === 'waiting'
    ).length,
    resolved: adminTickets.filter(
      (t) => t.status === 'resolved' || t.status === 'closed'
    ).length,
    urgent: adminTickets.filter(
      (t) => t.priority === 'urgent' || t.priority === 'high'
    ).length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Suporte</h1>
          <p className="text-muted-foreground">
            Gerencie os tickets de suporte das empresas
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Ticket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.open}</p>
                <p className="text-xs text-muted-foreground">Abertos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.resolved}</p>
                <p className="text-xs text-muted-foreground">Resolvidos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.urgent}</p>
                <p className="text-xs text-muted-foreground">Urgentes</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tickets List */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Tickets</CardTitle>
                {stats.open > 0 && (
                  <Badge variant="destructive">{stats.open} pendentes</Badge>
                )}
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por assunto, empresa ou número..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="mx-6">
                <TabsTrigger value="all" className="text-xs">
                  Todos
                </TabsTrigger>
                <TabsTrigger value="open" className="text-xs">
                  Abertos
                </TabsTrigger>
                <TabsTrigger value="in_progress" className="text-xs">
                  Em andamento
                </TabsTrigger>
                <TabsTrigger value="resolved" className="text-xs">
                  Resolvidos
                </TabsTrigger>
                <TabsTrigger value="urgent" className="text-xs">
                  Urgentes
                </TabsTrigger>
              </TabsList>
              <CardContent className="flex-1 pt-4">
                <ScrollArea className="h-[500px]">
                  {adminTicketsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <TabsContent value={activeTab} className="m-0">
                      <AdminTicketList
                        tickets={filteredTickets}
                        selectedTicketId={selectedTicketId}
                        onSelectTicket={setSelectedTicketId}
                      />
                    </TabsContent>
                  )}
                </ScrollArea>
              </CardContent>
            </Tabs>
          </Card>

          {/* Ticket Detail */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Detalhes do Ticket</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {selectedTicket ? (
                <AdminTicketView
                  ticket={selectedTicket}
                  onClose={() => setSelectedTicketId(null)}
                />
              ) : (
                <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                  <p className="text-sm">Selecione um ticket para ver os detalhes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
