import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { operationalErrorMessage } from '@/utils/operationalError';

type ProductSummary = { id: string; name: string; product_template_id: string | null; line_name: string | null };
type Workspace = { labor_percent: number; products: ProductSummary[] };
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function FinalProductsPricing({ companyId }: { companyId: string; mayEdit: boolean }) {
  const workspace = usePricingWorkspace(companyId);
  if (workspace.isLoading) return <Loading />;
  if (workspace.error) return <ErrorCard error={workspace.error} />;
  const products = workspace.data?.products ?? [];
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Preço sugerido por composição</h2>
        <p className="text-sm text-muted-foreground">
          O consumo de cada componente e seu preço comercial formam a sugestão.
          Configure os valores em Materiais e Componentes. O preço aplicado pode ser editado no orçamento.
        </p>
      </div>
      {products.length === 0 ? <Empty text="Nenhum produto final ativo nesta empresa." /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((product) => (
            <Card key={product.id}>
              <CardContent className="space-y-2 p-4">
                <p className="break-words font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {product.product_template_id ? 'Catálogo global materializado' : 'Produto privado'}
                  {product.line_name ? ` · ${product.line_name}` : ''}
                </p>
                <Badge variant="secondary">Composição</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export function CompositionLaborCard({ companyId, mayEdit }: { companyId: string; mayEdit: boolean }) {
  const queryClient = useQueryClient();
  const workspace = usePricingWorkspace(companyId);
  const [value, setValue] = useState('0');
  useEffect(() => {
    if (workspace.data) setValue(String(workspace.data.labor_percent ?? 0));
  }, [workspace.data]);
  const numericValue = Number(value.replace(',', '.'));
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_company_composition_labor_percent', {
        _company_id: companyId,
        _labor_percent: numericValue,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pricing-workspace', companyId] });
      toast.success('Percentual de mão de obra atualizado.');
    },
    onError: (error) => toast.error(operationalErrorMessage(error, 'Não foi possível salvar a mão de obra.')),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" />Mão de obra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Aplicada uma única vez após a soma comercial dos componentes de produtos por composição.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full space-y-2 sm:max-w-48">
            <Label htmlFor="composition-labor">Percentual da empresa</Label>
            <div className="relative">
              <Input
                id="composition-labor"
                inputMode="decimal"
                value={value}
                disabled={!mayEdit}
                onChange={(event) => setValue(event.target.value)}
                className="pr-9"
              />
              <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
            </div>
          </div>
          {mayEdit ? (
            <Button
              disabled={!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 1000 || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar
            </Button>
          ) : null}
        </div>
        <div className="rounded-md bg-muted p-3 text-sm">
          Exemplo: componentes {money(1000)} + {Number.isFinite(numericValue) ? numericValue : 0}% ={' '}
          <strong>{money(1000 * (1 + (Number.isFinite(numericValue) ? numericValue : 0) / 100))}</strong>
        </div>
      </CardContent>
    </Card>
  );
}

function usePricingWorkspace(companyId: string) {
  return useQuery({
    queryKey: ['pricing-workspace', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_company_pricing_workspace', { _company_id: companyId });
      if (error) throw error;
      return data as unknown as Workspace;
    },
  });
}

function Loading() { return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>; }
function ErrorCard({ error }: { error: unknown }) { return <Card><CardContent className="p-6 text-sm text-destructive">{operationalErrorMessage(error, 'Não foi possível carregar a precificação.')}</CardContent></Card>; }
function Empty({ text }: { text: string }) { return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{text}</CardContent></Card>; }
