import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, MapPin, User, Phone, Wrench, Ruler, Eye, Trash2, Printer, FileText, AlertTriangle, ExternalLink, Truck, Package, CheckCircle2, ClipboardList } from "lucide-react";
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
  ordem_servico?: {
    id: string;
    os_number: number;
    status: string;
    total_amount: number;
    quote_id: string;
  } | null;
}

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

export function OSCalendarView() {
  const navigate = useNavigate();
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
    ordem_servico_id: "",
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(daysInMonth);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments-calendar", companyId, format(currentDate, "yyyy-MM")],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("service_appointments")
        .select(`*, ordem_servico:ordens_servico(id, os_number, status, total_amount, quote_id)`)
        .eq("company_id", companyId)
        .gte("scheduled_date", format(monthStart, "yyyy-MM-dd"))
        .lte("scheduled_date", format(monthEnd, "yyyy-MM-dd"))
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time_start", { ascending: true });
      
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!companyId,
  });

  const { data: ordensServico = [] } = useQuery({
    queryKey: ["os-for-calendar", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, os_number, customer_name, customer_phone, status")
        .eq("company_id", companyId)
        .in("status", ["pending", "in_progress"])
        .order("os_number", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

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

  const monthStats = {
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending' || a.status === 'scheduled').length,
    completed: appointments.filter(a => a.status === 'completed').length,
  };

  const [conflictWarning, setConflictWarning] = useState<Appointment[]>([]);

  const checkTimeConflict = (newStart: string, newEnd: string, date: string, excludeId?: string): Appointment[] => {
    if (!newStart) return [];
    
    const dayAppointments = appointments.filter(apt => 
      apt.scheduled_date === date && 
      apt.scheduled_time_start && 
      apt.status !== 'cancelled' &&
      apt.id !== excludeId
    );
    
    const conflicts: Appointment[] = [];
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const newStartMinutes = timeToMinutes(newStart);
    const newEndMinutes = newEnd ? timeToMinutes(newEnd) : newStartMinutes + 60;
    
    for (const apt of dayAppointments) {
      const aptStartMinutes = timeToMinutes(apt.scheduled_time_start!);
      const aptEndMinutes = apt.scheduled_time_end 
        ? timeToMinutes(apt.scheduled_time_end) 
        : aptStartMinutes + 60;
      
      if (newStartMinutes < aptEndMinutes && newEndMinutes > aptStartMinutes) {
        conflicts.push(apt);
      }
    }
    
    return conflicts;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.scheduled_time_start) {
      const conflicts = checkTimeConflict(
        formData.scheduled_time_start, 
        formData.scheduled_time_end, 
        formData.scheduled_date
      );
      
      if (conflicts.length > 0) {
        setConflictWarning(conflicts);
        return;
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
        ordem_servico_id: data.ordem_servico_id || null,
        color: appointmentTypeConfig[data.appointment_type]?.color || "#3b82f6",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["today-appointments"] });
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
      queryClient.invalidateQueries({ queryKey: ["appointments-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["today-appointments"] });
      toast.success("Status atualizado!");
      setSelectedAppointment(null);
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
      queryClient.invalidateQueries({ queryKey: ["appointments-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["today-appointments"] });
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
      ordem_servico_id: "",
    });
  };

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter(apt => isSameDay(parseISO(apt.scheduled_date), date));
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setFormData(prev => ({ ...prev, scheduled_date: format(date, "yyyy-MM-dd") }));
  };

  const handleOSSelect = (osId: string) => {
    const os = ordensServico.find(o => o.id === osId);
    if (os) {
      setFormData(prev => ({
        ...prev,
        ordem_servico_id: osId,
        customer_name: os.customer_name,
        customer_phone: os.customer_phone || "",
        title: prev.title || `${appointmentTypeConfig[prev.appointment_type]?.label || "Serviço"} - OS #${os.os_number}`,
      }));
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
          @media print { body { padding: 0; } @page { margin: 1cm; } }
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

  return (
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
                  <div className={cn("text-sm font-medium mb-1", isToday && "text-primary")}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayAppointments.slice(0, 2).map(apt => {
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
              {/* Conflict Warning */}
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
                    <Button type="button" variant="outline" size="sm" onClick={() => setConflictWarning([])}>
                      Ajustar Horário
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={confirmCreateWithConflict} disabled={createMutation.isPending}>
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
                  <Select value={formData.appointment_type} onValueChange={(v) => setFormData(prev => ({ ...prev, appointment_type: v }))}>
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
                      setConflictWarning([]);
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
                      setConflictWarning([]);
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
                      setConflictWarning([]);
                    }}
                  />
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-1">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Vincular Ordem de Serviço
                </Label>
                <Select value={formData.ordem_servico_id} onValueChange={handleOSSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma OS..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ordensServico.map(os => (
                      <SelectItem key={os.id} value={os.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">OS #{os.os_number}</span>
                          <span className="text-muted-foreground">-</span>
                          <span className="truncate">{os.customer_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  const config = appointmentTypeConfig[apt.appointment_type];
                  const Icon = config?.icon || Package;
                  return (
                    <div
                      key={apt.id}
                      onClick={() => setSelectedAppointment(apt)}
                      className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: apt.color + "20" }}
                        >
                          <Icon className="h-4 w-4" style={{ color: apt.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{apt.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            {apt.scheduled_time_start && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {apt.scheduled_time_start.slice(0, 5)}
                                {apt.scheduled_time_end && ` - ${apt.scheduled_time_end.slice(0, 5)}`}
                              </span>
                            )}
                          </div>
                          {apt.customer_name && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {apt.customer_name}
                            </p>
                          )}
                          {apt.ordem_servico && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              OS #{apt.ordem_servico.os_number}
                            </Badge>
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

        {/* Month Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumo do Mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{monthStats.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pendentes</span>
              <span className="font-medium text-amber-500">{monthStats.pending}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Concluídos</span>
              <span className="font-medium text-green-500">{monthStats.completed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appointment Details Dialog */}
      {selectedAppointment && (
        <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: selectedAppointment.color + "20" }}
                >
                  {(() => {
                    const Icon = appointmentTypeConfig[selectedAppointment.appointment_type]?.icon || Package;
                    return <Icon className="h-4 w-4" style={{ color: selectedAppointment.color }} />;
                  })()}
                </div>
                {selectedAppointment.title}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge style={{ backgroundColor: selectedAppointment.color + "20", color: selectedAppointment.color }}>
                  {appointmentTypeConfig[selectedAppointment.appointment_type]?.label}
                </Badge>
                <Badge variant={statusConfig[selectedAppointment.status]?.variant}>
                  {statusConfig[selectedAppointment.status]?.label}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(parseISO(selectedAppointment.scheduled_date), "dd/MM/yyyy")}</span>
                  {selectedAppointment.scheduled_time_start && (
                    <span className="text-muted-foreground">
                      às {selectedAppointment.scheduled_time_start.slice(0, 5)}
                      {selectedAppointment.scheduled_time_end && ` - ${selectedAppointment.scheduled_time_end.slice(0, 5)}`}
                    </span>
                  )}
                </div>
                
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

                {selectedAppointment.ordem_servico && (
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => navigate(`/ordens-servico/${selectedAppointment.ordem_servico!.id}`)}
                    >
                      OS #{selectedAppointment.ordem_servico.os_number}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}
              </div>

              {selectedAppointment.notes && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm">{selectedAppointment.notes}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {selectedAppointment.status !== 'completed' && selectedAppointment.status !== 'cancelled' && (
                  <Button
                    size="sm"
                    onClick={() => updateStatusMutation.mutate({ id: selectedAppointment.id, status: 'completed' })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Concluir
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(selectedAppointment.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
