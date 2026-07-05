import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Grid3x3 } from 'lucide-react';
import { useProductGlassPriceOptions } from '@/hooks/useProductGlassPrices';
import { useProductAluminumPriceOptions } from '@/hooks/useProductAluminumPrices';

interface Props {
  companyProductId: string;
  marginPercent: number;
  /** Custo base fixo por m² adicionado a cada combinação (opcional). */
  baseCostPerSqm?: number;
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/**
 * Fase 4 — Matriz "Por Margem".
 *
 * Mostra o preço final por m² para cada combinação (cor+espessura do vidro) ×
 * (cor do alumínio), usando: preco = (custo_vidro + custo_aluminio + base) × (1 + margem).
 */
export function DynamicPricingMatrix({ companyProductId, marginPercent, baseCostPerSqm = 0 }: Props) {
  const { data: glassOptions = [] } = useProductGlassPriceOptions(companyProductId);
  const { data: aluminumOptions = [] } = useProductAluminumPriceOptions(companyProductId);

  const factor = 1 + (Number(marginPercent) || 0) / 100;

  const columns = useMemo(
    () => (aluminumOptions.length ? aluminumOptions : [{ value: '__none__', label: 'Sem acabamento', costPerSqm: 0 } as any]),
    [aluminumOptions],
  );

  if (!glassOptions.length) {
    return (
      <Card className="p-4 text-xs text-muted-foreground">
        Cadastre preços de vidro para visualizar a matriz "Por Margem".
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Grid3x3 className="w-4 h-4 text-primary" />
        Matriz "Por Margem"
        <Badge variant="secondary" className="ml-auto">margem {Number(marginPercent).toFixed(0)}%</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Preço/m² sugerido = (custo do vidro + custo do alumínio{baseCostPerSqm > 0 ? ' + base' : ''}) × (1 + margem).
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-2 py-1.5 border">Vidro</th>
              {columns.map(col => (
                <th key={col.value} className="text-right px-2 py-1.5 border">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {glassOptions.map(g => (
              <tr key={g.value} className="hover:bg-muted/20">
                <td className="px-2 py-1.5 border">
                  <div className="font-medium">{g.glassColor} • {g.thicknessMm}mm</div>
                  <div className="text-[10px] text-muted-foreground">custo {brl(g.costPerSqm || 0)}/m²</div>
                </td>
                {columns.map(col => {
                  const cost = (g.costPerSqm || 0) + (col.costPerSqm || 0) + baseCostPerSqm;
                  const price = cost * factor;
                  return (
                    <td key={col.value} className="px-2 py-1.5 border text-right">
                      <div className="font-semibold text-primary">{brl(price)}</div>
                      <div className="text-[10px] text-muted-foreground">custo {brl(cost)}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
