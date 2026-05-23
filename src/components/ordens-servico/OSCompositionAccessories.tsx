import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wrench, Package } from 'lucide-react';
import { evaluateFormula } from '@/utils/safeFormulaEvaluator';

interface Props {
  ordemServicoId: string;
}

interface AccessoryRow {
  productName: string;
  itemName: string;
  type: string;
  unit: string;
  quantity: number;
  side?: string;
  formula?: string;
}

export function OSCompositionAccessories({ ordemServicoId }: Props) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['os-composition-accessories', ordemServicoId],
    queryFn: async (): Promise<AccessoryRow[]> => {
      const { data: osItems } = await supabase
        .from('os_items')
        .select('*')
        .eq('os_id', ordemServicoId);

      if (!osItems?.length) return [];

      const result: AccessoryRow[] = [];

      for (const item of osItems as any[]) {
        if (!item.product_id) continue;

        const { data: product } = await supabase
          .from('product_templates')
          .select('has_multiple_sides')
          .eq('id', item.product_id)
          .maybeSingle();

        const { data: composition } = await supabase
          .from('product_template_items')
          .select(`
            quantity_formula, pieces_quantity, side, applies_to, calculation_type,
            item_template:item_templates!inner(name, type, unit)
          `)
          .eq('product_template_id', item.product_id)
          .is('company_id', null);

        if (!composition) continue;

        const accessories = composition.filter((c: any) => c.item_template?.type === 'accessory');

        const w = Number(item.largura_producao || 0);
        const h = Number(item.altura_producao || 0);
        const wb = Number(item.largura_producao_b || w);
        const hb = Number(item.altura_producao_b || h);
        const qty = item.quantity || 1;

        for (const c of accessories as any[]) {
          const sides: Array<{ label?: string; s: string | null }> = [];
          const appliesTo = c.applies_to || 'side';
          const hasMulti = !!product?.has_multiple_sides;

          if (appliesTo === 'side' && hasMulti) {
            if (c.side === 'B') sides.push({ label: 'B', s: 'B' });
            else if (c.side === 'Ambos') { sides.push({ label: 'A', s: 'A' }); sides.push({ label: 'B', s: 'B' }); }
            else sides.push({ label: 'A', s: 'A' });
          } else {
            sides.push({ s: null });
          }

          for (const sd of sides) {
            const piecesQty = c.pieces_quantity || 1;
            let calc = piecesQty * qty;
            if (c.quantity_formula && c.quantity_formula !== '1') {
              const r = evaluateFormula(c.quantity_formula, { width: w, height: h, widthB: wb, heightB: hb }, undefined, sd.s as any);
              if (r > 0) {
                if (c.item_template.unit === 'm' || c.item_template.unit === 'metros') calc = (r / 1000) * piecesQty * qty;
                else if (c.item_template.unit === 'm²' || c.item_template.unit === 'm2') calc = (r / 1000000) * piecesQty * qty;
                else calc = r * piecesQty * qty;
              }
            }
            if (calc <= 0) continue;
            result.push({
              productName: item.product_name,
              itemName: c.item_template.name,
              type: c.item_template.type,
              unit: c.item_template.unit,
              quantity: Math.round(calc * 1000) / 1000,
              side: sd.label,
              formula: c.quantity_formula,
            });
          }
        }
      }

      return result;
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!rows.length) {
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
  const byProduct = rows.reduce((acc, r) => {
    if (!acc[r.productName]) acc[r.productName] = [];
    acc[r.productName].push(r);
    return acc;
  }, {} as Record<string, AccessoryRow[]>);

  // Consolidated totals
  const consolidated = rows.reduce((acc, r) => {
    const key = `${r.itemName}|${r.unit}`;
    if (!acc[key]) acc[key] = { itemName: r.itemName, unit: r.unit, total: 0 };
    acc[key].total += r.quantity;
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
                    <TableCell className="text-right font-mono">{r.quantity.toFixed(2)}</TableCell>
                    <TableCell>{r.unit}</TableCell>
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
