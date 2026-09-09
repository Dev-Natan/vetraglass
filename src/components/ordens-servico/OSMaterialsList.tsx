import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import {
  canonicalMaterialQuantity,
  materialTypeLabel,
  resolveCanonicalMaterialType,
} from '@/utils/osMaterialStatus';

interface OSMaterialsListProps {
  ordemServicoId: string;
}

type MaterialRow = Tables<'os_materials'> & {
  os_items: { product_name: string } | null;
};

const quantityFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

function displayQuantity(quantity: number, unit: string): string {
  if (unit === 'MM') return quantityFormatter.format(quantity / 1_000);
  if (unit === 'MM2') return quantityFormatter.format(quantity / 1_000_000);
  return quantityFormatter.format(quantity);
}

function displayUnit(unit: string): string {
  if (unit === 'MM') return 'm';
  if (unit === 'MM2') return 'm²';
  if (unit === 'UNIT' || unit === 'UN') return 'un';
  return unit.toLowerCase();
}

export function OSMaterialsList({ ordemServicoId }: OSMaterialsListProps) {
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['os-materials', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_materials')
        .select('*, os_items!os_materials_os_item_id_fkey(product_name)')
        .eq('ordem_servico_id', ordemServicoId)
        .order('item_name');

      if (error) throw error;
      return (data ?? []) as MaterialRow[];
    },
  });

  const groups = useMemo(() => {
    const grouped = new Map<string, { name: string; materials: MaterialRow[] }>();

    for (const material of materials) {
      const key = material.os_item_id ?? 'os';
      const current = grouped.get(key);
      if (current) {
        current.materials.push(material);
      } else {
        grouped.set(key, {
          name: material.os_items?.product_name ?? 'Materiais gerais da OS',
          materials: [material],
        });
      }
    }

    return Array.from(grouped.entries());
  }, [materials]);

  const totals = useMemo(
    () => materials.reduce(
      (summary, material) => {
        summary[resolveCanonicalMaterialType(material.item_type, material.unit)] += 1;
        return summary;
      },
      { profile: 0, glass: 0, accessory: 0 },
    ),
    [materials],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!materials.length) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <p className="font-medium text-foreground">Snapshot de materiais indisponível</p>
          <p className="mt-1 text-sm">
            A composição histórica desta OS não pode ser recalculada pelo catálogo atual.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5" />
            Materiais técnicos da OS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xl font-bold">{totals.profile}</div>
              <div className="text-xs text-muted-foreground">Perfis</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xl font-bold">{totals.glass}</div>
              <div className="text-xs text-muted-foreground">Vidros</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xl font-bold">{totals.accessory}</div>
              <div className="text-xs text-muted-foreground">Acessórios</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {groups.map(([groupKey, group]) => (
        <Card key={groupKey}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{group.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Necessário</TableHead>
                    <TableHead>Unidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.materials.map((material) => {
                    const type = resolveCanonicalMaterialType(material.item_type, material.unit);
                    const canonical = canonicalMaterialQuantity(material.required_quantity, material.unit, type);
                    return (
                      <TableRow key={material.id}>
                        <TableCell className="font-medium">{material.item_name}</TableCell>
                        <TableCell><Badge variant="outline">{materialTypeLabel(type)}</Badge></TableCell>
                        <TableCell className="text-right font-mono">
                          {displayQuantity(canonical.quantity, canonical.unit)}
                        </TableCell>
                        <TableCell>{displayUnit(canonical.unit)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 md:hidden">
              {group.materials.map((material) => {
                const type = resolveCanonicalMaterialType(material.item_type, material.unit);
                const canonical = canonicalMaterialQuantity(material.required_quantity, material.unit, type);
                return (
                  <div key={material.id} className="rounded-lg border p-3">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <span className="font-medium">{material.item_name}</span>
                      <Badge variant="outline">{materialTypeLabel(type)}</Badge>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Necessário</dt>
                        <dd className="font-mono">{displayQuantity(canonical.quantity, canonical.unit)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Unidade</dt>
                        <dd>{displayUnit(canonical.unit)}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
