import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { GlassColorsEditor } from "./GlassColorsEditor";
import { GlassThicknessesEditor } from "./GlassThicknessesEditor";
import { useAllGlassTypes, useGlassTypeMutations, type GlassType } from "@/hooks/useGlassTypes";
import { toast } from "sonner";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function GlassTypesEditor() {
  const { data, isLoading } = useAllGlassTypes();
  const { createMutation, updateMutation, deleteMutation } = useGlassTypeMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GlassType | null>(null);
  const [form, setForm] = useState({ name: "", description: "", sort_order: 0 });

  const openDialog = (item?: GlassType) => {
    if (item) {
      setEditing(item);
      setForm({ name: item.name, description: item.description ?? "", sort_order: item.sort_order });
    } else {
      setEditing(null);
      setForm({ name: "", description: "", sort_order: (data?.length ?? 0) + 1 });
    }
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, name: form.name, description: form.description || null, sort_order: form.sort_order });
        toast.success("Tipo atualizado");
      } else {
        await createMutation.mutateAsync({ slug: slugify(form.name), name: form.name, description: form.description || undefined, sort_order: form.sort_order });
        toast.success("Tipo criado");
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Tipos de Vidro</CardTitle>
          <CardDescription>Temperado, Laminado, Comum, etc.</CardDescription>
        </div>
        <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" />Novo Tipo</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Ordem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow key={t.id} className={!t.is_active ? "opacity-50" : ""}>
                  <TableCell className="text-muted-foreground">{t.sort_order}</TableCell>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.description}</TableCell>
                  <TableCell>
                    <Switch checked={t.is_active} onCheckedChange={(v) => updateMutation.mutate({ id: t.id, is_active: v })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Excluir "${t.name}"?`)) deleteMutation.mutate(t.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum tipo cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Tipo" : "Novo Tipo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Ordem</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function VidrosDetail() {
  return (
    <Tabs defaultValue="types">
      <TabsList className="mb-6">
        <TabsTrigger value="types">Tipos de Vidro</TabsTrigger>
        <TabsTrigger value="thicknesses">Espessuras</TabsTrigger>
        <TabsTrigger value="colors">Cores</TabsTrigger>
      </TabsList>
      <TabsContent value="types"><GlassTypesEditor /></TabsContent>
      <TabsContent value="thicknesses"><GlassThicknessesEditor /></TabsContent>
      <TabsContent value="colors"><GlassColorsEditor /></TabsContent>
    </Tabs>
  );
}
