import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tag, Palette, Layers, Info, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAdminGlassColors,
  useAdminGlassThicknesses,
  useAdminSuggestedPrices,
} from '@/hooks/useAdminPricingLists';
import {
  useProfileTemplates,
  useItemTemplateColorPrices,
  useCompanyItemColorPrices,
} from '@/hooks/useItemColorPrices';
import { useStockByTemplate } from '@/hooks/useStockByTemplate';
import { Package } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface CompanySuggestedPrice {
  id?: string;
  company_id: string;
  kind: 'glass' | 'aluminum';
  glass_color: string | null;
  thickness_mm: number | null;
  aluminum_color: string | null;
  cost_per_sqm: number | null;
  price_per_sqm: number | null;
  cost_per_meter: number | null;
  price_per_meter: number | null;
}

function useCompanySuggestedPrices() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['company-suggested-prices', companyId],
    queryFn: async () => {
      if (!companyId) return [] as CompanySuggestedPrice[];
      const { data, error } = await sb
        .from('company_suggested_prices')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data ?? []) as CompanySuggestedPrice[];
    },
    enabled: !!companyId,
  });

  const upsert = useMutation({
    mutationFn: async (input: Omit<CompanySuggestedPrice, 'company_id' | 'id'>) => {
      if (!companyId) throw new Error('Sem empresa ativa');
      const payload = { ...input, company_id: companyId };
      const onConflict = input.kind === 'glass'
        ? 'company_id,glass_color,thickness_mm'
        : 'company_id,aluminum_color';
      const { error } = await sb.from('company_suggested_prices').upsert(payload, { onConflict });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-suggested-prices', companyId] });
      qc.invalidateQueries({ queryKey: ['company-suggested-prices-cache'] });
      toast.success('Preço salvo');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, upsert, companyId };
}

export default function MeusPrecos() {
  const { data: glassColors = [] } = useAdminGlassColors();
  const { data: thicknesses = [] } = useAdminGlassThicknesses();
  const { data: adminPrices = [] } = useAdminSuggestedPrices();
  const { data: companyPrices = [], upsert, isLoading } = useCompanySuggestedPrices();
  const { data: profiles = [] } = useProfileTemplates();
  const { data: stockMap } = useStockByTemplate();

  const getCompanyGlass = (color: string, thick: number) =>
    companyPrices.find(p => p.kind === 'glass' && p.glass_color === color && p.thickness_mm === thick);
  const getAdminGlass = (color: string, thick: number) =>
    adminPrices.find(p => p.kind === 'glass' && p.glass_color === color && p.thickness_mm === thick);

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Tag className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Meus Preços</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre seu custo e preço. Os valores têm prioridade sobre o sugerido do sistema nos seus orçamentos.
            </p>
          </div>
        </div>

        <Card className="p-4 bg-primary/5 border-primary/20 flex gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Em branco → orçamento usa o <strong>Preço Sugerido</strong> do sistema. Para alumínio,
            o preço agora é <strong>por perfil × cor</strong>.
          </div>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="aluminum">
            <TabsList>
              <TabsTrigger value="aluminum"><Layers className="w-4 h-4 mr-1" />Alumínio (por perfil)</TabsTrigger>
              <TabsTrigger value="glass"><Palette className="w-4 h-4 mr-1" />Vidros</TabsTrigger>
            </TabsList>

            <TabsContent value="aluminum" className="space-y-4">
              {profiles.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum perfil cadastrado pelo Admin ainda.
                </CardContent></Card>
              ) : (
                Array.from(
                  profiles.reduce((map, p) => {
                    const key = p.linha || 'Sem Linha';
                    if (!map.has(key)) map.set(key, []);
                    map.get(key)!.push(p);
                    return map;
                  }, new Map<string, typeof profiles>())
                )
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([linha, list]) => (
                    <LinhaGroup key={linha} linha={linha} profiles={list} stockMap={stockMap} />
                  ))
              )}
            </TabsContent>

            <TabsContent value="glass">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Preços de Vidro (por m²)</CardTitle>
                  <CardDescription>Combinações de cor × espessura cadastradas pelo Admin.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cor</TableHead>
                        <TableHead>Espessura</TableHead>
                        <TableHead className="w-32">Meu Custo/m²</TableHead>
                        <TableHead className="w-32">Meu Preço/m²</TableHead>
                        <TableHead>Sugerido</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {glassColors.filter(c => c.is_active).flatMap(c =>
                        thicknesses.filter(t => t.is_active).map(t => {
                          const cp = getCompanyGlass(c.name, t.thickness_mm);
                          const ap = getAdminGlass(c.name, t.thickness_mm);
                          return (
                            <GlassRow
                              key={`${c.id}-${t.id}`}
                              colorName={c.name}
                              thicknessLabel={`${t.thickness_mm}mm`}
                              initialCost={cp?.cost_per_sqm}
                              initialPrice={cp?.price_per_sqm}
                              suggested={
                                `${ap?.cost_per_sqm != null ? `Custo R$ ${ap.cost_per_sqm}` : ''}` +
                                `${ap?.price_per_sqm != null ? ` · Preço R$ ${ap.price_per_sqm}` : ''}`
                                || '—'
                              }
                              onSave={(cost, price) => upsert.mutate({
                                kind: 'glass', glass_color: c.name, thickness_mm: t.thickness_mm,
                                aluminum_color: null,
                                cost_per_sqm: cost, price_per_sqm: price,
                                cost_per_meter: null, price_per_meter: null,
                              })}
                            />
                          );
                        })
                      )}
                      {(glassColors.length === 0 || thicknesses.length === 0) && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          O Admin ainda não cadastrou cores ou espessuras.
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}

function LinhaGroup({ linha, profiles, stockMap }: {
  linha: string;
  profiles: Array<{ id: string; name: string; linha: string | null }>;
  stockMap?: Map<string, { quantity: number; unit: string | null }>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 text-left border-b">
            <div className="flex items-center gap-3">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <div>
                <div className="font-semibold text-base">{linha}</div>
                <div className="text-xs text-muted-foreground">{profiles.length} perfil(is)</div>
              </div>
            </div>
            <Badge variant="outline">Linha</Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 space-y-2">
            {profiles.map(p => <ProfileCard key={p.id} profile={p} stock={stockMap?.get(p.id)} />)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}


function ProfileCard({ profile }: { profile: { id: string; name: string; linha: string | null } }) {
  const [open, setOpen] = useState(false);
  const { data: adminRows = [] } = useItemTemplateColorPrices(open ? profile.id : undefined);
  const { data: companyRows = [], upsert } = useCompanyItemColorPrices(open ? profile.id : undefined);

  const getCompany = (color: string) => companyRows.find(r => r.color_name === color);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 text-left">
            <div className="flex items-center gap-3">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <div>
                <div className="font-semibold">{profile.name}</div>
                {profile.linha && <div className="text-xs text-muted-foreground">{profile.linha}</div>}
              </div>
            </div>
            {open && <Badge variant="secondary">{adminRows.length} cor(es)</Badge>}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            {adminRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">
                O Admin ainda não cadastrou cores para este perfil.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cor</TableHead>
                    <TableHead className="w-32">Meu Custo/ml</TableHead>
                    <TableHead className="w-32">Meu Preço/ml</TableHead>
                    <TableHead>Sugerido</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminRows.map(ar => {
                    const cr = getCompany(ar.color_name);
                    return (
                      <ProfileColorRow
                        key={ar.color_name}
                        colorName={ar.color_name}
                        initialCost={cr?.cost_per_meter}
                        initialPrice={cr?.price_per_meter}
                        suggested={
                          `${ar.cost_per_meter != null ? `Custo R$ ${ar.cost_per_meter}` : ''}` +
                          `${ar.price_per_meter != null ? ` · Preço R$ ${ar.price_per_meter}` : ''}`
                          || '—'
                        }
                        onSave={(cost, price) => upsert.mutate({
                          item_template_id: profile.id,
                          color_name: ar.color_name,
                          cost_per_meter: cost,
                          price_per_meter: price,
                        })}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ProfileColorRow({ colorName, initialCost, initialPrice, suggested, onSave }: {
  colorName: string;
  initialCost?: number | null;
  initialPrice?: number | null;
  suggested: string;
  onSave: (cost: number | null, price: number | null) => void;
}) {
  const [cost, setCost] = useState(initialCost != null ? String(initialCost) : '');
  const [price, setPrice] = useState(initialPrice != null ? String(initialPrice) : '');
  const isSet = cost !== '' || price !== '';
  return (
    <TableRow>
      <TableCell className="font-medium">{colorName}</TableCell>
      <TableCell><Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></TableCell>
      <TableCell><Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">{suggested}</TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant={isSet ? 'default' : 'outline'}
          onClick={() => onSave(cost ? parseFloat(cost) : null, price ? parseFloat(price) : null)}>
          Salvar
        </Button>
      </TableCell>
    </TableRow>
  );
}

function GlassRow({ colorName, thicknessLabel, initialCost, initialPrice, suggested, onSave }: {
  colorName: string; thicknessLabel: string;
  initialCost?: number | null; initialPrice?: number | null;
  suggested: string;
  onSave: (cost: number | null, price: number | null) => void;
}) {
  const [cost, setCost] = useState(initialCost != null ? String(initialCost) : '');
  const [price, setPrice] = useState(initialPrice != null ? String(initialPrice) : '');
  const isSet = cost !== '' || price !== '';
  return (
    <TableRow>
      <TableCell className="font-medium">{colorName}</TableCell>
      <TableCell><Badge variant="secondary">{thicknessLabel}</Badge></TableCell>
      <TableCell><Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></TableCell>
      <TableCell><Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">{suggested}</TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant={isSet ? 'default' : 'outline'}
          onClick={() => onSave(cost ? parseFloat(cost) : null, price ? parseFloat(price) : null)}>
          Salvar
        </Button>
      </TableCell>
    </TableRow>
  );
}
