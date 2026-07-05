import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tag, Layers, ChevronRight, GlassWater, Info, Loader2 } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface Template {
  id: string;
  name: string;
  linha: string | null;
  type: string;
}

const VIDROS_KEY = '__vidros__';

export function linhaToSlug(linha: string) {
  return encodeURIComponent(linha);
}

export default function MeusPrecos() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['meus-precos-templates'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('item_templates')
        .select('id, name, linha, type')
        .eq('is_active', true)
        .in('type', ['profile', 'accessory']);
      if (error) throw error;
      return (data ?? []) as Template[];
    },
    staleTime: 60_000,
  });

  const linhas = useMemo(() => {
    const map = new Map<string, { profiles: number; accessories: number }>();
    for (const t of templates) {
      const key = t.linha || 'Sem Linha';
      const cur = map.get(key) ?? { profiles: 0, accessories: 0 };
      if (t.type === 'profile') cur.profiles++;
      else if (t.type === 'accessory') cur.accessories++;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([name, stats]) => ({ name, ...stats, total: stats.profiles + stats.accessories }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [templates]);

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Tag className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Meus Preços</h1>
            <p className="text-sm text-muted-foreground">
              Selecione uma linha para editar preços de perfis, acessórios e guarnições.
            </p>
          </div>
        </div>

        <Card className="p-4 bg-primary/5 border-primary/20 flex gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Preços em branco → orçamento usa o <strong>Preço Sugerido</strong> do sistema.
            Vidros ficam centralizados em um único painel abaixo.
          </div>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card especial: Vidros (cross-linha) */}
            <LinhaCard
              to={`/meus-precos/linha/${linhaToSlug(VIDROS_KEY)}`}
              icon={<GlassWater className="w-6 h-6" />}
              title="Vidros"
              subtitle="Preço por cor × espessura"
              badge="Global"
            />

            {linhas.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma linha cadastrada pelo Admin ainda.
                </CardContent>
              </Card>
            ) : (
              linhas.map(l => (
                <LinhaCard
                  key={l.name}
                  to={`/meus-precos/linha/${linhaToSlug(l.name)}`}
                  icon={<Layers className="w-6 h-6" />}
                  title={l.name}
                  subtitle={`${l.profiles} perfil(is) · ${l.accessories} acessório(s)`}
                  badge={`${l.total} itens`}
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
