import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Layers, Maximize2 } from 'lucide-react';
import { evaluateFormula } from '@/utils/safeFormulaEvaluator';

interface Props {
  ordemServicoId: string;
}

interface GlassRow {
  productName: string;
  glassName: string;
  width: number;
  height: number;
  areaM2: number;
  quantity: number;
  side?: string;
  glassType?: string | null;
  glassColor?: string | null;
}

export function OSCompositionGlasses({ ordemServicoId }: Props) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['os-composition-glasses', ordemServicoId],
    queryFn: async (): Promise<GlassRow[]> => {
      // Get OS items with product info
      const { data: osItems } = await supabase
        .from('os_items')
        .select('*, quote_items(glass_thickness, glass_color)')
        .eq('os_id', ordemServicoId);

      if (!osItems?.length) return [];

      const result: GlassRow[] = [];

      for (const item of osItems as any[]) {
        if (!item.product_id) continue;

        const { data: product } = await supabase
          .from('product_templates')
          .select('id, name, linha, has_multiple_sides')
          .eq('id', item.product_id)
          .maybeSingle();

        if (!product) continue;

        const { data: formulas } = await supabase
          .from('glass_line_formulas')
          .select('*')
          .eq('is_active', true)
          .or(`product_template_id.eq.${item.product_id},and(linha.eq.${product.linha || ''},product_template_id.is.null)`)
          .order('panel_index');

        if (!formulas?.length) continue;

        const w = Number(item.largura_producao || 0);
        const h = Number(item.altura_producao || 0);
        const wb = Number(item.largura_producao_b || w);
        const hb = Number(item.altura_producao_b || h);

        for (const f of formulas as any[]) {
          const sides: Array<{ label?: string; s: string | null }> = [];
          if (!product.has_multiple_sides) {
            sides.push({ s: null });
          } else if (f.side === 'A') sides.push({ label: 'A', s: 'A' });
          else if (f.side === 'B') sides.push({ label: 'B', s: 'B' });
          else { sides.push({ label: 'A', s: 'A' }); sides.push({ label: 'B', s: 'B' }); }

          for (const sd of sides) {
            const cw = evaluateFormula(f.width_formula, { width: w, height: h, widthB: wb, heightB: hb }, undefined, sd.s as any);
            const ch = evaluateFormula(f.height_formula, { width: w, height: h, widthB: wb, heightB: hb }, undefined, sd.s as any);
            if (cw <= 0 || ch <= 0) continue;
            const area = (cw / 1000) * (ch / 1000);
            result.push({
              productName: item.product_name,
              glassName: f.formula_name,
              width: cw,
              height: ch,
              areaM2: area * item.quantity,
              quantity: item.quantity,
              side: sd.label,
              glassType: item.quote_items?.glass_thickness,
              glassColor: item.quote_items?.glass_color,
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
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum vidro configurado na composição dos produtos.</p>
        </CardContent>
      </Card>
    );
  }

  const totalArea = rows.reduce((s, r) => s + r.areaM2, 0);
  const totalPanels = rows.reduce((s, r) => s + r.quantity, 0);

  // Group by product
  const byProduct = rows.reduce((acc, r) => {
    if (!acc[r.productName]) acc[r.productName] = [];
    acc[r.productName].push(r);
    return acc;
  }, {} as Record<string, GlassRow[]>);

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
              <div className="text-2xl font-bold text-primary">{rows.length}</div>
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

      {Object.entries(byProduct).map(([productName, items]) => (
        <Card key={productName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Maximize2 className="w-4 h-4" />
              {productName}
              {items[0].glassType && <Badge variant="secondary">{items[0].glassType}</Badge>}
              {items[0].glassColor && <Badge variant="outline">{items[0].glassColor}</Badge>}
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
                {items.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{r.glassName}</TableCell>
                    <TableCell>{r.side ? <Badge variant="outline">Lado {r.side}</Badge> : '-'}</TableCell>
                    <TableCell className="text-right font-mono">{r.width} mm</TableCell>
                    <TableCell className="text-right font-mono">{r.height} mm</TableCell>
                    <TableCell className="text-right">{r.quantity}x</TableCell>
                    <TableCell className="text-right font-mono">{r.areaM2.toFixed(3)}</TableCell>
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
