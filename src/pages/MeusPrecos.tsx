import { useState, useMemo } from 'react';
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
import { Tag, Palette, Layers, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAdminGlassColors,
  useAdminGlassThicknesses,
  useAdminAluminumColors,
  useAdminSuggestedPrices,
} from '@/hooks/useAdminPricingLists';

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

interface RowPriceState { cost: string; price: string }

export default function MeusPrecos() {
  const { data: glassColors = [] } = useAdminGlassColors();
  const { data: thicknesses = [] } = useAdminGlassThicknesses();
  const { data: aluColors = [] } = useAdminAluminumColors();
  const { data: adminPrices = [] } = useAdminSuggestedPrices();
  const { data: companyPrices = [], upsert, isLoading } = useCompanySuggestedPrices();

  const getCompany = (kind: 'glass' | 'aluminum', a: string, b?: number) =>
    companyPrices.find(p =>
      p.kind === kind &&
      (kind === 'glass' ? p.glass_color === a && p.thickness_mm === b : p.aluminum_color === a)
    );
  const getAdmin = (kind: 'glass' | 'aluminum', a: string, b?: number) =>
    adminPrices.find(p =>
      p.kind === kind &&
      (kind === 'glass' ? p.glass_color === a && p.thickness_mm === b : p.aluminum_color === a)
    );

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Tag className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Meus Preços</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre seu custo e preço por m² / metro linear. Os valores têm prioridade sobre o
              preço sugerido do sistema nos seus orçamentos.
            </p>
          </div>
        </div>

        <Card className="p-4 bg-primary/5 border-primary/20 flex gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Se você deixar em branco, o orçamento usa o <strong>Preço Sugerido</strong> do sistema
            (mostrado ao lado como referência).
          </div>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="glass">
            <TabsList>
              <TabsTrigger value="glass"><Palette className="w-4 h-4 mr-1" />Vidros</TabsTrigger>
              <TabsTrigger value="aluminum"><Layers className="w-4 h-4 mr-1" />Alumínio</TabsTrigger>
            </TabsList>

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
                          const cp = getCompany('glass', c.name, t.thickness_mm);
                          const ap = getAdmin('glass', c.name, t.thickness_mm);
                          return (
                            <PriceRow
                              key={`${c.id}-${t.id}`}
                              nameCell={c.name}
                              extraCell={<Badge variant="secondary">{t.thickness_mm}mm</Badge>}
                              initialCost={cp?.cost_per_sqm}
                              initialPrice={cp?.price_per_sqm}
                              suggested={`${ap?.cost_per_sqm != null ? `Custo R$ ${ap.cost_per_sqm}` : ''}${ap?.price_per_sqm != null ? ` · Preço R$ ${ap.price_per_sqm}` : ''}` || '—'}
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

            <TabsContent value="aluminum">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Preços de Alumínio</CardTitle>
                  <CardDescription>Por metro linear (perfis) e por m² (fallback).</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cor</TableHead>
                        <TableHead className="w-28">Custo/ml</TableHead>
                        <TableHead className="w-28">Preço/ml</TableHead>
                        <TableHead className="w-28">Custo/m²</TableHead>
                        <TableHead className="w-28">Preço/m²</TableHead>
                        <TableHead>Sugerido</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aluColors.filter(c => c.is_active).map(c => {
                        const cp = getCompany('aluminum', c.name);
                        const ap = getAdmin('aluminum', c.name);
                        return (
                          <AluRow
                            key={c.id}
                            name={c.name}
                            initial={{
                              costM: cp?.cost_per_meter, priceM: cp?.price_per_meter,
                              costS: cp?.cost_per_sqm, priceS: cp?.price_per_sqm,
                            }}
                            suggested={ap
                              ? `ml: ${ap.cost_per_meter ?? '—'}/${ap.price_per_meter ?? '—'} · m²: ${ap.cost_per_sqm ?? '—'}/${ap.price_per_sqm ?? '—'}`
                              : '—'}
                            onSave={(v) => upsert.mutate({
                              kind: 'aluminum', aluminum_color: c.name,
                              glass_color: null, thickness_mm: null,
                              cost_per_meter: v.costM, price_per_meter: v.priceM,
                              cost_per_sqm: v.costS, price_per_sqm: v.priceS,
                            })}
                          />
                        );
                      })}
                      {aluColors.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                          O Admin ainda não cadastrou cores de alumínio.
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

function PriceRow({ nameCell, extraCell, initialCost, initialPrice, suggested, onSave }: {
  nameCell: string; extraCell: React.ReactNode;
  initialCost?: number | null; initialPrice?: number | null;
  suggested: string;
  onSave: (cost: number | null, price: number | null) => void;
}) {
  const [cost, setCost] = useState(initialCost != null ? String(initialCost) : '');
  const [price, setPrice] = useState(initialPrice != null ? String(initialPrice) : '');
  const isSet = cost !== '' || price !== '';
  return (
    <TableRow>
      <TableCell className="font-medium">{nameCell}</TableCell>
      <TableCell>{extraCell}</TableCell>
      <TableCell><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></TableCell>
      <TableCell><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></TableCell>
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

function AluRow({ name, initial, suggested, onSave }: {
  name: string;
  initial: { costM?: number | null; priceM?: number | null; costS?: number | null; priceS?: number | null };
  suggested: string;
  onSave: (v: { costM: number | null; priceM: number | null; costS: number | null; priceS: number | null }) => void;
}) {
  const [costM, setCostM] = useState(initial.costM != null ? String(initial.costM) : '');
  const [priceM, setPriceM] = useState(initial.priceM != null ? String(initial.priceM) : '');
  const [costS, setCostS] = useState(initial.costS != null ? String(initial.costS) : '');
  const [priceS, setPriceS] = useState(initial.priceS != null ? String(initial.priceS) : '');
  const num = (v: string) => (v ? parseFloat(v) : null);
  return (
    <TableRow>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell><Input type="number" step="0.01" value={costM} onChange={(e) => setCostM(e.target.value)} /></TableCell>
      <TableCell><Input type="number" step="0.01" value={priceM} onChange={(e) => setPriceM(e.target.value)} /></TableCell>
      <TableCell><Input type="number" step="0.01" value={costS} onChange={(e) => setCostS(e.target.value)} /></TableCell>
      <TableCell><Input type="number" step="0.01" value={priceS} onChange={(e) => setPriceS(e.target.value)} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">{suggested}</TableCell>
      <TableCell className="text-right">
        <Button size="sm" onClick={() => onSave({ costM: num(costM), priceM: num(priceM), costS: num(costS), priceS: num(priceS) })}>
          Salvar
        </Button>
      </TableCell>
    </TableRow>
  );
}
