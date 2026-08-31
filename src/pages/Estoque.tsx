import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Blocks,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  GlassWater,
  History,
  Layers,
  Loader2,
  Package,
  PackageCheck,
  PackageX,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RegistrarMovimentoDialog } from '@/components/estoque/RegistrarMovimentoDialog';
import { UnifiedAddItemDialog } from '@/components/estoque/UnifiedAddItemDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';
import { useStockData } from '@/hooks/useStockData';
import type { StockItem } from '@/types/estoque';

const CATEGORY_KEY = '__categoria__';

const encode = (value: string) => encodeURIComponent(value);
const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
const itemType = (item: StockItem) => normalize(item.category_code ?? item.company_item?.type ?? item.item_template?.type);
const itemLine = (item: StockItem) => {
  const lineId = item.line_id ?? item.item_template?.line_id;
  return lineId ? (item.line_name ?? item.item_template?.linha ?? item.company_item?.linha ?? '').trim() : '';
};
const itemName = (item: StockItem) => item.company_item?.name ?? item.item_template?.name ?? 'Item sem nome';

const money = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(value || 0);
const countLabel = (value: number, singular: string, plural: string) => `${value} ${value === 1 ? singular : plural}`;

function categoryIcon(code: string) {
  if (['profile', 'perfil'].includes(code)) return <Blocks className="h-5 w-5" />;
  if (['glass', 'vidro'].includes(code)) return <GlassWater className="h-5 w-5" />;
  return <Package className="h-5 w-5" />;
}

export default function Estoque() {
  const { currentCompany } = useAuth();
  const navigate = useNavigate();
  useModuleTutorialTrigger('estoque');

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [movement, setMovement] = useState<'entrada' | 'saida' | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 200);

  const { activeItems, isLoading, kpis } = useStockData({ companyId: currentCompany?.id });

  const categories = useMemo(() => {
    const result = new Map<string, {
      code: string; name: string; items: number; inStock: number; quantity: number; lines: Set<string>;
    }>();
    activeItems.forEach((item) => {
      const code = itemType(item) || 'other';
      const name = item.category_name || ({
        profile: 'Perfis', glass: 'Vidros', accessory: 'Acessórios', sheet: 'Chaparia', service: 'Serviços',
      } as Record<string, string>)[code] || code;
      const current = result.get(code) ?? { code, name, items: 0, inStock: 0, quantity: 0, lines: new Set<string>() };
      current.items += 1;
      if (item.quantity > 0) current.inStock += 1;
      current.quantity += Number(item.quantity || 0);
      const line = itemLine(item);
      if (line) current.lines.add(line);
      result.set(code, current);
    });
    return Array.from(result.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [activeItems]);

  const currentCategory = categories.find((category) => category.code === selectedCategory) ?? null;

  const categoryLines = useMemo(() => {
    if (!selectedCategory) return [];
    const grouped = new Map<string, { name: string; items: number; inStock: number; quantity: number }>();
    activeItems.filter((item) => itemType(item) === selectedCategory).forEach((item) => {
      const line = itemLine(item);
      if (!line) return;
      const current = grouped.get(line) ?? { name: line, items: 0, inStock: 0, quantity: 0 };
      current.items += 1;
      if (item.quantity > 0) current.inStock += 1;
      current.quantity += Number(item.quantity || 0);
      grouped.set(line, current);
    });
    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [activeItems, selectedCategory]);

  const searchResults = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (query.length < 2) return [];
    return activeItems.filter((item) => [
      itemName(item), item.company_item?.code, item.category_name, item.category_code,
      item.line_name, item.line_code, item.variant_name, item.color_code,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))).slice(0, 30);
  }, [activeItems, debouncedSearch]);

  const inStockCount = activeItems.filter((item) => item.quantity > 0).length;

  function openItem(item: StockItem) {
    const line = itemLine(item);
    const type = itemType(item);
    if (line) navigate(`/estoque/linha/${encode(line)}?tipo=${encode(type)}`);
    else navigate(`/estoque/linha/${encode(CATEGORY_KEY)}?tipo=${encode(type)}&categoria=${encode(item.category_name ?? type)}`);
    setSearch('');
  }

  function openCategory(code: string, name: string) {
    const category = categories.find((entry) => entry.code === code);
    if (category && category.lines.size > 0) setSelectedCategory(code);
    else navigate(`/estoque/linha/${encode(CATEGORY_KEY)}?tipo=${encode(code)}&categoria=${encode(name)}`);
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="flex items-start gap-3">
            {selectedCategory && (
              <Button variant="ghost" size="icon" onClick={() => setSelectedCategory(null)} aria-label="Voltar às categorias">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {selectedCategory ? categoryIcon(selectedCategory) : <Boxes className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {currentCategory ? `Estoque · ${currentCategory.name}` : 'Estoque'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentCategory ? 'Selecione uma linha para acessar seus itens e variantes.' : 'Gerencie entradas, saídas e saldos da empresa.'}
              </p>
            </div>
          </div>
          {selectedCategory && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setMovement('entrada')}><TrendingUp className="mr-2 h-4 w-4" />Registrar entrada</Button>
              <Button variant="outline" onClick={() => setMovement('saida')}><TrendingDown className="mr-2 h-4 w-4" />Registrar saída</Button>
            </div>
          )}
        </header>

        {!selectedCategory && (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi icon={<CircleDollarSign />} label="Valor em estoque" value={kpis.unknownValuationCount ? 'A revisar' : money(kpis.totalValue)} />
              <Kpi icon={<PackageCheck />} label="Com estoque" value={String(inStockCount)} tone="success" />
              <Kpi icon={<PackageX />} label="Sem estoque" value={String(kpis.zeroStockCount)} />
              <Kpi icon={<AlertTriangle />} label="Reposição" value={String(kpis.lowStockCount)} tone={kpis.lowStockCount ? 'danger' : 'default'} />
            </section>

            <section className="relative flex flex-col gap-2 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar item, código ou descrição..."
                  className="h-11 pl-9 pr-10"
                />
                {search && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2" onClick={() => setSearch('')}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
                <Button onClick={() => setMovement('entrada')}><TrendingUp className="mr-2 h-4 w-4" />Registrar entrada</Button>
                <Button variant="outline" onClick={() => setMovement('saida')}><TrendingDown className="mr-2 h-4 w-4" />Registrar saída</Button>
                <Button variant="outline" asChild><Link to="/estoque/historico"><History className="mr-2 h-4 w-4" />Histórico</Link></Button>
              </div>
              {debouncedSearch.trim().length >= 2 && (
                <Card className="absolute left-0 right-0 top-12 z-30 mt-2 max-h-[420px] overflow-y-auto shadow-xl lg:right-[430px]">
                  <CardContent className="p-2">
                    {searchResults.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">Nenhum item encontrado.</p>
                    ) : searchResults.map((item) => (
                      <button key={item.id} type="button" onClick={() => openItem(item)} className="flex w-full items-center gap-3 rounded-md p-3 text-left hover:bg-muted">
                        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{itemName(item)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[item.company_item?.code, item.category_name, item.line_name, item.variant_name || item.color_code].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <Badge variant={item.quantity > 0 ? 'outline' : 'secondary'}>{item.quantity > 0 ? 'Em estoque' : 'Sem estoque'}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}
            </section>
          </>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : selectedCategory && currentCategory ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div><h2 className="font-semibold">Linhas e subcategorias</h2><p className="text-sm text-muted-foreground">Somente linhas vinculadas a {currentCategory.name.toLowerCase()}.</p></div>
              <Button variant="outline" asChild>
                <Link to={`/estoque/linha/${encode(CATEGORY_KEY)}?tipo=${encode(currentCategory.code)}&categoria=${encode(currentCategory.name)}`}>Ver todos</Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categoryLines.map((line) => (
                <NavigationCard
                  key={line.name}
                  to={`/estoque/linha/${encode(line.name)}?tipo=${encode(currentCategory.code)}`}
                  icon={<Layers className="h-5 w-5" />}
                  title={line.name}
                  description={`${countLabel(line.items, 'item ou variante', 'itens ou variantes')}`}
                  meta={`${countLabel(line.inStock, 'item com saldo', 'itens com saldo')}`}
                />
              ))}
              {currentCategory.items > categoryLines.reduce((total, line) => total + line.items, 0) && (
                <NavigationCard
                  to={`/estoque/linha/${encode(CATEGORY_KEY)}?tipo=${encode(currentCategory.code)}&categoria=${encode(currentCategory.name)}`}
                  icon={<Package className="h-5 w-5" />}
                  title="Sem linha específica"
                  description="Itens vinculados diretamente à categoria"
                  meta="Ver itens"
                />
              )}
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <div><h2 className="font-semibold">Categorias</h2><p className="text-sm text-muted-foreground">Navegue pela estrutura canônica do catálogo da empresa.</p></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((category) => (
                <NavigationCard
                  key={category.code}
                  onClick={() => openCategory(category.code, category.name)}
                  icon={categoryIcon(category.code)}
                  title={category.name}
                  description={countLabel(category.items, 'item ou variante', 'itens ou variantes')}
                  meta={`${countLabel(category.lines.size, 'linha', 'linhas')} · ${countLabel(category.inStock, 'item com saldo', 'itens com saldo')}`}
                />
              ))}
            </div>
          </section>
        )}

        {!selectedCategory && (
          <section className="border-t pt-6">
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="font-semibold">Ferramentas</h2><p className="text-sm text-muted-foreground">Consultas e cadastros auxiliares do estoque.</p></div>
              <Button variant="ghost" onClick={() => setAddDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Adicionar item</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <NavigationCard to="/estoque/historico" icon={<History className="h-5 w-5" />} title="Histórico de movimentações" description="Entradas, saídas, autoria e motivo." meta="Consultar" />
              <NavigationCard to="/estoque/retalhos" icon={<Boxes className="h-5 w-5" />} title="Banco de retalhos" description="Sobras reaproveitáveis de chapas e barras." meta="Consultar" />
            </div>
          </section>
        )}
      </div>

      {movement && (
        <RegistrarMovimentoDialog open tipo={movement} stockItems={activeItems} onOpenChange={(open) => !open && setMovement(null)} />
      )}
      <UnifiedAddItemDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} defaultTab="custom" />
    </MainLayout>
  );
}

function Kpi({ icon, label, value, tone = 'default' }: { icon: React.ReactNode; label: string; value: string; tone?: 'default' | 'success' | 'danger' }) {
  return (
    <Card className={tone === 'danger' ? 'border-destructive/50' : ''}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4 ${tone === 'success' ? 'bg-emerald-500/10 text-emerald-600' : tone === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{icon}</div>
        <div className="min-w-0"><p className="truncate text-lg font-bold">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>
      </CardContent>
    </Card>
  );
}

function NavigationCard({ to, onClick, icon, title, description, meta }: {
  to?: string; onClick?: () => void; icon: React.ReactNode; title: string; description: string; meta: string;
}) {
  const content = (
    <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/20">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><h3 className="truncate font-semibold">{title}</h3><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
          <Badge variant="outline" className="mt-2 text-[10px]">{meta}</Badge>
        </div>
      </CardContent>
    </Card>
  );
  if (to) return <Link to={to} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Link>;
  return <button type="button" onClick={onClick} className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</button>;
}
