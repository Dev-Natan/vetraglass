import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Boxes, Layers, ChevronRight, GlassWater, Package, Loader2, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useStockData } from '@/hooks/useStockData';
import { useProductLinhas } from '@/hooks/useCompanyLinhas';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';

const VIDROS_KEY = '__vidros__';
const DIVERSOS_KEY = '__diversos__';

function slug(s: string) {
  return encodeURIComponent(s);
}

export default function Estoque() {
  const { currentCompany } = useAuth();
  useModuleTutorialTrigger('estoque');

  const { activeItems, isLoading } = useStockData({ companyId: currentCompany?.id });
  const { data: productLinhas } = useCompanyLinhas();

  const activeLinhaKeys = useMemo(() => {
    const set = new Set<string>();
    (productLinhas || []).forEach(l => {
      if (l.slug) set.add(l.slug.toLowerCase());
      if (l.name) set.add(l.name.toLowerCase());
    });
    return set;
  }, [productLinhas]);

  const stats = useMemo(() => {
    const byLinha = new Map<string, { items: number; qty: number }>();
    let vidros = { items: 0, qty: 0 };
    let diversos = { items: 0, qty: 0 };

    for (const it of activeItems) {
      const linha = (it.company_item?.linha ?? it.item_template?.linha ?? '').trim();
      const type = it.company_item?.type ?? it.item_template?.type ?? '';
      const qty = it.quantity || 0;

      if (type === 'glass') {
        vidros.items++;
        vidros.qty += qty;
        continue;
      }
      if (!linha) {
        diversos.items++;
        diversos.qty += qty;
        continue;
      }
      // Only show lines allowed by SaaS admin dictionary
      if (activeLinhaKeys.size > 0 && !activeLinhaKeys.has(linha.toLowerCase())) continue;

      const cur = byLinha.get(linha) ?? { items: 0, qty: 0 };
      cur.items++;
      cur.qty += qty;
      byLinha.set(linha, cur);
    }

    const linhasOrdered = (productLinhas || [])
      .map(l => ({ name: l.name, ...(byLinha.get(l.name) ?? { items: 0, qty: 0 }) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return { linhas: linhasOrdered, vidros, diversos };
  }, [activeItems, activeLinhaKeys, productLinhas]);

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Boxes className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Estoque</h1>
            <p className="text-sm text-muted-foreground">
              Selecione uma linha para gerenciar entradas, saídas e saldos dos itens.
            </p>
          </div>
        </div>

        <Card className="p-4 bg-primary/5 border-primary/20 flex gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Qualquer alteração de saldo aqui reflete imediatamente no badge <strong>Em Estoque</strong> da página de Meus Preços.
          </div>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <LinhaCard
              to={`/estoque/linha/${slug(VIDROS_KEY)}`}
              icon={<GlassWater className="w-6 h-6" />}
              title="Vidros"
              subtitle={`${stats.vidros.items} item(s) · ${stats.vidros.qty.toFixed(2)} em saldo`}
              badge="Global"
            />

            <LinhaCard
              to={`/estoque/linha/${slug(DIVERSOS_KEY)}`}
              icon={<Package className="w-6 h-6" />}
              title="Acessórios / Diversos"
              subtitle={`${stats.diversos.items} item(s) sem linha específica`}
              badge={`${stats.diversos.items}`}
            />

            {stats.linhas.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma linha cadastrada pelo Admin ainda.
                </CardContent>
              </Card>
            ) : (
              stats.linhas.map(l => (
                <LinhaCard
                  key={l.name}
                  to={`/estoque/linha/${slug(l.name)}`}
                  icon={<Layers className="w-6 h-6" />}
                  title={l.name}
                  subtitle={`${l.items} item(s) · ${l.qty.toFixed(2)} em saldo`}
                  badge={`${l.items} itens`}
                />
              ))
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function LinhaCard({
  to, icon, title, subtitle, badge,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge: string;
}) {
  return (
    <Link to={to} className="group">
      <Card className="h-full transition-all hover:border-primary/60 hover:shadow-lg hover:-translate-y-0.5">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-base truncate group-hover:text-primary">{title}</h3>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
            <Badge variant="outline" className="mt-2 text-[10px]">{badge}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
