import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Layers, Maximize2 } from 'lucide-react';
import { useOSComposition } from '@/hooks/useOSComposition';

interface Props {
  ordemServicoId: string;
}

export function OSCompositionGlasses({ ordemServicoId }: Props) {
  const { items, glasses, isLoading } = useOSComposition(ordemServicoId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!glasses.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum vidro configurado na composição dos produtos.</p>
        </CardContent>
      </Card>
    );
  }

  // Enrich rows with area (m²) and side context per OS item
  const enriched = glasses
    .map((r) => {
      const areaEach = (r.calculatedWidth / 1000) * (r.calculatedHeight / 1000);
      return { ...r, areaEachM2: areaEach, areaTotalM2: areaEach * r.calculatedQty };
    })
    .filter((r) => r.calculatedWidth > 0 && r.calculatedHeight > 0);

  const totalPanels = enriched.reduce((s, r) => s + r.calculatedQty, 0);
  const totalArea = enriched.reduce((s, r) => s + r.areaTotalM2, 0);

  // Group by product
  const byProduct = enriched.reduce((acc, r) => {
    if (!acc[r.productName]) acc[r.productName] = [];
    acc[r.productName].push(r);
    return acc;
  }, {} as Record<string, typeof enriched>);

  const itemMeta = (name: string) => items.find((i) => i.productName === name);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Vidros da Composição
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{enriched.length}</div>
              <div className="text-sm text-muted-foreground">Tipos de Vidro</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{totalPanels}</div>
              <div className="text-sm text-muted-foreground">Painéis</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{totalArea.toFixed(2)} m²</div>
              <div className="text-sm text-muted-foreground">Área Total</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {Object.entries(byProduct).map(([productName, rows]) => {
        const meta = itemMeta(productName);
        return (
          <Card key={productName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Maximize2 className="w-4 h-4" />
                {productName}
                {meta?.glassThickness && <Badge variant="secondary">{meta.glassThickness}mm</Badge>}
                {meta?.glassColor && <Badge variant="outline">{meta.glassColor}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vidro</TableHead>
                    <TableHead>Lado</TableHead>
                    <TableHead className="text-right">Largura</TableHead>
                    <TableHead className="text-right">Altura</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Área (m²)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{r.itemName}</TableCell>
                      <TableCell>
                        {r.side ? <Badge variant="outline">Lado {r.side}</Badge> : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">{r.calculatedWidth} mm</TableCell>
                      <TableCell className="text-right font-mono">{r.calculatedHeight} mm</TableCell>
                      <TableCell className="text-right">{r.calculatedQty}x</TableCell>
                      <TableCell className="text-right font-mono">{r.areaTotalM2.toFixed(3)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
