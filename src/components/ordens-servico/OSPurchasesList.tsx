import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { formatOperationalQuantity } from '@/utils/osMaterialStatus';

interface OSPurchasesListProps {
  ordemServicoId: string;
}

interface MaterialAvailabilityItem {
  os_material_id: string;
  requirement_id: string;
  company_item_id: string;
  company_item_variant_id: string | null;
  material_name: string;
  variant_name: string | null;
  required_quantity: number;
  canonical_unit: string;
  physical_on_hand: number;
  reserved_total: number;
  reserved_for_this_os: number;
  available_free: number;
  available_for_os: number | null;
  missing_quantity: number | null;
  purchase_coverage_open: number;
  status: 'AVAILABLE' | 'PARTIAL' | 'TO_BUY';
  availability_precision: 'EXACT' | 'ESTIMATED' | 'UNSUPPORTED';
  dimension_validation_required: boolean;
}

interface MaterialAvailability {
  success: boolean;
  sufficient: boolean;
  items: MaterialAvailabilityItem[];
}

const situationLabels: Record<MaterialAvailabilityItem['status'], string> = {
  AVAILABLE: 'Disponível',
  PARTIAL: 'Parcial',
  TO_BUY: 'Comprar',
};

function situationVariant(status: MaterialAvailabilityItem['status']) {
  if (status === 'TO_BUY') return 'destructive' as const;
  if (status === 'AVAILABLE') return 'default' as const;
  return 'secondary' as const;
}

function quantityOrReview(quantity: number | null, unit: string) {
  return quantity == null ? 'A validar' : formatOperationalQuantity(quantity, unit);
}

function precisionNote(item: MaterialAvailabilityItem) {
  if (item.availability_precision === 'UNSUPPORTED') {
    return 'A área em estoque não confirma o encaixe da peça sob medida.';
  }
  if (item.availability_precision === 'ESTIMATED') {
    return 'Disponibilidade estimada por comprimento.';
  }
  return null;
}

export function OSPurchasesList({ ordemServicoId }: OSPurchasesListProps) {
  const { data: availability, isLoading } = useQuery({
    queryKey: ['os-material-availability', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_os_dynamic_material_availability', {
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

  const available = availability.items.filter((item) => item.status === 'AVAILABLE').length;
  const partial = availability.items.filter((item) => item.status === 'PARTIAL').length;
  const toBuy = availability.items.filter((item) => item.status === 'TO_BUY').length;

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
              ['Disponíveis', available],
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
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead className="text-right">Faltante</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availability.items.map((item) => {
                  const note = precisionNote(item);
                  return (
                    <TableRow key={item.requirement_id}>
                      <TableCell>
                        <div className="font-medium">{item.material_name}</div>
                        {item.variant_name ? <div className="text-xs text-muted-foreground">{item.variant_name}</div> : null}
                        {note ? <div className="max-w-xs text-xs text-muted-foreground">{note}</div> : null}
                        {item.reserved_for_this_os > 0 || item.purchase_coverage_open > 0 ? (
                          <div className="text-xs text-muted-foreground">
                            {item.reserved_for_this_os > 0
                              ? `Reservado para esta OS: ${formatOperationalQuantity(item.reserved_for_this_os, item.canonical_unit)}`
                              : null}
                            {item.reserved_for_this_os > 0 && item.purchase_coverage_open > 0 ? ' · ' : null}
                            {item.purchase_coverage_open > 0
                              ? `Em compra: ${formatOperationalQuantity(item.purchase_coverage_open, item.canonical_unit)}`
                              : null}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatOperationalQuantity(item.required_quantity, item.canonical_unit)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {quantityOrReview(item.available_for_os, item.canonical_unit)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${item.missing_quantity != null && item.missing_quantity > 0 ? 'font-semibold text-destructive' : 'text-green-600'}`}>
                        {quantityOrReview(item.missing_quantity, item.canonical_unit)}
                      </TableCell>
                      <TableCell><Badge variant={situationVariant(item.status)}>{situationLabels[item.status]}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {availability.items.map((item) => {
              const note = precisionNote(item);
              return (
                <div key={item.requirement_id} className="rounded-lg border p-3">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{item.material_name}</div>
                      {item.variant_name ? <div className="text-xs text-muted-foreground">{item.variant_name}</div> : null}
                    </div>
                    <Badge variant={situationVariant(item.status)}>{situationLabels[item.status]}</Badge>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Necessário</dt>
                      <dd>{formatOperationalQuantity(item.required_quantity, item.canonical_unit)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Disponível</dt>
                      <dd>{quantityOrReview(item.available_for_os, item.canonical_unit)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Faltante</dt>
                      <dd>{quantityOrReview(item.missing_quantity, item.canonical_unit)}</dd>
                    </div>
                  </dl>
                  {note ? <p className="mt-3 text-xs text-muted-foreground">{note}</p> : null}
                  {item.reserved_for_this_os > 0 || item.purchase_coverage_open > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.reserved_for_this_os > 0
                        ? `Reservado para esta OS: ${formatOperationalQuantity(item.reserved_for_this_os, item.canonical_unit)}`
                        : null}
                      {item.reserved_for_this_os > 0 && item.purchase_coverage_open > 0 ? ' · ' : null}
                      {item.purchase_coverage_open > 0
                        ? `Em compra: ${formatOperationalQuantity(item.purchase_coverage_open, item.canonical_unit)}`
                        : null}
                    </p>
                  ) : null}
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
