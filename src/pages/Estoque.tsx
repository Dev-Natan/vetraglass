import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Boxes, Layers, ChevronRight, GlassWater, Package, Loader2, Info,
  Blocks, ArrowLeft, History,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useStockData } from '@/hooks/useStockData';
import { useCompanyLinhas } from '@/hooks/useCompanyLinhas';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';

const VIDROS_KEY = '__vidros__';
const DIVERSOS_KEY = '__diversos__';

function slug(s: string) {
  return encodeURIComponent(s);
}

type View = 'root' | 'perfis' | 'diversos' | 'vidros';

export default function Estoque() {
  const { currentCompany } = useAuth();
  useModuleTutorialTrigger('estoque');

  const [view, setView] = useState<View>('root');

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
    const byLinhaPerfil = new Map<string, { items: number; qty: number }>();
    const byLinhaDiversos = new Map<string, { items: number; qty: number }>();
    const byLinhaVidros = new Map<string, { items: number; qty: number }>();
    let vidros = { items: 0, qty: 0 };
    let vidrosSemLinha = { items: 0, qty: 0 };
    let diversos = { items: 0, qty: 0 };
    let diversosSemLinha = { items: 0, qty: 0 };
    let perfis = { items: 0, qty: 0 };

    for (const it of activeItems) {
      const linha = (it.company_item?.linha ?? it.item_template?.linha ?? '').trim();
      const type = it.company_item?.type ?? it.item_template?.type ?? '';
      const qty = it.quantity || 0;

      if (type === 'glass' || type === 'vidro') {
        vidros.items++;
        vidros.qty += qty;
        if (!linha) {
          vidrosSemLinha.items++;
          vidrosSemLinha.qty += qty;
        } else if (activeLinhaKeys.size === 0 || activeLinhaKeys.has(linha.toLowerCase())) {
          const cur = byLinhaVidros.get(linha) ?? { items: 0, qty: 0 };
          cur.items++;
          cur.qty += qty;
          byLinhaVidros.set(linha, cur);
        }
        continue;
      }

      if (type === 'perfil') {
        perfis.items++;
        perfis.qty += qty;
        if (linha && (activeLinhaKeys.size === 0 || activeLinhaKeys.has(linha.toLowerCase()))) {
          const cur = byLinhaPerfil.get(linha) ?? { items: 0, qty: 0 };
          cur.items++;
          cur.qty += qty;
          byLinhaPerfil.set(linha, cur);
        }
        continue;
      }

      // Everything else (acessorios, guarnicao, sem tipo) → diversos
      diversos.items++;
      diversos.qty += qty;
      if (!linha) {
        diversosSemLinha.items++;
        diversosSemLinha.qty += qty;
      } else if (activeLinhaKeys.size === 0 || activeLinhaKeys.has(linha.toLowerCase())) {
        const cur = byLinhaDiversos.get(linha) ?? { items: 0, qty: 0 };
        cur.items++;
        cur.qty += qty;
        byLinhaDiversos.set(linha, cur);
      }
    }

    const linhasPerfil = (productLinhas || [])
      .map(l => ({ name: l.name, ...(byLinhaPerfil.get(l.name) ?? { items: 0, qty: 0 }) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    const linhasDiversos = (productLinhas || [])
      .map(l => ({ name: l.name, ...(byLinhaDiversos.get(l.name) ?? { items: 0, qty: 0 }) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    const linhasVidros = (productLinhas || [])
      .map(l => ({ name: l.name, ...(byLinhaVidros.get(l.name) ?? { items: 0, qty: 0 }) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return { vidros, diversos, perfis, linhasPerfil, linhasDiversos, linhasVidros, diversosSemLinha, vidrosSemLinha };
  }, [activeItems, activeLinhaKeys, productLinhas]);

  const headerTitle =
    view === 'root' ? 'Estoque'
    : view === 'perfis' ? 'Perfis · Selecione a linha'
    : view === 'vidros' ? 'Vidros · Selecione a linha'
    : 'Acessórios / Diversos · Selecione a linha';

  const headerSubtitle =
    view === 'root' ? 'Escolha uma categoria para gerenciar entradas, saídas e saldos.'
    : view === 'perfis' ? 'Selecione a linha do perfil (Suprema, Temperados, etc.).'
    : view === 'vidros' ? 'Selecione a linha do vidro (Temperados, Comum, etc.).'
    : 'Selecione a linha dos acessórios/diversos.';

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          {view !== 'root' && (
            <Button variant="ghost" size="icon" onClick={() => setView('root')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <Boxes className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{headerTitle}</h1>
            <p className="text-sm text-muted-foreground">{headerSubtitle}</p>
          </div>
        </div>

        {view === 'root' && (
          <Card className="p-4 bg-primary/5 border-primary/20 flex gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              Qualquer alteração de saldo reflete imediatamente no badge <strong>Em Estoque</strong> em Meus Preços.
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : view === 'root' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StockCard
              onClick={() => setView('vidros')}
              icon={<GlassWater className="w-6 h-6" />}
              title="Vidros"
              subtitle={`${stats.vidros.items} item(s) · ${stats.vidros.qty.toFixed(2)} em saldo`}
              badge={`${stats.linhasVidros.length} linha(s)`}
            />
            <StockCard
              onClick={() => setView('perfis')}
              icon={<Blocks className="w-6 h-6" />}
              title="Perfis"
              subtitle={`${stats.perfis.items} item(s) · ${stats.perfis.qty.toFixed(2)} em saldo`}
              badge={`${stats.linhasPerfil.length} linha(s)`}
            />
            <StockCard
              onClick={() => setView('diversos')}
              icon={<Package className="w-6 h-6" />}
              title="Acessórios / Diversos"
              subtitle={`${stats.diversos.items} item(s) · ${stats.diversos.qty.toFixed(2)} em saldo`}
              badge={`${stats.linhasDiversos.length} linha(s)`}
            />
            <StockCard
              to="/estoque/historico"
              icon={<History className="w-6 h-6" />}
              title="Histórico de Movimentações"
              subtitle="Todas as entradas e saídas — quem, quando, quanto e por quê."
              badge="Ver histórico"
            />
            <StockCard
              to="/estoque/retalhos"
              icon={<Boxes className="w-6 h-6" />}
              title="Banco de Retalhos"
              subtitle="Sobras úteis de chapas e barras para reaproveitar antes de gastar material novo."
              badge="Ver retalhos"
            />

          </div>
        ) : view === 'perfis' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.linhasPerfil.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma linha habilitada. Use <strong>Gerenciar Linhas</strong> em Produtos para ativá-las.
                </CardContent>
              </Card>
            ) : (
              stats.linhasPerfil.map(l => (
                <StockCard
                  key={l.name}
                  to={`/estoque/linha/${slug(l.name)}?tipo=perfil`}
                  icon={<Layers className="w-6 h-6" />}
                  title={l.name}
                  subtitle={`${l.items} perfil(s) · ${l.qty.toFixed(2)} em saldo`}
                  badge={`${l.items} itens`}
                />
              ))
            )}
          </div>
        ) : view === 'vidros' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StockCard
              to={`/estoque/linha/${slug(VIDROS_KEY)}`}
              icon={<GlassWater className="w-6 h-6" />}
              title="Todos os Vidros"
              subtitle={`${stats.vidros.items} item(s) · ${stats.vidros.qty.toFixed(2)} em saldo`}
              badge="Ver tudo"
            />
            {stats.vidrosSemLinha.items > 0 && (
              <StockCard
                to={`/estoque/linha/${slug(VIDROS_KEY)}?semlinha=1`}
                icon={<GlassWater className="w-6 h-6" />}
                title="Sem linha específica"
                subtitle={`${stats.vidrosSemLinha.items} item(s) · ${stats.vidrosSemLinha.qty.toFixed(2)} em saldo`}
                badge="Genéricos"
              />
            )}
            {stats.linhasVidros.map(l => (
              <StockCard
                key={l.name}
                to={`/estoque/linha/${slug(l.name)}?tipo=vidro`}
                icon={<Layers className="w-6 h-6" />}
                title={l.name}
                subtitle={`${l.items} vidro(s) · ${l.qty.toFixed(2)} em saldo`}
                badge={`${l.items} itens`}
              />
            ))}
            {stats.linhasVidros.length === 0 && stats.vidrosSemLinha.items === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum vidro cadastrado.
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StockCard
              to={`/estoque/linha/${slug(DIVERSOS_KEY)}`}
              icon={<Package className="w-6 h-6" />}
              title="Sem linha específica"
              subtitle={`${stats.diversosSemLinha.items} item(s) · ${stats.diversosSemLinha.qty.toFixed(2)} em saldo`}
              badge="Genéricos"
            />
            {stats.linhasDiversos.map(l => (
              <StockCard
                key={l.name}
                to={`/estoque/linha/${slug(l.name)}?tipo=diversos`}
                icon={<Layers className="w-6 h-6" />}
                title={l.name}
                subtitle={`${l.items} item(s) · ${l.qty.toFixed(2)} em saldo`}
                badge={`${l.items} itens`}
              />
            ))}
            {stats.linhasDiversos.length === 0 && stats.diversosSemLinha.items === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum item de acessórios/diversos cadastrado.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}


function StockCard({
  to, onClick, icon, title, subtitle, badge,
}: {
  to?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge: string;
}) {
  const inner = (
    <Card className="h-full transition-all hover:border-primary/60 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer">
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
  );

  if (to) return <Link to={to} className="group">{inner}</Link>;
  return <button type="button" onClick={onClick} className="group text-left">{inner}</button>;
}
