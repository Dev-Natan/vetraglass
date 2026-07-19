import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export const colorOptions = [
  { value: "gray", label: "Cinza", class: "bg-gray-500" },
  { value: "blue", label: "Azul", class: "bg-blue-500" },
  { value: "green", label: "Verde", class: "bg-green-500" },
  { value: "cyan", label: "Ciano", class: "bg-cyan-500" },
  { value: "purple", label: "Roxo", class: "bg-purple-500" },
  { value: "orange", label: "Laranja", class: "bg-orange-500" },
  { value: "indigo", label: "Índigo", class: "bg-indigo-500" },
  { value: "rose", label: "Rosa", class: "bg-rose-500" },
  { value: "amber", label: "Âmbar", class: "bg-amber-500" },
  { value: "violet", label: "Violeta", class: "bg-violet-500" },
  { value: "emerald", label: "Esmeralda", class: "bg-emerald-500" },
  { value: "red", label: "Vermelho", class: "bg-red-500" },
];

export const unitOptions = [
  { value: "un", label: "Unidade (un)" },
  { value: "m", label: "Metro (m)" },
  { value: "m²", label: "Metro² (m²)" },
  { value: "kg", label: "Quilograma (kg)" },
  { value: "L", label: "Litro (L)" },
];

export function getColorClass(color: string): string {
  const found = colorOptions.find(c => c.value === color);
  return found?.class ?? "bg-gray-500";
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

interface LinhaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  form: { name: string; description: string; color: string; sort_order: number };
  setForm: (form: { name: string; description: string; color: string; sort_order: number }) => void;
  onSave: () => void;
  isPending: boolean;
}

export function LinhaDialog({
  open,
  onOpenChange,
  isEditing,
  form,
  setForm,
  onSave,
  isPending,
}: LinhaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Linha" : "Nova Linha"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize os dados da linha" : "Adicione uma nova linha de produtos"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="linha-name">Nome</Label>
            <Input
              id="linha-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Linha Suprema"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linha-description">Descrição (opcional)</Label>
            <Input
              id="linha-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Linha premium com acabamento superior"
            />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <Select
              value={form.color}
              onValueChange={(value) => setForm({ ...form, color: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded ${color.class}`} />
                      {color.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="linha-order">Ordem de exibição</Label>
            <Input
              id="linha-order"
              type="number"
              min={1}
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  form: { name: string; color: string; sort_order: number };
  setForm: (form: { name: string; color: string; sort_order: number }) => void;
  onSave: () => void;
  isPending: boolean;
}

export function CategoryDialog({
  open,
  onOpenChange,
  isEditing,
  form,
  setForm,
  onSave,
  isPending,
}: CategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize os dados da categoria" : "Adicione uma nova categoria de produtos"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Nome</Label>
            <Input
              id="category-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Janela"
            />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <Select
              value={form.color}
              onValueChange={(value) => setForm({ ...form, color: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded ${color.class}`} />
                      {color.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-order">Ordem de exibição</Label>
            <Input
              id="category-order"
              type="number"
              min={1}
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ItemTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  form: { name: string; color: string; unit_default: string; sort_order: number };
  setForm: (form: { name: string; color: string; unit_default: string; sort_order: number }) => void;
  onSave: () => void;
  isPending: boolean;
}

export function ItemTypeDialog({
  open,
  onOpenChange,
  isEditing,
  form,
  setForm,
  onSave,
  isPending,
}: ItemTypeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Tipo de Item" : "Novo Tipo de Item"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize os dados do tipo" : "Adicione um novo tipo de item"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="itemtype-name">Nome</Label>
            <Input
              id="itemtype-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Vidro"
            />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <Select
              value={form.color}
              onValueChange={(value) => setForm({ ...form, color: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded ${color.class}`} />
                      {color.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unidade Padrão</Label>
            <Select
              value={form.unit_default}
              onValueChange={(value) => setForm({ ...form, unit_default: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((unit) => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="itemtype-order">Ordem de exibição</Label>
            <Input
              id="itemtype-order"
              type="number"
              min={1}
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

