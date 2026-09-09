import { useQuery } from '@tanstack/react-query';
import { Ruler } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  basicProfilePurchasePlan,
  canonicalMaterialQuantity,
  formatOperationalQuantity,
  resolveCanonicalMaterialType,
} from '@/utils/osMaterialStatus';

interface OSProfilePreparationListProps {
  ordemServicoId: string;
}

interface CutRequirement {
  quantity: number;
  lengthMm: number;
}

function parseCutRequirements(notes: string | null): CutRequirement[] {
  if (!notes) return [];
  return notes
    .split(', ')
    .map((value) => {
      const match = value.match(/(\d+)x\s*(\d+)mm/i);
      return match
        ? { quantity: Number.parseInt(match[1], 10), lengthMm: Number.parseInt(match[2], 10) }
        : null;
    })
    .filter((cut): cut is CutRequirement => cut !== null);
}

export function OSProfilePreparationList({ ordemServicoId }: OSProfilePreparationListProps) {
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['os-profile-preparation', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_materials')
        .select('*')
        .eq('ordem_servico_id', ordemServicoId)
        .order('item_name');
      if (error) throw error;
      return (data ?? []).filter(
        (material) => resolveCanonicalMaterialType(material.item_type, material.unit) === 'profile',
      );
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!profiles.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Ruler className="h-5 w-5" />
          Preparação dos perfis
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">
        {profiles.map((profile) => {
          const canonical = canonicalMaterialQuantity(profile.required_quantity, profile.unit, 'profile');
          const plan = basicProfilePurchasePlan(canonical.quantity, profile.bar_length_mm);
          const cuts = parseCutRequirements(profile.notes);

          return (
            <div key={profile.id} className="rounded-lg border p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-semibold">{profile.item_name}</h4>
                {plan ? (
                  <Badge variant="outline">
                    {plan.barsNeeded} {plan.barsNeeded === 1 ? 'barra' : 'barras'}
                  </Badge>
                ) : null}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Necessário</dt>
                  <dd className="font-medium">{formatOperationalQuantity(canonical.quantity, canonical.unit)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Barra nominal</dt>
                  <dd>{profile.bar_length_mm ? formatOperationalQuantity(profile.bar_length_mm, 'MM') : 'Não definida'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Barras necessárias</dt>
                  <dd>{plan?.barsNeeded ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Sobra teórica</dt>
                  <dd>{plan ? formatOperationalQuantity(plan.theoreticalWasteMm, 'MM') : '—'}</dd>
                </div>
              </dl>

              <div className="mt-4 border-t pt-3">
                {cuts.length ? (
                  <div className="flex flex-wrap gap-2">
                    {cuts.map((cut, index) => (
                      <Badge key={`${cut.lengthMm}-${cut.quantity}-${index}`} variant="secondary">
                        {cut.quantity}x {cut.lengthMm} mm
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Detalhamento de corte ainda não disponível.</p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
