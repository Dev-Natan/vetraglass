import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, MapPin, User, Phone, Wrench, Ruler, Eye, Trash2 } from "lucide-react";
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
}

const appointmentTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  medicao: { label: "Medição", icon: Ruler, color: "#10b981" },
  instalacao: { label: "Instalação", icon: Wrench, color: "#3b82f6" },
  manutencao: { label: "Manutenção", icon: Wrench, color: "#f59e0b" },
  visita: { label: "Visita", icon: Eye, color: "#8b5cf6" },
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendado", variant: "secondary" },
  in_progress: { label: "Em andamento", variant: "default" },
  completed: { label: "Concluído", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export default function Agenda() {
  const { companyId, user } = useAuth();
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
        .select("*")
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
        color: appointmentTypeConfig[data.appointment_type]?.color || "#3b82f6",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento criado com sucesso!");
      setIsDialogOpen(false);
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

  return (
    <MainLayout 
      title="Agenda de Serviços" 
      description="Gerencie agendamentos de medições, instalações e visitas"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-2">
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
              <form onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(formData);
              }} className="space-y-4">
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
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduled_time_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Hora fim</Label>
                    <Input
                      type="time"
                      value={formData.scheduled_time_end}
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduled_time_end: e.target.value }))}
                    />
                  </div>
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
                            {apt.scheduled_time_start && (
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
                          </div>
                          <Badge variant={status?.variant || "secondary"}>
                            {status?.label || apt.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
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

              {selectedAppointment.notes && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">{selectedAppointment.notes}</p>
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
