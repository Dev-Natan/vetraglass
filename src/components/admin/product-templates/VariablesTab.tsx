import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Info, Palette, Layers, Ruler } from 'lucide-react';
import { useGlassColors, useGlassThicknesses } from '@/hooks/useGlassAttributes';

/**
 * Fase 3 — Aba "Variáveis" do template de produto.
 *
 * O template é global (SaaS). Preços dinâmicos (cor/espessura/alumínio)
 * são cadastrados por empresa em `product_glass_prices` e
 * `product_aluminum_prices` após a ativação do template. Aqui mostramos
 * apenas as dimensões (eixos) disponíveis para orientar o cadastro.
 */
export function VariablesTab() {
  const { data: colors = [] } = useGlassColors();
  const { data: thicknesses = [] } = useGlassThicknesses();

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-primary/5 border-primary/20 flex gap-3">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          O custo final é resolvido em tempo real no orçamento a partir das
          variáveis abaixo. Cada empresa cadastra os preços por combinação em
          <strong> Preços do Produto</strong> após ativar o template.
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Palette className="w-4 h-4" /> Cores de vidro
        </div>
        <div className="flex flex-wrap gap-2">
          {colors.length ? colors.map(c => (
            <Badge key={c.id} variant="secondary">{c.name}</Badge>
          )) : <span className="text-xs text-muted-foreground">Nenhuma cor cadastrada.</span>}
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Ruler className="w-4 h-4" /> Espessuras
        </div>
        <div className="flex flex-wrap gap-2">
          {thicknesses.length ? thicknesses.map(t => (
            <Badge key={t.id} variant="secondary">{t.thickness_mm} mm</Badge>
          )) : <span className="text-xs text-muted-foreground">Nenhuma espessura cadastrada.</span>}
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Layers className="w-4 h-4" /> Cores de alumínio
        </div>
        <div className="text-xs text-muted-foreground">
          Definidas por empresa em <strong>Preços do Produto → Acabamentos</strong>.
          A composição usa o valor por m² conforme a cor escolhida no orçamento.
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="text-sm font-semibold">Combinações possíveis</div>
        <div className="text-xs text-muted-foreground">
          {colors.length} cores × {thicknesses.length} espessuras ={' '}
          <strong>{colors.length * thicknesses.length}</strong> variações de vidro por empresa,
          multiplicadas pelas cores de acabamento.
        </div>
      </Card>
    </div>
  );
}
