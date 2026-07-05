import { useState } from 'react';
import { Plus, Pencil, Trash2, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useProductAluminumPrices, ProductAluminumPrice } from '@/hooks/useProductAluminumPrices';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  companyProductId: string;
  productName: string;
}

const SUGGESTED_COLORS = ['Branco', 'Preto', 'Bronze', 'Champagne', 'Fosco', 'Amadeirado', 'Corten', 'Grafite', 'Natural'];

export function ProductAluminumPricesSection({ companyProductId, productName }: Props) {
  const { aluminumPrices, isLoading, addPrice, updatePrice, deletePrice } = useProductAluminumPrices(companyProductId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductAluminumPrice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductAluminumPrice | null>(null);

  const [colorName, setColorName] = useState('');
  const [pricePerSqm, setPricePerSqm] = useState('');
  const [costPerSqm, setCostPerSqm] = useState('');
  const [pricePerMeter, setPricePerMeter] = useState('');
  const [costPerMeter, setCostPerMeter] = useState('');

  const openAdd = () => {
    setEditing(null);
    setColorName('');
    setPricePerSqm('');
    setCostPerSqm('');
    setPricePerMeter('');
    setCostPerMeter('');
    setDialogOpen(true);
  };

  const openEdit = (p: ProductAluminumPrice) => {
    setEditing(p);
    setColorName(p.color_name);
    setPricePerSqm(String(p.price_per_sqm));
    setCostPerSqm(String(p.cost_per_sqm));
    setPricePerMeter(p.price_per_meter != null ? String(p.price_per_meter) : '');
    setCostPerMeter(p.cost_per_meter != null ? String(p.cost_per_meter) : '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!colorName.trim()) return;
    const payload = {
      color_name: colorName.trim(),
      price_per_sqm: parseFloat(pricePerSqm) || 0,
      cost_per_sqm: parseFloat(costPerSqm) || 0,
      price_per_meter: pricePerMeter ? parseFloat(pricePerMeter) : null,
      cost_per_meter: costPerMeter ? parseFloat(costPerMeter) : null,
    };
    if (editing) {
      await updatePrice.mutateAsync({ id: editing.id, ...payload });
    } else {
      await addPrice.mutateAsync({ company_product_id: companyProductId, ...payload });
    }
    setDialogOpen(false);
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      await deletePrice.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const margin = (price: number, cost: number) => cost > 0 ? ((price - cost) / cost) * 100 : 0;

  const existingColors = aluminumPrices.map(p => p.color_name.toLowerCase());
  const suggestions = SUGGESTED_COLORS.filter(c => !existingColors.includes(c.toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Preços por Cor do Acabamento
        </CardTitle>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Cor
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : aluminumPrices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Palette className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Nenhuma cor de acabamento cadastrada</p>
            <p className="text-sm">Adicione cores para definir preços diferenciados por acabamento</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cor</TableHead>
                  <TableHead className="text-right">Preço/m²</TableHead>
                  <TableHead className="text-right">Custo/m²</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aluminumPrices.map((p) => {
                  const m = margin(p.price_per_sqm, p.cost_per_sqm);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.color_name}</TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {formatCurrency(p.price_per_sqm)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(p.cost_per_sqm)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={m >= 30 ? 'default' : m >= 15 ? 'secondary' : 'destructive'}>
                          {m.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cor' : 'Adicionar Cor de Acabamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Cor</Label>
              <Input
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
                placeholder="Ex: Branco, Preto, Bronze"
              />
              {!editing && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {suggestions.map(c => (
                    <Button key={c} variant="outline" size="sm" className="h-6 text-xs" onClick={() => setColorName(c)}>
                      {c}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço/m² (R$)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={pricePerSqm}
                  onChange={(e) => setPricePerSqm(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Custo/m² (R$)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={costPerSqm}
                  onChange={(e) => setCostPerSqm(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço/ml (R$) <span className="text-[10px] text-muted-foreground">opcional</span></Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={pricePerMeter}
                  onChange={(e) => setPricePerMeter(e.target.value)}
                  placeholder="Preço linear real do perfil"
                />
              </div>
              <div className="space-y-2">
                <Label>Custo/ml (R$) <span className="text-[10px] text-muted-foreground">opcional</span></Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={costPerMeter}
                  onChange={(e) => setCostPerMeter(e.target.value)}
                  placeholder="Custo linear real do perfil"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Quando o custo por metro é informado, o cálculo dinâmico usa esse valor no lugar da conversão a partir do m².
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!colorName.trim() || addPrice.isPending || updatePrice.isPending}>
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover o preço da cor "{deleteTarget?.color_name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
