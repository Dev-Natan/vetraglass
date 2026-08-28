import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { useAdminAluminumColors, type AdminAluminumColor } from "@/hooks/useAdminPricingLists";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function AluminumColorsEditor() {
  const { data, isLoading, upsert } = useAdminAluminumColors();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAluminumColor | null>(null);
  const [form, setForm] = useState({ name: "", code: "", hex_color: "#cccccc", sort_order: 0, is_active: true });

  const openDialog = (item?: AdminAluminumColor) => {
    if (item) {
      setEditing(item);
      setForm({ name: item.name, code: item.slug, hex_color: item.hex_color ?? "#cccccc", sort_order: item.sort_order, is_active: item.is_active });
    } else {
      setEditing(null);
      setForm({ name: "", code: "", hex_color: "#cccccc", sort_order: (data?.length ?? 0) + 1, is_active: true });
    }
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const code = slugify(form.code || form.name);
    if (!code) return;
    await upsert.mutateAsync({
      ...(editing ? { id: editing.id } : {}),
      name: form.name,
      slug: code,
      hex_color: form.hex_color,
      sort_order: form.sort_order,
      is_active: form.is_active,
    });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Cores de Alumínio</CardTitle>
          <CardDescription>Catálogo global. O código é estável; preços e ativações pertencem a cada empresa.</CardDescription>
        </div>
        <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" />Nova Cor</Button>
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
                <TableHead>Código</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((c) => (
                <TableRow key={c.id} className={!c.is_active ? "opacity-50" : ""}>
                  <TableCell className="text-muted-foreground">{c.sort_order}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{c.slug}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: c.hex_color ?? "#ccc" }} />
                      <span className="text-xs font-mono">{c.hex_color}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch checked={c.is_active} onCheckedChange={(v) => upsert.mutate({ id: c.id, is_active: v })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(c)} aria-label={`Editar ${c.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma cor cadastrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Cor" : "Nova Cor"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Código</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex: preto" />
              <p className="mt-1 text-xs text-muted-foreground">Único no catálogo global e preservado nos snapshots históricos.</p>
            </div>
            <div>
              <Label>Cor (Hex)</Label>
              <div className="flex gap-2">
                <Input type="color" value={form.hex_color} onChange={(e) => setForm({ ...form, hex_color: e.target.value })} className="w-20 p-1" />
                <Input value={form.hex_color} onChange={(e) => setForm({ ...form, hex_color: e.target.value })} />
              </div>
            </div>
            <div><Label>Ordem</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Ativo</Label></div>
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
