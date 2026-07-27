import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wrench, Package } from 'lucide-react';
import { useOSComposition } from '@/hooks/useOSComposition';

interface Props {
  ordemServicoId: string;
}

export function OSCompositionAccessories({ ordemServicoId }: Props) {
  const { accessories, isLoading } = useOSComposition(ordemServicoId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!accessories.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum acessório configurado na composição dos produtos.</p>
        </CardContent>
      </Card>
    );
  }

  // Group by product
  const byProduct = accessories.reduce((acc, r) => {
    if (!acc[r.productName]) acc[r.productName] = [];
    acc[r.productName].push(r);
    return acc;
  }, {} as Record<string, typeof accessories>);

  // Consolidated totals
  const consolidated = accessories.reduce((acc, r) => {
    const unit = r.unit || 'un';
    const key = `${r.itemName}|${unit}`;
    if (!acc[key]) acc[key] = { itemName: r.itemName, unit, total: 0 };
    acc[key].total += r.calculatedQty;
    return acc;
  }, {} as Record<string, { itemName: string; unit: string; total: number }>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Acessórios Consolidados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qtd Total</TableHead>
                <TableHead>Unidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.values(consolidated).map((c, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{c.itemName}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{c.total.toFixed(2)}</TableCell>
                  <TableCell>{c.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {Object.entries(byProduct).map(([productName, items]) => (
        <Card key={productName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              {productName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acessório</TableHead>
                  <TableHead>Lado</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Unidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{r.itemName}</TableCell>
                    <TableCell>{r.side ? <Badge variant="outline">Lado {r.side}</Badge> : '-'}</TableCell>
                    <TableCell className="text-right font-mono">{r.calculatedQty.toFixed(2)}</TableCell>
                    <TableCell>{r.unit || 'un'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
