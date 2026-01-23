import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, MapPin, User, Phone, Wrench, Ruler, Eye, Trash2, Printer, FileText, DollarSign, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Appointment {
  id: string;
  title: string;
  description: string | null;
  appointment_type: string;
  status: string;
  scheduled_date: string;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  all_day: boolean;
  client_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  ordem_servico_id: string | null;
  quote_id: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  notes: string | null;
  color: string;
  quote?: {
    id: string;
    quote_number: number;
    customer_name: string;
    final_amount: number;
    status: string;
  } | null;
}

import { Truck, Package, CheckCircle2 } from "lucide-react";

const appointmentTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  medicao: { label: "Medição", icon: Ruler, color: "#10b981" },
  instalacao: { label: "Instalação", icon: Wrench, color: "#3b82f6" },
  manutencao: { label: "Manutenção", icon: Wrench, color: "#f59e0b" },
  visita: { label: "Visita", icon: Eye, color: "#8b5cf6" },
  delivery: { label: "Entrega", icon: Truck, color: "#ec4899" },
  outros: { label: "Outros", icon: Package, color: "#6b7280" },
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon?: React.ElementType }> = {
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  scheduled: { label: "Agendado", variant: "secondary", icon: Calendar },
  in_progress: { label: "Em andamento", variant: "default", icon: Wrench },
  completed: { label: "Concluído", variant: "outline", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export default function Agenda() {
  const { currentCompany, user } = useAuth();
  const companyId = currentCompany?.id;
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    appointment_type: "medicao",
    scheduled_date: "",
    scheduled_time_start: "",
    scheduled_time_end: "",
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    assigned_to_name: "",
    notes: "",
    quote_id: "",
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad days to start from Sunday
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(daysInMonth);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", companyId, format(currentDate, "yyyy-MM")],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("service_appointments")
        .select(`
          *, 
          quote:quotes(id, quote_number, customer_name, final_amount, status),
          ordem_servico:ordens_servico(id, os_number, status, total_amount, quote_id)
        `)
        .eq("company_id", companyId)
        .gte("scheduled_date", format(monthStart, "yyyy-MM-dd"))
        .lte("scheduled_date", format(monthEnd, "yyyy-MM-dd"))
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time_start", { ascending: true });
      
      if (error) throw error;
      
      // Fetch quote items for each appointment that has an OS
      const appointmentsWithItems = await Promise.all(
        (data || []).map(async (apt) => {
          if (apt.ordem_servico?.quote_id) {
            const { data: items } = await supabase
              .from('quote_items')
              .select('description, quantity')
              .eq('quote_id', apt.ordem_servico.quote_id);
            return { ...apt, quote_items: items || [] };
          }
          return { ...apt, quote_items: [] };
        })
      );
      
      return appointmentsWithItems as (Appointment & { 
        ordem_servico?: { id: string; os_number: number; status: string; total_amount: number; quote_id: string } | null;
        quote_items?: { description: string; quantity: number }[];
      })[];
    },
    enabled: !!companyId,
  });

  // Calculate month statistics
  const monthStats = {
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending' || a.status === 'scheduled').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    inProgress: appointments.filter(a => a.status === 'in_progress').length,
    byType: Object.entries(appointmentTypeConfig).map(([key, config]) => ({
      key,
      label: config.label,
      count: appointments.filter(a => a.appointment_type === key).length,
      color: config.color,
    })).filter(t => t.count > 0),
  };

  // Today's appointments
  const todayAppointments = appointments.filter(a => isSameDay(parseISO(a.scheduled_date), new Date()));
  const upcomingAppointments = appointments
    .filter(a => parseISO(a.scheduled_date) >= new Date() && a.status !== 'completed' && a.status !== 'cancelled')
    .slice(0, 5);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-simple", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone, address")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes-for-agenda", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("quotes")
        .select("id, quote_number, customer_name, customer_phone, customer_address, final_amount, status")
        .eq("company_id", companyId)
        .in("status", ["pending", "approved"])
        .order("quote_number", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Function to check for time conflicts
  const checkTimeConflict = (newStart: string, newEnd: string, date: string, excludeId?: string): Appointment[] => {
    if (!newStart) return []; // No conflict check if no start time
    
    const dayAppointments = appointments.filter(apt => 
      apt.scheduled_date === date && 
      apt.scheduled_time_start && 
      apt.status !== 'cancelled' &&
      apt.id !== excludeId
    );
    
    const conflicts: Appointment[] = [];
    const newStartMinutes = timeToMinutes(newStart);
    const newEndMinutes = newEnd ? timeToMinutes(newEnd) : newStartMinutes + 60; // Default 1h duration
    
    for (const apt of dayAppointments) {
      const aptStartMinutes = timeToMinutes(apt.scheduled_time_start!);
      const aptEndMinutes = apt.scheduled_time_end 
        ? timeToMinutes(apt.scheduled_time_end) 
        : aptStartMinutes + 60;
      
      // Check for overlap: new appointment starts before existing ends AND new appointment ends after existing starts
      if (newStartMinutes < aptEndMinutes && newEndMinutes > aptStartMinutes) {
        conflicts.push(apt);
      }
    }
    
    return conflicts;
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const [conflictWarning, setConflictWarning] = useState<Appointment[]>([]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for conflicts before creating
    if (formData.scheduled_time_start) {
      const conflicts = checkTimeConflict(
        formData.scheduled_time_start, 
        formData.scheduled_time_end, 
        formData.scheduled_date
      );
      
      if (conflicts.length > 0) {
        setConflictWarning(conflicts);
        return; // Don't submit, show warning
      }
    }
    
    createMutation.mutate(formData);
  };

  const confirmCreateWithConflict = () => {
    setConflictWarning([]);
    createMutation.mutate(formData);
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!companyId || !user) throw new Error("Não autenticado");
      const { error } = await supabase.from("service_appointments").insert({
        company_id: companyId,
        title: data.title,
        description: data.description || null,
        appointment_type: data.appointment_type,
        scheduled_date: data.scheduled_date,
        scheduled_time_start: data.scheduled_time_start || null,
        scheduled_time_end: data.scheduled_time_end || null,
        customer_name: data.customer_name || null,
        customer_phone: data.customer_phone || null,
        customer_address: data.customer_address || null,
        assigned_to_name: data.assigned_to_name || null,
        notes: data.notes || null,
        quote_id: data.quote_id || null,
        color: appointmentTypeConfig[data.appointment_type]?.color || "#3b82f6",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento criado com sucesso!");
      setIsDialogOpen(false);
      setConflictWarning([]);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar agendamento: " + error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("service_appointments")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_appointments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento removido!");
      setSelectedAppointment(null);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      appointment_type: "medicao",
      scheduled_date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
      scheduled_time_start: "",
      scheduled_time_end: "",
      customer_name: "",
      customer_phone: "",
      customer_address: "",
      assigned_to_name: "",
      notes: "",
      quote_id: "",
    });
  };

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter(apt => 
      isSameDay(parseISO(apt.scheduled_date), date)
    );
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setFormData(prev => ({ ...prev, scheduled_date: format(date, "yyyy-MM-dd") }));
  };

  const handlePrintAgenda = () => {
    const monthName = format(currentDate, "MMMM yyyy", { locale: ptBR });
    const sortedAppointments = [...appointments].sort((a, b) => {
      const dateCompare = a.scheduled_date.localeCompare(b.scheduled_date);
      if (dateCompare !== 0) return dateCompare;
      return (a.scheduled_time_start || "").localeCompare(b.scheduled_time_start || "");
    });

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Agenda - ${monthName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { text-align: center; margin-bottom: 5px; }
          .subtitle { text-align: center; color: #666; margin-bottom: 30px; }
          .company { text-align: center; font-weight: bold; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .type-badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; display: inline-block; }
          .status-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; background: #eee; }
          .info-row { font-size: 12px; color: #666; margin-top: 4px; }
          @media print { 
            body { padding: 0; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        <h1>Agenda de Serviços</h1>
        <p class="subtitle">${monthName}</p>
        ${currentCompany ? `<p class="company">${currentCompany.name}</p>` : ''}
        
        ${sortedAppointments.length === 0 ? '<p style="text-align: center;">Nenhum agendamento para este mês.</p>' : `
        <table>
          <thead>
            <tr>
              <th style="width: 100px;">Data</th>
              <th style="width: 80px;">Horário</th>
              <th>Título / Cliente</th>
              <th style="width: 100px;">Tipo</th>
              <th style="width: 90px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${sortedAppointments.map(apt => {
              const typeConfig = appointmentTypeConfig[apt.appointment_type];
              const statusCfg = statusConfig[apt.status];
              return `
                <tr>
                  <td>${format(parseISO(apt.scheduled_date), "dd/MM/yyyy")}</td>
                  <td>${apt.scheduled_time_start ? apt.scheduled_time_start.slice(0, 5) : 'Dia todo'}${apt.scheduled_time_end ? ' - ' + apt.scheduled_time_end.slice(0, 5) : ''}</td>
                  <td>
                    <strong>${apt.title}</strong>
                    ${apt.customer_name ? `<div class="info-row">👤 ${apt.customer_name}</div>` : ''}
                    ${apt.customer_phone ? `<div class="info-row">📞 ${apt.customer_phone}</div>` : ''}
                    ${apt.customer_address ? `<div class="info-row">📍 ${apt.customer_address}</div>` : ''}
                    ${apt.assigned_to_name ? `<div class="info-row">🔧 ${apt.assigned_to_name}</div>` : ''}
                    ${apt.notes ? `<div class="info-row">📝 ${apt.notes}</div>` : ''}
                  </td>
                  <td><span class="type-badge" style="background-color: ${typeConfig?.color}20; color: ${typeConfig?.color}">${typeConfig?.label || apt.appointment_type}</span></td>
                  <td><span class="status-badge">${statusCfg?.label || apt.status}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        `}
        
        <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
          Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
        </p>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setFormData(prev => ({
        ...prev,
        customer_name: client.name,
        customer_phone: client.phone || "",
        customer_address: client.address || "",
      }));
    }
  };

  const handleQuoteSelect = (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (quote) {
      setFormData(prev => ({
        ...prev,
        quote_id: quoteId,
        customer_name: quote.customer_name,
        customer_phone: quote.customer_phone || "",
        customer_address: quote.customer_address || "",
        title: prev.title || `${appointmentTypeConfig[prev.appointment_type]?.label || "Serviço"} - Orç. #${quote.quote_number}`,
      }));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Agenda de Serviços</h1>
        <p className="text-muted-foreground">Gerencie agendamentos de medições, instalações e visitas</p>
      </div>

      {/* Month Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total do Mês</p>
                <p className="text-2xl font-bold">{monthStats.total}</p>
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
                <p className="text-2xl font-bold">{monthStats.pending}</p>
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
                <p className="text-2xl font-bold">{monthStats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hoje</p>
                <p className="text-2xl font-bold">{todayAppointments.length}</p>
              </div>
              <Wrench className="h-8 w-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrintAgenda} title="Imprimir agenda">
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {paddedDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="h-24 bg-muted/30 rounded-lg" />;
                }
                
                const dayAppointments = getAppointmentsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "h-24 p-1 rounded-lg border cursor-pointer transition-colors overflow-hidden",
                      isToday && "border-primary bg-primary/5",
                      isSelected && "ring-2 ring-primary",
                      !isToday && !isSelected && "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "text-sm font-medium mb-1",
                      isToday && "text-primary"
                    )}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {dayAppointments.slice(0, 2).map(apt => {
                        const config = appointmentTypeConfig[apt.appointment_type];
                        return (
                          <div
                            key={apt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppointment(apt);
                            }}
                            className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: apt.color + "20", color: apt.color }}
                          >
                            {apt.scheduled_time_start && (
                              <span className="font-medium">{apt.scheduled_time_start.slice(0, 5)} </span>
                            )}
                            {apt.title}
                          </div>
                        );
                      })}
                      {dayAppointments.length > 2 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayAppointments.length - 2} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* New Appointment Button */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" onClick={() => {
                resetForm();
                setIsDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Conflict Warning Alert */}
                {conflictWarning.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 text-destructive font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Conflito de Horário Detectado!
                    </div>
                    <p className="text-sm text-muted-foreground">
                      O horário selecionado conflita com {conflictWarning.length} agendamento(s):
                    </p>
                    <ul className="text-sm space-y-1">
                      {conflictWarning.map(apt => (
                        <li key={apt.id} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: apt.color }} />
                          <span className="font-medium">{apt.title}</span>
                          <span className="text-muted-foreground">
                            ({apt.scheduled_time_start?.slice(0, 5)}
                            {apt.scheduled_time_end && ` - ${apt.scheduled_time_end.slice(0, 5)}`})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2 pt-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => setConflictWarning([])}
                      >
                        Ajustar Horário
                      </Button>
                      <Button 
                        type="button" 
                        variant="destructive" 
                        size="sm"
                        onClick={confirmCreateWithConflict}
                        disabled={createMutation.isPending}
                      >
                        Criar Mesmo Assim
                      </Button>
                    </div>
                  </div>
                )}
                <div>
                  <Label>Título *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Medição apartamento 301"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo *</Label>
                    <Select
                      value={formData.appointment_type}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, appointment_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(appointmentTypeConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <config.icon className="h-4 w-4" style={{ color: config.color }} />
                              {config.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data *</Label>
                    <Input
                      type="date"
                      value={formData.scheduled_date}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, scheduled_date: e.target.value }));
                        setConflictWarning([]); // Clear warning when date changes
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Hora início</Label>
                    <Input
                      type="time"
                      value={formData.scheduled_time_start}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, scheduled_time_start: e.target.value }));
                        setConflictWarning([]); // Clear warning when time changes
                      }}
                    />
                  </div>
                  <div>
                    <Label>Hora fim</Label>
                    <Input
                      type="time"
                      value={formData.scheduled_time_end}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, scheduled_time_end: e.target.value }));
                        setConflictWarning([]); // Clear warning when time changes
                      }}
                    />
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    Vincular Orçamento
                  </Label>
                  <Select value={formData.quote_id} onValueChange={handleQuoteSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um orçamento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {quotes.map(quote => (
                        <SelectItem key={quote.id} value={quote.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{quote.quote_number}</span>
                            <span className="text-muted-foreground">-</span>
                            <span className="truncate">{quote.customer_name}</span>
                            <span className="text-muted-foreground">({formatCurrency(quote.final_amount)})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vincule para saber a data de conclusão do serviço
                  </p>
                </div>

                <div>
                  <Label>Cliente cadastrado</Label>
                  <Select onValueChange={handleClientSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Nome do cliente</Label>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Nome do cliente"
                  />
                </div>

                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={formData.customer_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <Label>Endereço</Label>
                  <Input
                    value={formData.customer_address}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_address: e.target.value }))}
                    placeholder="Endereço completo"
                  />
                </div>

                <div>
                  <Label>Responsável</Label>
                  <Input
                    value={formData.assigned_to_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, assigned_to_name: e.target.value }))}
                    placeholder="Nome do técnico/responsável"
                  />
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Observações adicionais..."
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Criar Agendamento"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Selected Day Appointments */}
          {selectedDate && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {getAppointmentsForDay(selectedDate).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum agendamento para este dia
                  </p>
                ) : (
                  getAppointmentsForDay(selectedDate).map(apt => {
                    const typeConfig = appointmentTypeConfig[apt.appointment_type];
                    const status = statusConfig[apt.status];
                    const hasOS = !!(apt as any).ordem_servico;
                    return (
                      <div
                        key={apt.id}
                        onClick={() => setSelectedAppointment(apt)}
                        className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {typeConfig && (
                                <typeConfig.icon className="h-4 w-4 flex-shrink-0" style={{ color: typeConfig.color }} />
                              )}
                              <span className="font-medium truncate">{apt.title}</span>
                            </div>
                            {apt.all_day ? (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3" />
                                Dia inteiro
                              </div>
                            ) : apt.scheduled_time_start && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <Clock className="h-3 w-3" />
                                {apt.scheduled_time_start.slice(0, 5)}
                                {apt.scheduled_time_end && ` - ${apt.scheduled_time_end.slice(0, 5)}`}
                              </div>
                            )}
                            {apt.customer_name && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <User className="h-3 w-3" />
                                {apt.customer_name}
                              </div>
                            )}
                            {apt.customer_address && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{apt.customer_address}</span>
                              </div>
                            )}
                            {hasOS && (
                              <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                                <Package className="h-3 w-3" />
                                OS #{(apt as any).ordem_servico.os_number}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={status?.variant || "secondary"} className="text-xs">
                              {status?.label || apt.status}
                            </Badge>
                            {apt.quote && (
                              <span className="text-xs text-muted-foreground">
                                Orç #{apt.quote.quote_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}

          {/* Type Distribution */}
          {monthStats.byType.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribuição por Tipo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {monthStats.byType.map(type => (
                  <div key={type.key} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                      <span>{type.label}</span>
                    </div>
                    <span className="font-medium">{type.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Appointments */}
          {upcomingAppointments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Próximos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingAppointments.map(apt => {
                  const typeConfig = appointmentTypeConfig[apt.appointment_type];
                  return (
                    <div
                      key={apt.id}
                      onClick={() => setSelectedAppointment(apt)}
                      className="p-2 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {typeConfig && (
                          <typeConfig.icon className="h-3 w-3 flex-shrink-0" style={{ color: typeConfig.color }} />
                        )}
                        <span className="font-medium truncate flex-1">{apt.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{format(parseISO(apt.scheduled_date), "dd/MM")}</span>
                        {apt.scheduled_time_start && (
                          <span>às {apt.scheduled_time_start.slice(0, 5)}</span>
                        )}
                        {apt.customer_name && (
                          <span className="truncate">• {apt.customer_name}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Type Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Legenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(appointmentTypeConfig).map(([key, config]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                  <config.icon className="h-4 w-4" style={{ color: config.color }} />
                  <span>{config.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Appointment Details Dialog */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAppointment && appointmentTypeConfig[selectedAppointment.appointment_type] && (
                <>
                  {(() => {
                    const Icon = appointmentTypeConfig[selectedAppointment.appointment_type].icon;
                    return <Icon className="h-5 w-5" style={{ color: appointmentTypeConfig[selectedAppointment.appointment_type].color }} />;
                  })()}
                </>
              )}
              {selectedAppointment?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={statusConfig[selectedAppointment.status]?.variant || "secondary"}>
                  {statusConfig[selectedAppointment.status]?.label || selectedAppointment.status}
                </Badge>
                <Badge variant="outline">
                  {appointmentTypeConfig[selectedAppointment.appointment_type]?.label || selectedAppointment.appointment_type}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(parseISO(selectedAppointment.scheduled_date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                </div>
                {selectedAppointment.scheduled_time_start && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {selectedAppointment.scheduled_time_start.slice(0, 5)}
                      {selectedAppointment.scheduled_time_end && ` - ${selectedAppointment.scheduled_time_end.slice(0, 5)}`}
                    </span>
                  </div>
                )}
                {selectedAppointment.customer_name && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedAppointment.customer_name}</span>
                  </div>
                )}
                {selectedAppointment.customer_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedAppointment.customer_phone}</span>
                  </div>
                )}
                {selectedAppointment.customer_address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedAppointment.customer_address}</span>
                  </div>
                )}
                {selectedAppointment.assigned_to_name && (
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <span>Responsável: {selectedAppointment.assigned_to_name}</span>
                  </div>
                )}
              </div>

              {/* OS Information */}
              {(selectedAppointment as any).ordem_servico && (
                <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-sm">Ordem de Serviço Vinculada</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Número:</span>
                      <span className="font-medium">OS #{(selectedAppointment as any).ordem_servico.os_number}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status OS:</span>
                      <Badge variant="outline" className="text-xs">
                        {(selectedAppointment as any).ordem_servico.status}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Products/Services */}
                  {(selectedAppointment as any).quote_items?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-500/20">
                      <p className="text-xs text-muted-foreground mb-2">Serviços/Produtos:</p>
                      <div className="space-y-1">
                        {(selectedAppointment as any).quote_items.map((item: { description: string; quantity: number }, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <span className="text-blue-500">•</span>
                            <span className="flex-1">{item.description}</span>
                            <span className="text-muted-foreground text-xs">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedAppointment.quote && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Orçamento Vinculado</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Número:</span>
                      <span className="font-medium">#{selectedAppointment.quote.quote_number}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cliente:</span>
                      <span>{selectedAppointment.quote.customer_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Valor:</span>
                      <span className="font-medium text-primary flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(selectedAppointment.quote.final_amount)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedAppointment.notes && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Observações:</p>
                  <p className="text-sm text-muted-foreground">{selectedAppointment.notes}</p>
                </div>
              )}

              {selectedAppointment.all_day && (
                <div className="text-xs text-muted-foreground italic">
                  ⏰ Dia inteiro
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {selectedAppointment.status === "scheduled" && (
                  <Button
                    size="sm"
                    onClick={() => updateStatusMutation.mutate({ id: selectedAppointment.id, status: "in_progress" })}
                  >
                    Iniciar
                  </Button>
                )}
                {selectedAppointment.status === "in_progress" && (
                  <Button
                    size="sm"
                    onClick={() => updateStatusMutation.mutate({ id: selectedAppointment.id, status: "completed" })}
                  >
                    Concluir
                  </Button>
                )}
                {selectedAppointment.status !== "cancelled" && selectedAppointment.status !== "completed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatusMutation.mutate({ id: selectedAppointment.id, status: "cancelled" })}
                  >
                    Cancelar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(selectedAppointment.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
