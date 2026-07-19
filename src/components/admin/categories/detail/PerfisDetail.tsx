import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AluminumColorsEditor } from "./AluminumColorsEditor";
import { useProductLinhas, useProductLinhaMutations, type ProductLinha } from "@/hooks/useProductLinhas";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function PerfisDetail() {
  const { data: linhas, isLoading } = useProductLinhas(true);
  const { createMutation, updateMutation, deleteMutation } = useProductLinhaMutations();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductLinha | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color: "gray", sort_order: 0, is_active: true });

  const openDialog = (l?: ProductLinha) => {
    if (l) {
      setEditing(l);
      setForm({ name: l.name, description: l.description ?? "", color: l.color, sort_order: l.sort_order, is_active: l.is_active });
    } else {
      setEditing(null);
      setForm({ name: "", description: "", color: "gray", sort_order: (linhas?.length ?? 0) + 1, is_active: true });
    }
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form, slug: slugify(form.name) });
        toast.success("Linha atualizada");
      } else {
        await createMutation.mutateAsync({
          name: form.name,
          slug: slugify(form.name),
          description: form.description || null,
          image_url: null,
          color: form.color,
          sort_order: form.sort_order,
          is_active: form.is_active,
        });
        toast.success("Linha criada");
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const toggleActive = (l: ProductLinha) => {
    updateMutation.mutate({ id: l.id, is_active: !l.is_active });
  };

  const remove = (l: ProductLinha) => {
    if (!confirm(`Excluir a linha "${l.name}"?`)) return;
    deleteMutation.mutate(l.id, {
      onSuccess: () => toast.success("Linha removida"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
    });
  };

  return (
    <Tabs defaultValue="colors">
      <TabsList className="mb-6">
        <TabsTrigger value="colors">Cores de Alumínio</TabsTrigger>
        <TabsTrigger value="linhas">Linhas Vinculadas</TabsTrigger>
      </TabsList>

      <TabsContent value="colors">
        <AluminumColorsEditor />
      </TabsContent>

      <TabsContent value="linhas">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Linhas de Perfis</CardTitle>
              <CardDescription>Crie, edite e ative linhas. Abra uma linha para gerenciar perfis, preços e estoque.</CardDescription>
            </div>
            <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" />Nova Linha</Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(linhas ?? []).map((l) => (
                  <Card key={l.id} className={`transition ${!l.is_active ? "opacity-60" : ""}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/admin/insumos/linha/${l.slug}`} className="flex-1 min-w-0 group">
                          <div className="font-medium truncate group-hover:text-primary flex items-center gap-1">
                            {l.name}
                            <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          {l.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{l.description}</div>}
                          <div className="text-[10px] font-mono text-muted-foreground mt-1">{l.slug}</div>
                        </Link>
                        <div className="flex flex-col items-end gap-1">
                          <Switch checked={l.is_active} onCheckedChange={() => toggleActive(l)} />
                          <div className="flex">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(l)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(l)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(linhas ?? []).length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">Nenhuma linha cadastrada</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Linha" : "Nova Linha"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Linha Suprema" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>{form.is_active ? "Ativa" : "Inativa"}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
