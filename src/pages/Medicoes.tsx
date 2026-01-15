import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Ruler, Plus, Search, MapPin, User, Calendar, FileText, 
  Camera, CheckSquare, Trash2, Edit, Eye, ChevronDown, ChevronUp 
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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  completed: { label: "Concluída", variant: "default" },
  approved: { label: "Aprovada", variant: "outline" },
  rejected: { label: "Rejeitada", variant: "destructive" },
};

const itemTypeConfig: Record<string, string> = {
  window: "Janela",
  door: "Porta",
  partition: "Divisória",
  mirror: "Espelho",
  shower: "Box",
  other: "Outro",
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
  const { companyId, user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedMeasurement, setSelectedMeasurement] = useState<SiteMeasurement | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    location_name: "",
    location_address: "",
    room_name: "",
    notes: "",
    client_id: "",
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
      
      // Create measurement
      const { data: measurement, error } = await supabase
        .from("site_measurements")
        .insert({
          company_id: companyId,
          location_name: data.location_name || null,
          location_address: data.location_address || null,
          room_name: data.room_name || null,
          notes: data.notes || null,
          client_id: data.client_id || null,
          measured_by: user.id,
          measured_by_name: profile?.full_name || user.email,
        })
        .select()
        .single();

      if (error) throw error;

      // Create default checklist items
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
        ...data,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-items"] });
      toast.success("Item adicionado!");
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async ({ id, is_checked }: { id: string; is_checked: boolean }) => {
      const { error } = await supabase
        .from("measurement_checklist")
        .update({ is_checked })
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
      room_name: "",
      notes: "",
      client_id: "",
    });
  };

  const filteredMeasurements = measurements.filter(m => {
    const searchLower = searchTerm.toLowerCase();
    return (
      m.location_name?.toLowerCase().includes(searchLower) ||
      m.location_address?.toLowerCase().includes(searchLower) ||
      m.clients?.name?.toLowerCase().includes(searchLower) ||
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

  return (
    <MainLayout 
      title="Medições de Obra" 
      description="Registre medições em campo com dimensões, checklist e fotos"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.draft}</div>
            <div className="text-sm text-muted-foreground">Rascunho</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
            <div className="text-sm text-muted-foreground">Concluídas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-sm text-muted-foreground">Aprovadas</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex gap-2">
            <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Medição
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Medição de Obra</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate(formData);
                }} className="space-y-4">
                  <div>
                    <Label>Cliente</Label>
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
                    <Label>Local/Obra</Label>
                    <Input
                      value={formData.location_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, location_name: e.target.value }))}
                      placeholder="Ex: Apartamento 301"
                    />
                  </div>

                  <div>
                    <Label>Endereço</Label>
                    <Input
                      value={formData.location_address}
                      onChange={(e) => setFormData(prev => ({ ...prev, location_address: e.target.value }))}
                      placeholder="Endereço completo"
                    />
                  </div>

                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Observações iniciais..."
                      rows={3}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar Medição"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar medições..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
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

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredMeasurements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma medição encontrada
              </div>
            ) : (
              filteredMeasurements.map(measurement => {
                const status = statusConfig[measurement.status];
                return (
                  <Card
                    key={measurement.id}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-muted/50",
                      selectedMeasurement?.id === measurement.id && "ring-2 ring-primary"
                    )}
                    onClick={() => setSelectedMeasurement(measurement)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Ruler className="h-4 w-4 text-primary" />
                            <span className="font-medium">#{measurement.measurement_number}</span>
                          </div>
                          {measurement.location_name && (
                            <div className="text-sm text-muted-foreground truncate">
                              {measurement.location_name}
                            </div>
                          )}
                          {measurement.clients?.name && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <User className="h-3 w-3" />
                              {measurement.clients.name}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(measurement.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </div>
                        <Badge variant={status?.variant || "secondary"}>
                          {status?.label || measurement.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Detail View */}
        <div className="lg:col-span-2">
          {selectedMeasurement ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Ruler className="h-5 w-5" />
                      Medição #{selectedMeasurement.measurement_number}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground mt-1">
                      {selectedMeasurement.location_name && (
                        <span>{selectedMeasurement.location_name}</span>
                      )}
                      {selectedMeasurement.clients?.name && (
                        <span> • {selectedMeasurement.clients.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusConfig[selectedMeasurement.status]?.variant}>
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
                        Concluir
                      </Button>
                    )}
                    {selectedMeasurement.status === "completed" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ 
                          id: selectedMeasurement.id, 
                          status: "approved" 
                        })}
                      >
                        Aprovar
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="items">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="items" className="flex items-center gap-2">
                      <Ruler className="h-4 w-4" />
                      Itens ({measurementItems.length})
                    </TabsTrigger>
                    <TabsTrigger value="checklist" className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4" />
                      Checklist
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Observações
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="items" className="space-y-4 mt-4">
                    {/* Add Item Form */}
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="col-span-2">
                            <Label>Nome do item *</Label>
                            <Input
                              value={newItemForm.item_name}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, item_name: e.target.value }))}
                              placeholder="Ex: Janela Sala"
                            />
                          </div>
                          <div>
                            <Label>Tipo</Label>
                            <Select
                              value={newItemForm.item_type}
                              onValueChange={(v) => setNewItemForm(prev => ({ ...prev, item_type: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(itemTypeConfig).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Cômodo</Label>
                            <Input
                              value={newItemForm.room}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, room: e.target.value }))}
                              placeholder="Ex: Sala"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                          <div>
                            <Label>Largura (mm)</Label>
                            <Input
                              type="number"
                              value={newItemForm.width}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, width: e.target.value }))}
                              placeholder="1200"
                            />
                          </div>
                          <div>
                            <Label>Altura (mm)</Label>
                            <Input
                              type="number"
                              value={newItemForm.height}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, height: e.target.value }))}
                              placeholder="1500"
                            />
                          </div>
                          <div>
                            <Label>Vão L (mm)</Label>
                            <Input
                              type="number"
                              value={newItemForm.vao_largura}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, vao_largura: e.target.value }))}
                              placeholder="1210"
                            />
                          </div>
                          <div>
                            <Label>Vão A (mm)</Label>
                            <Input
                              type="number"
                              value={newItemForm.vao_altura}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, vao_altura: e.target.value }))}
                              placeholder="1510"
                            />
                          </div>
                          <div>
                            <Label>Peitoril (mm)</Label>
                            <Input
                              type="number"
                              value={newItemForm.peitoril}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, peitoril: e.target.value }))}
                              placeholder="1100"
                            />
                          </div>
                          <div>
                            <Label>Qtd</Label>
                            <Input
                              type="number"
                              value={newItemForm.quantity}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, quantity: e.target.value }))}
                              min="1"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button onClick={handleAddItem} disabled={addItemMutation.isPending}>
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Item
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Items List */}
                    <div className="space-y-2">
                      {measurementItems.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          Nenhum item adicionado ainda
                        </div>
                      ) : (
                        measurementItems.map(item => (
                          <Card key={item.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{item.item_name}</span>
                                    <Badge variant="outline">{itemTypeConfig[item.item_type] || item.item_type}</Badge>
                                    {item.room && <span className="text-sm text-muted-foreground">• {item.room}</span>}
                                    {item.quantity > 1 && <Badge variant="secondary">x{item.quantity}</Badge>}
                                  </div>
                                  <div className="flex flex-wrap gap-4 mt-2 text-sm">
                                    {(item.width || item.height) && (
                                      <div>
                                        <span className="text-muted-foreground">Dimensões: </span>
                                        <span className="font-medium">
                                          {item.width || "—"} x {item.height || "—"} mm
                                        </span>
                                      </div>
                                    )}
                                    {(item.vao_largura || item.vao_altura) && (
                                      <div>
                                        <span className="text-muted-foreground">Vão: </span>
                                        <span className="font-medium">
                                          {item.vao_largura || "—"} x {item.vao_altura || "—"} mm
                                        </span>
                                      </div>
                                    )}
                                    {item.peitoril && (
                                      <div>
                                        <span className="text-muted-foreground">Peitoril: </span>
                                        <span className="font-medium">{item.peitoril} mm</span>
                                      </div>
                                    )}
                                  </div>
                                  {item.notes && (
                                    <div className="text-sm text-muted-foreground mt-2">{item.notes}</div>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteItemMutation.mutate(item.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="checklist" className="space-y-2 mt-4">
                    {checklist.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg border"
                      >
                        <Checkbox
                          checked={item.is_checked}
                          onCheckedChange={(checked) => 
                            updateChecklistMutation.mutate({ id: item.id, is_checked: !!checked })
                          }
                        />
                        <span className={cn(
                          "flex-1",
                          item.is_checked && "line-through text-muted-foreground"
                        )}>
                          {item.item_label}
                        </span>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="notes" className="mt-4">
                    <div className="space-y-4">
                      {selectedMeasurement.location_address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span>{selectedMeasurement.location_address}</span>
                        </div>
                      )}
                      {selectedMeasurement.measured_by_name && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>Medido por: {selectedMeasurement.measured_by_name}</span>
                        </div>
                      )}
                      {selectedMeasurement.notes && (
                        <div className="p-4 bg-muted rounded-lg">
                          <Label className="text-muted-foreground">Observações</Label>
                          <p className="mt-1">{selectedMeasurement.notes}</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Ruler className="h-12 w-12 mb-4" />
                <p>Selecione uma medição para ver os detalhes</p>
                <p className="text-sm">ou crie uma nova medição</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
