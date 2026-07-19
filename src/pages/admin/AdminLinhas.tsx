import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, GlassWater, ChevronRight } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ADMIN_VIDROS_KEY = '__vidros__';
const linhaToSlug = (l: string) => encodeURIComponent(l);

export default function AdminLinhas() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['admin-linhas-templates'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('item_templates')
        .select('id, linha, type')
        .eq('is_active', true)
        .in('type', ['profile', 'accessory']);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; linha: string | null; type: string }>;
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
      .map(([name, s]) => ({ name, ...s, total: s.profiles + s.accessories }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [templates]);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Linhas de Perfis & Acessórios</h1>
          <p className="text-muted-foreground text-sm">
            Selecione uma linha para editar preços sugeridos por cor de perfis, acessórios e guarnições.
          </p>
        </div>

        {isLoading ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando…</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <LinhaCard
              to={`/admin/insumos/linha/${linhaToSlug(ADMIN_VIDROS_KEY)}`}
              icon={<GlassWater className="w-6 h-6" />}
              title="Vidros"
              subtitle="Cores × espessuras × preço sugerido"
              badge="Global"
            />
            {linhas.map(l => (
              <LinhaCard
                key={l.name}
                to={`/admin/insumos/linha/${linhaToSlug(l.name)}`}
                icon={<Layers className="w-6 h-6" />}
                title={l.name}
                subtitle={`${l.profiles} perfil(is) · ${l.accessories} acessório(s)`}
                badge={`${l.total} itens`}
              />
            ))}
            {linhas.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma linha cadastrada ainda.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function LinhaCard({ to, icon, title, subtitle, badge }: {
  to: string; icon: React.ReactNode; title: string; subtitle: string; badge: string;
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
