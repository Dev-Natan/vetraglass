import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Ruler, Plus, Search, MapPin, User, Calendar, FileText, 
  CheckSquare, Trash2, ClipboardList, HardHat, 
  CheckCircle2, Clock, AlertCircle, Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteMeasurement {
  id: string;
  measurement_number: number;
  status: string;
  measured_by_name: string | null;
  measured_at: string | null;
  location_name: string | null;
  location_address: string | null;
  room_name: string | null;
  notes: string | null;
  observations: string | null;
  client_id: string | null;
  clients?: { name: string } | null;
  created_at: string;
}

interface MeasurementItem {
  id: string;
  measurement_id: string;
  item_name: string;
  item_type: string;
  room: string | null;
  position: string | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  vao_largura: number | null;
  vao_altura: number | null;
  peitoril: number | null;
  suggested_product: string | null;
  notes: string | null;
  quantity: number;
  sort_order: number;
}

interface ChecklistItem {
  id: string;
  measurement_id: string;
  item_label: string;
  is_checked: boolean;
  notes: string | null;
  sort_order: number;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; color: string }> = {
  draft: { label: "Rascunho", variant: "secondary", icon: <Clock className="h-4 w-4" />, color: "text-amber-600" },
  completed: { label: "Concluída", variant: "default", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-blue-600" },
  approved: { label: "Aprovada", variant: "outline", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600" },
  rejected: { label: "Rejeitada", variant: "destructive", icon: <AlertCircle className="h-4 w-4" />, color: "text-destructive" },
};

const itemTypeConfig: Record<string, { label: string; icon: string }> = {
  janelas: { label: "Janela", icon: "🪟" },
  portas: { label: "Porta", icon: "🚪" },
  box: { label: "Box", icon: "🚿" },
  espelhos: { label: "Espelho", icon: "🪞" },
  'maxim-ar': { label: "Maxim-Ar", icon: "🪟" },
  'guarda-corpo': { label: "Guarda Corpo", icon: "🛡️" },
  fachadas: { label: "Fachada", icon: "🏢" },
  portao: { label: "Portão", icon: "🚪" },
  basculante: { label: "Basculante", icon: "🪟" },
  corrimao: { label: "Corrimão", icon: "🛡️" },
  other: { label: "Outro", icon: "📦" },
};

const defaultChecklist = [
  "Verificar nível do vão",
  "Verificar prumo das paredes",
  "Confirmar medidas do vão",
  "Verificar acabamento da parede",
  "Confirmar tipo de fixação",
  "Verificar instalação elétrica próxima",
  "Confirmar cor e modelo com cliente",
  "Tirar fotos do local",
];

export default function Medicoes() {
  const { currentCompany, user, profile } = useAuth();
  const companyId = currentCompany?.id;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedMeasurement, setSelectedMeasurement] = useState<SiteMeasurement | null>(null);

  const [formData, setFormData] = useState({
    location_name: "",
    location_address: "",
    notes: "",
    client_id: "",
    technician_id: "",
    technician_name: "",
  });

  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ["site-measurements", companyId, statusFilter],
    queryFn: async () => {
      if (!companyId) return [];
      let query = supabase
        .from("site_measurements")
        .select("*, clients(name)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SiteMeasurement[];
    },
    enabled: !!companyId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-simple", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, address")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-technicians", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, specialty, role")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: measurementItems = [] } = useQuery({
    queryKey: ["measurement-items", selectedMeasurement?.id],
    queryFn: async () => {
      if (!selectedMeasurement?.id) return [];
      const { data, error } = await supabase
        .from("measurement_items")
        .select("*")
        .eq("measurement_id", selectedMeasurement.id)
        .order("sort_order");
      if (error) throw error;
      return data as MeasurementItem[];
    },
    enabled: !!selectedMeasurement?.id,
  });

  const { data: checklist = [] } = useQuery({
    queryKey: ["measurement-checklist", selectedMeasurement?.id],
    queryFn: async () => {
      if (!selectedMeasurement?.id) return [];
      const { data, error } = await supabase
        .from("measurement_checklist")
        .select("*")
        .eq("measurement_id", selectedMeasurement.id)
        .order("sort_order");
      if (error) throw error;
      return data as ChecklistItem[];
    },
    enabled: !!selectedMeasurement?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!companyId || !user) throw new Error("Não autenticado");
      
      const technicianName = data.technician_name || profile?.full_name || user.email;
      
      const { data: measurement, error } = await supabase
        .from("site_measurements")
        .insert({
          company_id: companyId,
          location_name: data.location_name || null,
          location_address: data.location_address || null,
          notes: data.notes || null,
          client_id: data.client_id || null,
          measured_by: user.id,
          measured_by_name: technicianName,
        })
        .select()
        .single();

      if (error) throw error;

      const checklistItems = defaultChecklist.map((label, index) => ({
        measurement_id: measurement.id,
        item_label: label,
        is_checked: false,
        sort_order: index,
      }));

      await supabase.from("measurement_checklist").insert(checklistItems);

      return measurement;
    },
    onSuccess: (measurement) => {
      queryClient.invalidateQueries({ queryKey: ["site-measurements"] });
      toast.success("Medição criada com sucesso!");
      setIsNewDialogOpen(false);
      setSelectedMeasurement(measurement);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar medição: " + error.message);
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: Partial<MeasurementItem>) => {
      if (!selectedMeasurement) throw new Error("Nenhuma medição selecionada");
      const { error } = await supabase.from("measurement_items").insert({
        measurement_id: selectedMeasurement.id,
        item_name: data.item_name || "Novo item",
        item_type: data.item_type || null,
        room: data.room || null,
        position: data.position || null,
        width: data.width || null,
        height: data.height || null,
        depth: data.depth || null,
        vao_largura: data.vao_largura || null,
        vao_altura: data.vao_altura || null,
        peitoril: data.peitoril || null,
        suggested_product: data.suggested_product || null,
        notes: data.notes || null,
        quantity: data.quantity || 1,
        sort_order: data.sort_order || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-items"] });
      toast.success("Item adicionado!");
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async ({ id, is_checked, notes }: { id: string; is_checked?: boolean; notes?: string }) => {
      const updateData: { is_checked?: boolean; notes?: string } = {};
      if (is_checked !== undefined) updateData.is_checked = is_checked;
      if (notes !== undefined) updateData.notes = notes;
      
      const { error } = await supabase
        .from("measurement_checklist")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-checklist"] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("site_measurements")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-measurements"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("measurement_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-items"] });
      toast.success("Item removido!");
    },
  });

  const resetForm = () => {
    setFormData({
      location_name: "",
      location_address: "",
      notes: "",
      client_id: "",
      technician_id: "",
      technician_name: "",
    });
  };

  const filteredMeasurements = measurements.filter(m => {
    const searchLower = searchTerm.toLowerCase();
    return (
      m.location_name?.toLowerCase().includes(searchLower) ||
      m.location_address?.toLowerCase().includes(searchLower) ||
      m.clients?.name?.toLowerCase().includes(searchLower) ||
      m.measured_by_name?.toLowerCase().includes(searchLower) ||
      m.measurement_number.toString().includes(searchLower)
    );
  });

  const stats = {
    total: measurements.length,
    draft: measurements.filter(m => m.status === "draft").length,
    completed: measurements.filter(m => m.status === "completed").length,
    approved: measurements.filter(m => m.status === "approved").length,
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setFormData(prev => ({
        ...prev,
        client_id: clientId,
        location_address: client.address || prev.location_address,
      }));
    }
  };

  const handleTechnicianSelect = (technicianId: string) => {
    if (technicianId === "me") {
      setFormData(prev => ({
        ...prev,
        technician_id: "",
        technician_name: profile?.full_name || user?.email || "",
      }));
    } else {
      const technician = employees.find(e => e.id === technicianId);
      if (technician) {
        setFormData(prev => ({
          ...prev,
          technician_id: technicianId,
          technician_name: technician.name,
        }));
      }
    }
  };

  const [newItemForm, setNewItemForm] = useState({
    item_name: "",
    item_type: "window",
    room: "",
    width: "",
    height: "",
    vao_largura: "",
    vao_altura: "",
    peitoril: "",
    notes: "",
    quantity: "1",
  });

  const handleAddItem = () => {
    if (!newItemForm.item_name) {
      toast.error("Nome do item é obrigatório");
      return;
    }
    addItemMutation.mutate({
      item_name: newItemForm.item_name,
      item_type: newItemForm.item_type,
      room: newItemForm.room || null,
      width: newItemForm.width ? parseFloat(newItemForm.width) : null,
      height: newItemForm.height ? parseFloat(newItemForm.height) : null,
      vao_largura: newItemForm.vao_largura ? parseFloat(newItemForm.vao_largura) : null,
      vao_altura: newItemForm.vao_altura ? parseFloat(newItemForm.vao_altura) : null,
      peitoril: newItemForm.peitoril ? parseFloat(newItemForm.peitoril) : null,
      notes: newItemForm.notes || null,
      quantity: parseInt(newItemForm.quantity) || 1,
      sort_order: measurementItems.length,
    });
    setNewItemForm({
      item_name: "",
      item_type: "window",
      room: "",
      width: "",
      height: "",
      vao_largura: "",
      vao_altura: "",
      peitoril: "",
      notes: "",
      quantity: "1",
    });
  };

  const checklistProgress = checklist.length > 0 
    ? Math.round((checklist.filter(c => c.is_checked).length / checklist.length) * 100)
    : 0;

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Ruler className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Medições de Obra</h1>
            <p className="text-muted-foreground">
              Registre medições em campo com dimensões, checklist e fotos
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <ClipboardList className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rascunho</p>
                <p className="text-3xl font-bold text-amber-600">{stats.draft}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
                <p className="text-3xl font-bold text-blue-600">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-blue-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aprovadas</p>
                <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - List */}
        <div className="lg:col-span-1 space-y-4">
          {/* New Measurement Button */}
          <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Nova Medição
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ruler className="h-5 w-5 text-primary" />
                  Nova Medição de Obra
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados para iniciar uma nova medição em campo
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(formData);
              }} className="space-y-4 mt-4">
                {/* Cliente */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Cliente
                  </Label>
                  <Select onValueChange={handleClientSelect} value={formData.client_id}>
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

                {/* Técnico Responsável */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <HardHat className="h-4 w-4 text-muted-foreground" />
                    Técnico Responsável
                  </Label>
                  <Select onValueChange={handleTechnicianSelect} value={formData.technician_id || "me"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o técnico..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="me">
                        <span className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Eu ({profile?.full_name || user?.email})
                        </span>
                      </SelectItem>
                      <Separator className="my-1" />
                      {employees.map(employee => (
                        <SelectItem key={employee.id} value={employee.id}>
                          <span className="flex items-center gap-2">
                            <HardHat className="h-4 w-4" />
                            {employee.name}
                            {employee.specialty && (
                              <span className="text-muted-foreground text-xs">
                                ({employee.specialty})
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Local/Obra */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Local/Obra
                  </Label>
                  <Input
                    value={formData.location_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, location_name: e.target.value }))}
                    placeholder="Ex: Apartamento 301, Casa do Sr. João"
                  />
                </div>

                {/* Endereço */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Endereço
                  </Label>
                  <Input
                    value={formData.location_address}
                    onChange={(e) => setFormData(prev => ({ ...prev, location_address: e.target.value }))}
                    placeholder="Rua, número, bairro, cidade"
                  />
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Observações Iniciais
                  </Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Informações importantes sobre a obra..."
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Medição"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Search and Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, local, técnico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="approved">Aprovada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Measurements List */}
          <ScrollArea className="h-[calc(100vh-450px)] pr-4">
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-pulse">
                    <Ruler className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground">Carregando medições...</p>
                  </div>
                </div>
              ) : filteredMeasurements.length === 0 ? (
                <div className="text-center py-12">
                  <Ruler className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground font-medium">Nenhuma medição encontrada</p>
                  <p className="text-sm text-muted-foreground mt-1">Crie sua primeira medição de obra</p>
                </div>
              ) : (
                filteredMeasurements.map(measurement => {
                  const status = statusConfig[measurement.status];
                  return (
                    <Card
                      key={measurement.id}
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30",
                        selectedMeasurement?.id === measurement.id && "ring-2 ring-primary border-primary shadow-md"
                      )}
                      onClick={() => setSelectedMeasurement(measurement)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-primary">#{measurement.measurement_number}</span>
                              <Badge variant={status?.variant || "secondary"} className="text-xs">
                                {status?.label || measurement.status}
                              </Badge>
                            </div>
                            {measurement.location_name && (
                              <p className="text-sm font-medium truncate">
                                {measurement.location_name}
                              </p>
                            )}
                            {measurement.clients?.name && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                                <User className="h-3.5 w-3.5" />
                                <span className="truncate">{measurement.clients.name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              {measurement.measured_by_name && (
                                <div className="flex items-center gap-1">
                                  <HardHat className="h-3 w-3" />
                                  <span>{measurement.measured_by_name}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{format(new Date(measurement.created_at), "dd/MM/yy", { locale: ptBR })}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Column - Detail View */}
        <div className="lg:col-span-2">
          {selectedMeasurement ? (
            <Card className="h-fit">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Ruler className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">
                          Medição #{selectedMeasurement.measurement_number}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {selectedMeasurement.location_name && (
                            <span>{selectedMeasurement.location_name}</span>
                          )}
                          {selectedMeasurement.clients?.name && (
                            <span className="text-muted-foreground"> • {selectedMeasurement.clients.name}</span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={statusConfig[selectedMeasurement.status]?.variant}
                      className="gap-1"
                    >
                      {statusConfig[selectedMeasurement.status]?.icon}
                      {statusConfig[selectedMeasurement.status]?.label}
                    </Badge>
                    {selectedMeasurement.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ 
                          id: selectedMeasurement.id, 
                          status: "completed" 
                        })}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Concluir
                      </Button>
                    )}
                    {selectedMeasurement.status === "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ 
                          id: selectedMeasurement.id, 
                          status: "approved" 
                        })}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="items">
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="items" className="gap-2">
                      <Ruler className="h-4 w-4" />
                      <span className="hidden sm:inline">Itens</span>
                      <Badge variant="secondary" className="ml-1 text-xs">{measurementItems.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="checklist" className="gap-2">
                      <CheckSquare className="h-4 w-4" />
                      <span className="hidden sm:inline">Checklist</span>
                      <Badge variant="secondary" className="ml-1 text-xs">{checklistProgress}%</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">Info</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="items" className="space-y-4 mt-0">
                    {/* Add Item Form */}
                    <Card className="bg-muted/30 border-dashed">
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                          <div className="md:col-span-2">
                            <Label className="text-xs text-muted-foreground">Nome do item *</Label>
                            <Input
                              value={newItemForm.item_name}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, item_name: e.target.value }))}
                              placeholder="Ex: Janela Sala"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Tipo</Label>
                            <Select 
                              value={newItemForm.item_type}
                              onValueChange={(v) => setNewItemForm(prev => ({ ...prev, item_type: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(itemTypeConfig).map(([key, { label, icon }]) => (
                                  <SelectItem key={key} value={key}>
                                    {icon} {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Largura (mm)</Label>
                            <Input
                              type="number"
                              value={newItemForm.width}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, width: e.target.value }))}
                              placeholder="1200"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Altura (mm)</Label>
                            <Input
                              type="number"
                              value={newItemForm.height}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, height: e.target.value }))}
                              placeholder="1500"
                            />
                          </div>
                          <div>
                            <Button onClick={handleAddItem} disabled={addItemMutation.isPending} className="w-full">
                              <Plus className="h-4 w-4 mr-1" />
                              Adicionar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Items List */}
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {measurementItems.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            <Ruler className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                            <p className="font-medium">Nenhum item adicionado</p>
                            <p className="text-sm mt-1">Adicione itens usando o formulário acima</p>
                          </div>
                        ) : (
                          measurementItems.map(item => (
                            <Card key={item.id} className="overflow-hidden">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-lg">
                                        {itemTypeConfig[item.item_type]?.icon || "📦"}
                                      </span>
                                      <span className="font-medium">{item.item_name}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {itemTypeConfig[item.item_type]?.label || item.item_type}
                                      </Badge>
                                      {item.room && (
                                        <span className="text-sm text-muted-foreground">• {item.room}</span>
                                      )}
                                      {item.quantity > 1 && (
                                        <Badge variant="secondary">x{item.quantity}</Badge>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-sm">
                                      {(item.width || item.height) && (
                                        <div className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md">
                                          <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span className="font-medium">
                                            {item.width || "—"} × {item.height || "—"} mm
                                          </span>
                                        </div>
                                      )}
                                      {(item.vao_largura || item.vao_altura) && (
                                        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-md text-blue-700 dark:text-blue-300">
                                          <span className="text-xs">Vão:</span>
                                          <span className="font-medium">
                                            {item.vao_largura || "—"} × {item.vao_altura || "—"} mm
                                          </span>
                                        </div>
                                      )}
                                      {item.peitoril && (
                                        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md text-amber-700 dark:text-amber-300">
                                          <span className="text-xs">Peitoril:</span>
                                          <span className="font-medium">{item.peitoril} mm</span>
                                        </div>
                                      )}
                                    </div>
                                    {item.notes && (
                                      <p className="text-sm text-muted-foreground mt-2 italic">
                                        "{item.notes}"
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => deleteItemMutation.mutate(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="checklist" className="mt-0">
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progresso do Checklist</span>
                        <span className="font-medium">{checklistProgress}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${checklistProgress}%` }}
                        />
                      </div>
                    </div>

                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-2">
                        {checklist.map(item => (
                          <div
                            key={item.id}
                            className={cn(
                              "p-3 rounded-lg border transition-colors",
                              item.is_checked ? "bg-muted/50 border-muted" : "bg-background"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={item.is_checked}
                                onCheckedChange={(checked) => 
                                  updateChecklistMutation.mutate({ id: item.id, is_checked: !!checked })
                                }
                              />
                              <span className={cn(
                                "flex-1 font-medium text-sm",
                                item.is_checked && "line-through text-muted-foreground"
                              )}>
                                {item.item_label}
                              </span>
                            </div>
                            <div className="mt-2 ml-7">
                              <Input
                                placeholder="Adicionar observação..."
                                value={item.notes || ""}
                                onChange={(e) => 
                                  updateChecklistMutation.mutate({ id: item.id, notes: e.target.value })
                                }
                                className="text-sm h-8 bg-background"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="notes" className="mt-0">
                    <div className="space-y-4">
                      {/* Info Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedMeasurement.location_address && (
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-muted rounded-lg">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground font-medium">Endereço</p>
                                  <p className="text-sm mt-0.5">{selectedMeasurement.location_address}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        {selectedMeasurement.measured_by_name && (
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-muted rounded-lg">
                                  <HardHat className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground font-medium">Técnico Responsável</p>
                                  <p className="text-sm mt-0.5">{selectedMeasurement.measured_by_name}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-muted rounded-lg">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground font-medium">Data de Criação</p>
                                <p className="text-sm mt-0.5">
                                  {format(new Date(selectedMeasurement.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        {selectedMeasurement.clients?.name && (
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-muted rounded-lg">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground font-medium">Cliente</p>
                                  <p className="text-sm mt-0.5">{selectedMeasurement.clients.name}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>

                      {/* Notes */}
                      {selectedMeasurement.notes && (
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-muted rounded-lg">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground font-medium mb-2">Observações</p>
                                <p className="text-sm whitespace-pre-wrap">{selectedMeasurement.notes}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <CardContent className="text-center">
                <div className="p-4 bg-muted/50 rounded-full inline-block mb-4">
                  <Ruler className="h-12 w-12 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Selecione uma Medição</h3>
                <p className="text-muted-foreground text-sm">
                  Escolha uma medição da lista ou crie uma nova
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
