import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useItemTypes, useItemTypeMutations, type ItemType } from "@/hooks/useItemTypes";

const COLORS = [
  { value: "gray", label: "Cinza" },
  { value: "blue", label: "Azul" },
  { value: "green", label: "Verde" },
  { value: "amber", label: "Âmbar" },
  { value: "red", label: "Vermelho" },
  { value: "purple", label: "Roxo" },
  { value: "pink", label: "Rosa" },
  { value: "cyan", label: "Ciano" },
  { value: "emerald", label: "Esmeralda" },
  { value: "orange", label: "Laranja" },
];

const UNITS = ["un", "m", "m²", "m³", "kg", "l", "par", "cx", "pç"];

interface ItemTypeBasicEditorProps {
  slug: string;
}

export function ItemTypeBasicEditor({ slug }: ItemTypeBasicEditorProps) {
  const { data: itemTypes, isLoading } = useItemTypes(true);
  const { updateMutation } = useItemTypeMutations();
  const itemType = itemTypes?.find((t) => t.slug === slug);

  const [form, setForm] = useState({
    name: "",
    color: "gray",
    unit_default: "un",
    sort_order: 0,
    is_active: true,
  });

  useEffect(() => {
    if (itemType) {
      setForm({
        name: itemType.name,
        color: itemType.color,
        unit_default: itemType.unit_default,
        sort_order: itemType.sort_order,
        is_active: itemType.is_active,
      });
    }
  }, [itemType]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!itemType) return null;

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: itemType.id, ...form });
      toast.success("Tipo de item atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const dirty =
    itemType.name !== form.name ||
    itemType.color !== form.color ||
    itemType.unit_default !== form.unit_default ||
    itemType.sort_order !== form.sort_order ||
    itemType.is_active !== form.is_active;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações Básicas</CardTitle>
        <CardDescription>Edite nome, cor, unidade padrão e ordem deste tipo de item.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Cor</Label>
            <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLORS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unidade Padrão</Label>
            <Select value={form.unit_default} onValueChange={(v) => setForm({ ...form, unit_default: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ordem de Exibição</Label>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label className="cursor-pointer">{form.is_active ? "Ativo" : "Inativo"}</Label>
          </div>
          <Button onClick={save} disabled={!dirty || updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
