import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { formatOperationalQuantity, getOsMaterialSituation } from '@/utils/osMaterialStatus';

interface OSPurchasesListProps {
  ordemServicoId: string;
}

interface MaterialAvailabilityItem {
  requirement_id?: string;
  company_item_id: string | null;
  item_name: string;
  canonical_unit: string;
  required: number;
  reserved_for_os: number;
  missing: number;
  status: string;
  sufficient: boolean;
}

interface MaterialAvailability {
  success: boolean;
  sufficient: boolean;
  items: MaterialAvailabilityItem[];
}

function situationVariant(situation: ReturnType<typeof getOsMaterialSituation>) {
  if (situation === 'Comprar') return 'destructive' as const;
  if (situation === 'Atendido' || situation === 'Consumido') return 'default' as const;
  return 'secondary' as const;
}

export function OSPurchasesList({ ordemServicoId }: OSPurchasesListProps) {
  const { data: availability, isLoading } = useQuery({
    queryKey: ['os-material-availability', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_os_material_availability', {
        _ordem_servico_id: ordemServicoId,
      });
      if (error) throw error;
      return data as unknown as MaterialAvailability;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!availability?.items.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <ShoppingCart className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>Nenhuma necessidade de material foi registrada para esta OS.</p>
        </CardContent>
      </Card>
    );
  }

  const situations = availability.items.map((item) => getOsMaterialSituation({
    status: item.status,
    reserved: item.reserved_for_os,
    missing: item.missing,
  }));
  const attended = situations.filter((situation) => situation === 'Atendido' || situation === 'Consumido').length;
  const partial = situations.filter((situation) => situation === 'Parcial' || situation === 'Recebimento parcial').length;
  const toBuy = availability.items.filter((item) => Number(item.missing) > 0).length;

  return (
    <div className="space-y-4">
      <Card className={availability.sufficient ? 'border-green-500/30' : 'border-amber-500/50'}>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            {availability.sufficient ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
            Abastecimento da OS
            <Badge variant={availability.sufficient ? 'default' : 'secondary'}>
              {availability.sufficient ? 'Materiais atendidos' : 'Há materiais a comprar'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Materiais', availability.items.length],
              ['Atendidos', attended],
              ['Parciais', partial],
              ['A comprar', toBuy],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Necessidades e atendimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Necessário</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead className="text-right">Falta</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availability.items.map((item, index) => {
                  const situation = situations[index];
                  return (
                    <TableRow key={item.requirement_id ?? item.company_item_id ?? `${item.item_name}-${index}`}>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatOperationalQuantity(item.required, item.canonical_unit)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatOperationalQuantity(item.reserved_for_os, item.canonical_unit)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${Number(item.missing) > 0 ? 'font-semibold text-destructive' : 'text-green-600'}`}>
                        {formatOperationalQuantity(item.missing, item.canonical_unit)}
                      </TableCell>
                      <TableCell><Badge variant={situationVariant(situation)}>{situation}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {availability.items.map((item, index) => {
              const situation = situations[index];
              return (
                <div key={item.requirement_id ?? item.company_item_id ?? `${item.item_name}-mobile-${index}`} className="rounded-lg border p-3">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="font-medium">{item.item_name}</span>
                    <Badge variant={situationVariant(situation)}>{situation}</Badge>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Necessário</dt>
                      <dd>{formatOperationalQuantity(item.required, item.canonical_unit)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Reservado</dt>
                      <dd>{formatOperationalQuantity(item.reserved_for_os, item.canonical_unit)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Falta</dt>
                      <dd>{formatOperationalQuantity(item.missing, item.canonical_unit)}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>

          {!availability.sufficient ? (
            <Button asChild>
              <Link to="/pedidos-compra">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Gerar lista de compra
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
