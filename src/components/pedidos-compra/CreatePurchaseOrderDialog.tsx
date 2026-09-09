import { useMemo, useRef, useState } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MaterialPurchaseRequirement,
  PurchaseRequirementLine,
  useCreatePurchaseOrderFromRequirements,
  useMaterialPurchaseRequirements,
} from '@/hooks/usePurchaseOrders';
import { createUuid } from '@/utils/createUuid';
import { formatOperationalQuantity, formatPurchaseQuantity } from '@/utils/osMaterialStatus';

interface CreatePurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RequirementGroup {
  key: string;
  itemName: string;
  purchaseUnit: string;
  purchaseQuantity: number;
  companyItemId: string;
  variantId: string | null;
  requirements: MaterialPurchaseRequirement[];
}

function groupRequirements(requirements: MaterialPurchaseRequirement[]): RequirementGroup[] {
  const groups = new Map<string, RequirementGroup>();

  for (const requirement of requirements) {
    const key = `${requirement.company_item_id}:${requirement.variant_id || 'default'}`;
    const current = groups.get(key);
    if (current) {
      current.requirements.push(requirement);
      const canonical = current.requirements.reduce(
        (sum, item) => sum + item.purchase_required_canonical_quantity,
        0,
      );
      const rawPurchaseQuantity = canonical / requirement.purchase_to_canonical_factor;
      current.purchaseQuantity = requirement.purchase_allows_fractional
        ? rawPurchaseQuantity
        : Math.ceil(rawPurchaseQuantity);
      continue;
    }

    const rawPurchaseQuantity =
      requirement.purchase_required_canonical_quantity / requirement.purchase_to_canonical_factor;
    groups.set(key, {
      key,
      itemName: requirement.item_name,
      purchaseUnit: requirement.purchase_unit,
      purchaseQuantity: requirement.purchase_allows_fractional
        ? rawPurchaseQuantity
        : Math.ceil(rawPurchaseQuantity),
      companyItemId: requirement.company_item_id,
      variantId: requirement.variant_id,
      requirements: [requirement],
    });
  }

  return Array.from(groups.values());
}

export function CreatePurchaseOrderDialog({
  open,
  onOpenChange,
}: CreatePurchaseOrderDialogProps) {
  const { data: requirements = [], isLoading } = useMaterialPurchaseRequirements();
  const createOrder = useCreatePurchaseOrderFromRequirements();
  const idempotencyKey = useRef(createUuid());
  const [supplierName, setSupplierName] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [estimatedCosts, setEstimatedCosts] = useState<Record<string, number>>({});

  const selectedRequirements = useMemo(
    () => requirements.filter((requirement) => selectedIds.has(requirement.id)),
    [requirements, selectedIds],
  );
  const groups = useMemo(() => groupRequirements(selectedRequirements), [selectedRequirements]);

  const toggleRequirement = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const reset = () => {
    setSupplierName('');
    setExpectedDelivery('');
    setNotes('');
    setSelectedIds(new Set());
    setEstimatedCosts({});
    idempotencyKey.current = createUuid();
  };

  const handleSubmit = async () => {
    if (!supplierName.trim() || groups.length === 0) return;

    const lines: PurchaseRequirementLine[] = groups.map((group) => ({
      companyItemId: group.companyItemId,
      variantId: group.variantId,
      description: group.itemName,
      purchaseQuantity: group.purchaseQuantity,
      purchaseUnit: group.purchaseUnit,
      estimatedCost: Number(estimatedCosts[group.key] || 0),
      allocations: group.requirements.map((requirement) => ({
        requirementId: requirement.id,
        canonicalQuantity: requirement.purchase_required_canonical_quantity,
      })),
    }));

    await createOrder.mutateAsync({
      supplierName: supplierName.trim(),
      expectedDelivery: expectedDelivery || undefined,
      notes: notes.trim() || undefined,
      idempotencyKey: idempotencyKey.current,
      lines,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !createOrder.isPending) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-4xl" aria-describedby="create-purchase-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Consolidar necessidades em pedido
          </DialogTitle>
          <p id="create-purchase-description" className="text-sm text-muted-foreground">
            Selecione faltas de uma ou mais OS. A origem de cada necessidade permanecerá vinculada ao item.
          </p>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="purchase-supplier">Fornecedor</Label>
            <Input
              id="purchase-supplier"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              placeholder="Fornecedor do pedido"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchase-delivery">Previsão de entrega</Label>
            <Input
              id="purchase-delivery"
              type="date"
              value={expectedDelivery}
              onChange={(event) => setExpectedDelivery(event.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="max-h-[430px] rounded-md border">
          <div className="space-y-2 p-3">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : requirements.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Não há necessidades de compra pendentes.
              </p>
            ) : (
              requirements.map((requirement) => (
                <label
                  key={requirement.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selectedIds.has(requirement.id)}
                    onCheckedChange={(checked) => toggleRequirement(requirement.id, checked === true)}
                    aria-label={`Selecionar ${requirement.item_name} da OS ${requirement.os_number}`}
                  />
                  <span className="flex-1">
                    <span className="block font-medium">{requirement.item_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      OS #{String(requirement.os_number).padStart(4, '0')} · falta{' '}
                      {formatOperationalQuantity(requirement.purchase_required_canonical_quantity, requirement.canonical_unit)}
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    {formatPurchaseQuantity(requirement.suggested_purchase_quantity, requirement.purchase_unit)}
                  </span>
                </label>
              ))
            )}
          </div>
        </ScrollArea>

        {groups.length > 0 ? (
          <div className="space-y-2">
            <Label>Itens consolidados</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {groups.map((group) => (
                <div key={group.key} className="rounded-lg border p-3">
                  <div className="text-sm font-medium">{group.itemName}</div>
                  <div className="mb-2 text-xs text-muted-foreground">
                    {formatPurchaseQuantity(group.purchaseQuantity, group.purchaseUnit)} ·{' '}
                    {group.requirements.length} OS/necessidade(s)
                  </div>
                  <Label htmlFor={`cost-${group.key}`} className="text-xs">
                    Custo estimado total
                  </Label>
                  <Input
                    id={`cost-${group.key}`}
                    type="number"
                    min={0}
                    step={0.01}
                    value={estimatedCosts[group.key] || ''}
                    onChange={(event) => setEstimatedCosts((current) => ({
                      ...current,
                      [group.key]: Number(event.target.value),
                    }))}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="purchase-notes">Observações</Label>
          <Input
            id="purchase-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Opcional"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createOrder.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createOrder.isPending || !supplierName.trim() || groups.length === 0}
          >
            {createOrder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Criar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
