import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Info, Palette, Layers, Ruler } from 'lucide-react';
import {
  useAdminGlassColors,
  useAdminGlassThicknesses,
  useAdminAluminumColors,
} from '@/hooks/useAdminPricingLists';

/**
 * Fase 3 — Aba "Variáveis" do template de produto.
 *
 * As opções de cor/espessura/alumínio vêm da lista mestre do SaaS Admin
 * (tabelas admin_*). As empresas ajustam preços por combinação em
 * "Preços do Produto" e caem no preço sugerido do Admin se não cadastrarem.
 */
export function VariablesTab() {
  const { data: colors = [] } = useAdminGlassColors();
  const { data: thicknesses = [] } = useAdminGlassThicknesses();
  const { data: aluColors = [] } = useAdminAluminumColors();

  const activeColors = colors.filter(c => c.is_active);
  const activeThicks = thicknesses.filter(t => t.is_active);
  const activeAlu = aluColors.filter(a => a.is_active);

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-primary/5 border-primary/20 flex gap-3">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          O custo final é resolvido em tempo real no orçamento. As opções abaixo
          vêm de <strong>Admin → Linhas</strong>. Cada empresa cadastra
          o próprio preço por combinação em <strong>Preços do Produto</strong>
          (com fallback para o preço sugerido).
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Palette className="w-4 h-4" /> Cores de vidro
        </div>
        <div className="flex flex-wrap gap-2">
          {activeColors.length ? activeColors.map(c => (
            <Badge key={c.id} variant="secondary" className="gap-1.5">
              {c.hex_color && <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: c.hex_color }} />}
              {c.name}
            </Badge>
          )) : <span className="text-xs text-muted-foreground">Nenhuma cor cadastrada no Admin.</span>}
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Ruler className="w-4 h-4" /> Espessuras
        </div>
        <div className="flex flex-wrap gap-2">
          {activeThicks.length ? activeThicks.map(t => (
            <Badge key={t.id} variant="secondary">{t.thickness_mm} mm</Badge>
          )) : <span className="text-xs text-muted-foreground">Nenhuma espessura cadastrada no Admin.</span>}
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Layers className="w-4 h-4" /> Cores de alumínio
        </div>
        <div className="flex flex-wrap gap-2">
          {activeAlu.length ? activeAlu.map(c => (
            <Badge key={c.id} variant="secondary" className="gap-1.5">
              {c.hex_color && <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: c.hex_color }} />}
              {c.name}
            </Badge>
          )) : <span className="text-xs text-muted-foreground">Nenhuma cor cadastrada no Admin.</span>}
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="text-sm font-semibold">Combinações possíveis</div>
        <div className="text-xs text-muted-foreground">
          {activeColors.length} cores × {activeThicks.length} espessuras ={' '}
          <strong>{activeColors.length * activeThicks.length}</strong> variações de vidro,
          multiplicadas por {activeAlu.length} cores de alumínio.
        </div>
      </Card>
    </div>
  );
}
