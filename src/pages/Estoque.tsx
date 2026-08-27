import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Boxes, Layers, ChevronRight, GlassWater, Package, Loader2, Info,
  Blocks, ArrowLeft, History, Search, Plus, Minus, DollarSign,
  AlertTriangle, Ruler, X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useStockData } from '@/hooks/useStockData';
import { useCompanyLinhas } from '@/hooks/useCompanyLinhas';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';
import { useDebounce } from '@/hooks/useDebounce';
import { RegistrarMovimentoDialog } from '@/components/estoque/RegistrarMovimentoDialog';
import { UnifiedAddItemDialog } from '@/components/estoque/UnifiedAddItemDialog';
import type { StockItem } from '@/types/estoque';

const VIDROS_KEY = '__vidros__';
const DIVERSOS_KEY = '__diversos__';
const PERFIS_KEY = '__perfis__';

function slug(s: string) {
  return encodeURIComponent(s);
}

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value || 0);
}

type View = 'root' | 'perfis' | 'diversos' | 'vidros';

export default function Estoque() {
  const { currentCompany } = useAuth();
  const navigate = useNavigate();
  useModuleTutorialTrigger('estoque');

  const [view, setView] = useState<View>('root');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [movDialog, setMovDialog] = useState<null | { tipo: 'entrada' | 'saida' }>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { activeItems, isLoading, kpis } = useStockData({ companyId: currentCompany?.id });
  const { data: productLinhas } = useCompanyLinhas();

  const activeLinhaKeys = useMemo(() => {
    const set = new Set<string>();
    (productLinhas || []).forEach(l => {
      if (l.slug) set.add(l.slug.toLowerCase());
      if (l.name) set.add(l.name.toLowerCase());
    });
    return set;
  }, [productLinhas]);

  // Extra KPI: m² de vidro disponível vs reservado
  const glassArea = useMemo(() => {
    let available = 0;
    let reserved = 0;
    for (const it of activeItems) {
      const type = (it.company_item?.type ?? it.item_template?.type ?? '').toLowerCase();
      const unit = (it.company_item?.unit ?? it.item_template?.unit ?? '').toLowerCase();
      if (type === 'glass' || type === 'vidro' || unit === 'm2') {
        const reservedQty = Number(it.reserved_quantity || 0);
        available += Math.max(0, (it.quantity || 0) - reservedQty);
        reserved += reservedQty;
      }
    }
    return { available, reserved };
  }, [activeItems]);

  // Busca global (só ativa com >=2 caracteres)
  const searchResults = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return activeItems
      .filter(it => {
        const name = (it.item_template?.name ?? it.company_item?.name ?? '').toLowerCase();
        const linha = (it.line_name ?? it.item_template?.linha ?? it.company_item?.linha ?? '').toLowerCase();
        const variant = (it.variant_name ?? '').toLowerCase();
        return name.includes(q) || linha.includes(q) || variant.includes(q);
      })
      .slice(0, 25);
  }, [activeItems, debouncedSearch]);

  const stats = useMemo(() => {
    const byLinhaPerfil = new Map<string, { items: number; qty: number }>();
    const byLinhaDiversos = new Map<string, { items: number; qty: number }>();
    const byLinhaVidros = new Map<string, { items: number; qty: number }>();
    const vidros = { items: 0, qty: 0 };
    const vidrosSemLinha = { items: 0, qty: 0 };
    const diversos = { items: 0, qty: 0 };
    const diversosSemLinha = { items: 0, qty: 0 };
    const perfis = { items: 0, qty: 0 };

    for (const it of activeItems) {
      const linha = (it.line_name ?? it.company_item?.linha ?? it.item_template?.linha ?? '').trim();
      const type = it.category_code ?? it.company_item?.type ?? it.item_template?.type ?? '';
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

      if (type === 'perfil' || type === 'profile') {
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

  const categoryCards = useMemo(() => {
    const categories = new Map<string, { code: string; name: string; items: number; quantity: number; lines: Set<string> }>();
    activeItems.forEach((item) => {
      const code = (item.category_code || item.company_item?.type || item.item_template?.type || 'other').toLowerCase();
      const name = item.category_name || ({ profile: 'Perfis', glass: 'Vidros', accessory: 'Acessórios', sheet: 'Chaparia', service: 'Serviços' } as Record<string, string>)[code] || code;
      const current = categories.get(code) || { code, name, items: 0, quantity: 0, lines: new Set<string>() };
      current.items += 1;
      current.quantity += Number(item.quantity || 0);
      if (item.line_name) current.lines.add(item.line_name);
      categories.set(code, current);
    });
    return Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [activeItems]);

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

  function goToItem(it: StockItem) {
    const linha = (it.line_name ?? it.company_item?.linha ?? it.item_template?.linha ?? '').trim();
    const type = (it.category_code ?? it.company_item?.type ?? it.item_template?.type ?? '').toLowerCase();
    let tipo = 'diversos';
    if (type === 'glass' || type === 'vidro') tipo = 'vidro';
    else if (type === 'perfil' || type === 'profile') tipo = 'perfil';
    const key = linha || (tipo === 'vidro' ? VIDROS_KEY : tipo === 'perfil' ? PERFIS_KEY : DIVERSOS_KEY);
    navigate(`/estoque/linha/${slug(key)}?tipo=${tipo}`);
    setSearch('');
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
          {(view === 'perfis' || view === 'vidros' || view === 'diversos') && (
            <Button className="gap-2 w-full sm:w-auto" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              {view === 'perfis' ? 'Nova Linha / Perfil' : view === 'vidros' ? 'Novo Vidro / Linha' : 'Novo Item / Linha'}
            </Button>
          )}

        </div>

        {view === 'root' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold truncate">{formatBRL(kpis.totalValue)}</p>
                    <p className="text-xs text-muted-foreground">Total investido em estoque</p>
                  </div>
                </CardContent>
              </Card>
              <Card className={kpis.lowStockCount > 0 ? 'border-destructive/60' : ''}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${kpis.lowStockCount > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xl font-bold ${kpis.lowStockCount > 0 ? 'text-destructive' : ''}`}>
                      {kpis.lowStockCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Itens em alerta de reposição</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Ruler className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold truncate">
                      {glassArea.available.toFixed(2)} m²
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vidros disponíveis · {glassArea.reserved.toFixed(2)} m² reservados em OS
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Atalhos fixos próximos aos KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                subtitle="Sobras úteis de chapas e barras para reaproveitar."
                badge="Ver retalhos"
              />
            </div>

            {/* Global search */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar qualquer item do estoque (vidro, perfil, acessório)…"
                  className="pl-9 pr-9 h-11"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted"
                    aria-label="Limpar busca"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              {debouncedSearch.trim().length >= 2 && (
                <Card className="absolute z-20 top-full left-0 right-0 mt-2 max-h-96 overflow-y-auto shadow-lg">
                  <CardContent className="p-2">
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Nenhum item encontrado para "{debouncedSearch}".
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {searchResults.map((it) => {
                          const name = it.item_template?.name ?? it.company_item?.name ?? 'Item';
                          const linha = it.line_name ?? it.item_template?.linha ?? it.company_item?.linha;
                          const unit = it.item_template?.unit ?? it.company_item?.unit ?? '';
                          const type = it.category_name ?? it.item_template?.type ?? it.company_item?.type ?? '';
                          const min = Number(it.min_quantity ?? 0);
                          const isLow = min > 0 && it.quantity <= min;
                          return (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() => goToItem(it)}
                              className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted text-left"
                            >
                              <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {type || '—'}{linha ? ` · ${linha}` : ''}
                                </p>
                              </div>
                              <Badge variant={isLow ? 'destructive' : 'outline'} className="shrink-0">
                                {Number(it.quantity).toFixed(2)} {unit}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="p-4 bg-primary/5 border-primary/20 flex gap-3">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                Qualquer alteração de saldo reflete imediatamente no badge <strong>Em Estoque</strong> em Meus Preços.
              </div>
            </Card>
          </>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : view === 'root' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryCards.map((category) => (
              <StockCard
                key={category.code}
                onClick={() => setView(category.code === 'profile' ? 'perfis' : category.code === 'glass' ? 'vidros' : 'diversos')}
                icon={category.code === 'profile' ? <Blocks className="w-6 h-6" /> : category.code === 'glass' ? <GlassWater className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                title={category.name}
                subtitle={`${category.items} item(ns)/variante(s) · ${category.quantity.toFixed(2)} em saldo`}
                badge={`${category.lines.size} linha(s)`}
                onQuickEntrada={() => setMovDialog({ tipo: 'entrada' })}
                onQuickSaida={() => setMovDialog({ tipo: 'saida' })}
              />
            ))}
          </div>
        ) : view === 'perfis' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <StockCard
              to={`/estoque/linha/${slug(PERFIS_KEY)}?tipo=perfil`}
              icon={<Blocks className="w-6 h-6" />}
              title="Todos os Perfis"
              subtitle={`${stats.perfis.items} perfil(is) · ${stats.perfis.qty.toFixed(2)} m em saldo`}
              badge="Ver tudo"
            />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

      {movDialog && (
        <RegistrarMovimentoDialog
          open={!!movDialog}
          onOpenChange={(o) => { if (!o) setMovDialog(null); }}
          tipo={movDialog.tipo}
          stockItems={activeItems}
        />
      )}

      <UnifiedAddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        defaultTab="custom"
      />
    </MainLayout>
  );
}


function StockCard({
  to, onClick, icon, title, subtitle, badge, onQuickEntrada, onQuickSaida,
}: {
  to?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge: string;
  onQuickEntrada?: () => void;
  onQuickSaida?: () => void;
}) {
  const hasQuick = !!(onQuickEntrada || onQuickSaida);
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
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-[10px]">{badge}</Badge>
            {hasQuick && (
              <div className="flex items-center gap-1 ml-auto">
                {onQuickEntrada && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    title="Registrar entrada"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickEntrada(); }}
                  >
                    <Plus className="w-3.5 h-3.5 text-green-600" />
                  </Button>
                )}
                {onQuickSaida && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    title="Registrar saída"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickSaida(); }}
                  >
                    <Minus className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (to) return <Link to={to} className="group">{inner}</Link>;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      className="group text-left w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {inner}
    </div>
  );
}
