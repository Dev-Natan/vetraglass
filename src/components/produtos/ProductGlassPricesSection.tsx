import { useState } from 'react';
import { Plus, Pencil, Trash2, GlassWater } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useProductGlassPrices, ProductGlassPrice } from '@/hooks/useProductGlassPrices';
import { ProductGlassPriceDialog } from './ProductGlassPriceDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface ProductGlassPricesSectionProps {
  companyProductId: string;
  productName: string;
  usesGlass?: boolean;
}

export function ProductGlassPricesSection({
  companyProductId,
  productName,
  usesGlass = true,
}: ProductGlassPricesSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<ProductGlassPrice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priceToDelete, setPriceToDelete] = useState<ProductGlassPrice | null>(null);

  const {
    glassPrices,
    isLoading,
    addGlassPrice,
    updateGlassPrice,
    deleteGlassPrice,
  } = useProductGlassPrices(companyProductId);

  if (!usesGlass) {
    return null;
  }

  const handleAdd = () => {
    setEditingPrice(null);
    setDialogOpen(true);
  };

  const handleEdit = (price: ProductGlassPrice) => {
    setEditingPrice(price);
    setDialogOpen(true);
  };

  const handleDelete = (price: ProductGlassPrice) => {
    setPriceToDelete(price);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (priceToDelete) {
      await deleteGlassPrice.mutateAsync(priceToDelete.id);
      setDeleteDialogOpen(false);
      setPriceToDelete(null);
    }
  };

  const handleSave = async (data: {
    glass_type: string;
    glass_color: string;
    thickness_mm: number;
    price_per_sqm: number;
    cost_per_sqm: number;
  }) => {
    if (editingPrice) {
      await updateGlassPrice.mutateAsync({
        id: editingPrice.id,
        ...data,
      });
    } else {
      await addGlassPrice.mutateAsync({
        company_product_id: companyProductId,
        ...data,
      });
    }
    setDialogOpen(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const calculateMargin = (price: number, cost: number) => {
    if (cost <= 0) return 0;
    return ((price - cost) / cost) * 100;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <GlassWater className="h-5 w-5 text-primary" />
          Preços de Vidro do Produto
        </CardTitle>
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Preço
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : glassPrices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <GlassWater className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Nenhum preço de vidro cadastrado</p>
            <p className="text-sm">Adicione preços para usar este produto em orçamentos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de Vidro</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead className="text-center">Espessura</TableHead>
                  <TableHead className="text-right">Preço/m²</TableHead>
                  <TableHead className="text-right">Custo/m²</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {glassPrices.map((price) => {
                  const margin = calculateMargin(price.price_per_sqm, price.cost_per_sqm);
                  return (
                    <TableRow key={price.id}>
                      <TableCell className="font-medium">{price.glass_type}</TableCell>
                      <TableCell>{price.glass_color}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{price.thickness_mm}mm</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {formatCurrency(price.price_per_sqm)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(price.cost_per_sqm)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={margin >= 30 ? 'default' : margin >= 15 ? 'secondary' : 'destructive'}
                        >
                          {margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(price)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(price)}
                            className="text-destructive hover:text-destructive"
                          >
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

      <ProductGlassPriceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        editingPrice={editingPrice}
        isLoading={addGlassPrice.isPending || updateGlassPrice.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover o preço de vidro "{priceToDelete?.glass_type} {priceToDelete?.glass_color} {priceToDelete?.thickness_mm}mm"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
