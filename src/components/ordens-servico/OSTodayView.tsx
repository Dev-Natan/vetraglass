import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Calendar, Clock, User, Phone, MapPin, AlertTriangle, 
  CheckCircle2, Play, Wrench, Ruler, Eye, Truck, Package, 
  ClipboardList, ChevronRight, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

const appointmentTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  medicao: { label: "Medição", icon: Ruler, color: "#10b981" },
  instalacao: { label: "Instalação", icon: Wrench, color: "#3b82f6" },
  manutencao: { label: "Manutenção", icon: Wrench, color: "#f59e0b" },
  visita: { label: "Visita", icon: Eye, color: "#8b5cf6" },
  delivery: { label: "Entrega", icon: Truck, color: "#ec4899" },
  outros: { label: "Outros", icon: Package, color: "#6b7280" },
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  scheduled: { label: "Agendado", variant: "secondary" },
  in_progress: { label: "Em andamento", variant: "default" },
  completed: { label: "Concluído", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export function OSTodayView() {
  const navigate = useNavigate();
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const queryClient = useQueryClient();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // Today's appointments
  const { data: todayAppointments = [] } = useQuery({
    queryKey: ["today-appointments", companyId, todayStr],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("service_appointments")
        .select(`*, ordem_servico:ordens_servico(id, os_number, status, customer_name)`)
        .eq("company_id", companyId)
        .eq("scheduled_date", todayStr)
        .neq("status", "cancelled")
        .order("scheduled_time_start", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // OS with delivery today or overdue
  const { data: ordensData = { today: [], overdue: [] } } = useQuery({
    queryKey: ["today-os-delivery", companyId, todayStr],
    queryFn: async () => {
      if (!companyId) return { today: [], overdue: [] };
      
      // OS with delivery today
      const { data: todayOS, error: todayError } = await supabase
        .from("ordens_servico")
        .select("id, os_number, customer_name, customer_phone, status, estimated_end, total_amount, paid_amount")
        .eq("company_id", companyId)
        .eq("estimated_end", todayStr)
        .in("status", ["pending", "in_progress"]);
      
      if (todayError) throw todayError;
      
      // Overdue OS
      const { data: overdueOS, error: overdueError } = await supabase
        .from("ordens_servico")
        .select("id, os_number, customer_name, customer_phone, status, estimated_end, total_amount, paid_amount")
        .eq("company_id", companyId)
        .lt("estimated_end", todayStr)
        .in("status", ["pending", "in_progress"]);
      
      if (overdueError) throw overdueError;
      
      return {
        today: todayOS || [],
        overdue: overdueOS || [],
      };
    },
    enabled: !!companyId,
  });

  const updateAppointmentStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("service_appointments")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-calendar"] });
      toast.success("Status atualizado!");
    },
  });

  const updateOSStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'in_progress') {
        updates.actual_start = todayStr;
        updates.current_stage = 'Em produção';
      } else if (status === 'completed') {
        updates.actual_end = todayStr;
        updates.current_stage = 'Finalizado';
      }
      
      const { error } = await supabase
        .from("ordens_servico")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today-os-delivery"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-servico"] });
      toast.success("Status da OS atualizado!");
    },
  });

  const getDaysOverdue = (estimatedEnd: string) => {
    const estimated = new Date(estimatedEnd);
    const diffTime = today.getTime() - estimated.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const pendingAppointments = todayAppointments.filter(a => a.status === 'pending' || a.status === 'scheduled');
  const completedAppointments = todayAppointments.filter(a => a.status === 'completed');
  const inProgressAppointments = todayAppointments.filter(a => a.status === 'in_progress');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agendamentos</p>
                <p className="text-2xl font-bold">{todayAppointments.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{pendingAppointments.length}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold">{completedAppointments.length}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className={cn(
          "bg-gradient-to-br border",
          ordensData.overdue.length > 0 
            ? "from-red-500/10 to-red-600/5 border-red-200 dark:border-red-900"
            : "from-gray-500/10 to-gray-600/5 border-gray-200 dark:border-gray-800"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">OS Atrasadas</p>
                <p className={cn("text-2xl font-bold", ordensData.overdue.length > 0 && "text-red-500")}>
                  {ordensData.overdue.length}
                </p>
              </div>
              <AlertTriangle className={cn("h-8 w-8 opacity-80", ordensData.overdue.length > 0 ? "text-red-500" : "text-gray-500")} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agenda de Hoje
              <Badge variant="secondary" className="ml-auto">{format(today, "EEEE", { locale: ptBR })}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Nenhum agendamento para hoje</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((apt, index) => {
                  const config = appointmentTypeConfig[apt.appointment_type];
                  const Icon = config?.icon || Package;
                  const isCompleted = apt.status === 'completed';
                  const isInProgress = apt.status === 'in_progress';
                  
                  return (
                    <div
                      key={apt.id}
                      className={cn(
                        "relative p-3 rounded-lg border transition-colors",
                        isCompleted && "bg-green-500/5 border-green-200",
                        isInProgress && "bg-blue-500/5 border-blue-200",
                        !isCompleted && !isInProgress && "hover:bg-muted/50"
                      )}
                    >
                      {/* Timeline connector */}
                      {index < todayAppointments.length - 1 && (
                        <div className="absolute left-7 top-14 bottom-0 w-0.5 bg-border -mb-3" />
                      )}
                      
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 z-10",
                            isCompleted && "bg-green-500/20",
                            isInProgress && "bg-blue-500/20"
                          )}
                          style={{ backgroundColor: !isCompleted && !isInProgress ? config?.color + "20" : undefined }}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <Icon className="h-5 w-5" style={{ color: config?.color }} />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{apt.title}</span>
                            <Badge variant={statusConfig[apt.status]?.variant} className="text-xs">
                              {statusConfig[apt.status]?.label}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            {apt.scheduled_time_start && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {apt.scheduled_time_start.slice(0, 5)}
                                {apt.scheduled_time_end && ` - ${apt.scheduled_time_end.slice(0, 5)}`}
                              </span>
                            )}
                            {apt.customer_name && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {apt.customer_name}
                              </span>
                            )}
                          </div>
                          
                          {apt.ordem_servico && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs mt-1"
                              onClick={() => navigate(`/ordens-servico/${apt.ordem_servico.id}`)}
                            >
                              OS #{apt.ordem_servico.os_number}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          {!isCompleted && !isInProgress && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateAppointmentStatus.mutate({ id: apt.id, status: 'in_progress' })}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                          {(apt.status === 'pending' || apt.status === 'scheduled' || apt.status === 'in_progress') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateAppointmentStatus.mutate({ id: apt.id, status: 'completed' })}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Overdue OS Alert */}
          {ordensData.overdue.length > 0 && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                  Ordens de Serviço Atrasadas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ordensData.overdue.map(os => {
                  const daysLate = getDaysOverdue(os.estimated_end);
                  return (
                    <div
                      key={os.id}
                      className="p-3 rounded-lg bg-red-500/5 border border-red-200 dark:border-red-900 cursor-pointer hover:bg-red-500/10 transition-colors"
                      onClick={() => navigate(`/ordens-servico/${os.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                            <ClipboardList className="h-5 w-5 text-red-500" />
                          </div>
                          <div>
                            <p className="font-medium">OS #{os.os_number.toString().padStart(4, '0')}</p>
                            <p className="text-sm text-muted-foreground">{os.customer_name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive">{daysLate} dias atrasada</Badge>
                          <div className="flex gap-1 mt-1">
                            {os.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateOSStatus.mutate({ id: os.id, status: 'in_progress' });
                                }}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Iniciar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* OS with delivery today */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Entregas Previstas para Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordensData.today.length === 0 ? (
                <div className="text-center py-6">
                  <Truck className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma entrega prevista para hoje</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ordensData.today.map(os => (
                    <div
                      key={os.id}
                      className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/ordens-servico/${os.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <ClipboardList className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">OS #{os.os_number.toString().padStart(4, '0')}</p>
                            <p className="text-sm text-muted-foreground">{os.customer_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={os.status === 'in_progress' ? 'default' : 'secondary'}>
                            {os.status === 'in_progress' ? 'Em Andamento' : 'Pendente'}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Total: {formatCurrency(os.total_amount)}</span>
                        <span>Pago: {formatCurrency(os.paid_amount)}</span>
                        {os.total_amount - os.paid_amount > 0 && (
                          <span className="text-amber-500">
                            Pendente: {formatCurrency(os.total_amount - os.paid_amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
