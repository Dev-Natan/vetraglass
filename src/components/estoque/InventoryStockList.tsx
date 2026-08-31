import { memo } from 'react';
import {
  DollarSign,
  History,
  MoreHorizontal,
  Package,
  Power,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StockItem } from '@/types/estoque';

interface InventoryStockListProps {
  items: StockItem[];
  onEdit: (item: StockItem) => void;
  onToggleActive: (event: React.MouseEvent, companyItemId: string, currentActive: boolean) => void;
  onViewHistory: (item: StockItem) => void;
  onRegisterMovement: (item: StockItem, type: 'entrada' | 'saida') => void;
}

const formatNumber = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits });

const formatMoney = (value: number | null | undefined) =>
  value == null
    ? '—'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function itemName(item: StockItem) {
  return item.company_item?.name ?? item.item_template?.name ?? 'Item sem nome';
}

function itemCode(item: StockItem) {
  return item.company_item?.code ?? '—';
}

function stockPresentation(item: StockItem) {
  const type = (item.category_code ?? item.company_item?.type ?? item.item_template?.type ?? '').toLowerCase();
  const unit = (item.stock_unit ?? item.company_item?.unit ?? item.item_template?.unit ?? 'un').toLowerCase();

  if (type === 'profile' && item.canonical_quantity != null) {
    const meters = item.canonical_quantity / 1000;
    const bars = item.package_quantity ?? item.on_hand_bars ?? 0;
    const nominalMeters = item.nominal_length_mm ? item.nominal_length_mm / 1000 : null;
    return {
      primary: `${formatNumber(meters)} m`,
      equivalent: nominalMeters
        ? `${formatNumber(bars, 3)} barras de ${formatNumber(nominalMeters)} m`
        : `${formatNumber(bars, 3)} barras`,
    };
  }

  const unitLabel: Record<string, string> = {
    m2: 'm²',
    mm2: 'mm²',
    mm: 'mm',
    unit: 'un',
    un: 'un',
    g: 'g',
    kg: 'kg',
  };
  return {
    primary: `${formatNumber(item.quantity)} ${unitLabel[unit] ?? unit}`,
    equivalent: item.canonical_quantity != null && item.canonical_unit && item.canonical_quantity !== item.quantity
      ? `${formatNumber(item.canonical_quantity)} ${unitLabel[item.canonical_unit.toLowerCase()] ?? item.canonical_unit}`
      : '—',
  };
}

function statusFor(item: StockItem) {
  const minimum = Number(item.min_quantity ?? 0);
  if (item.quantity < 0) return { label: 'Negativo', variant: 'destructive' as const };
  if (item.quantity === 0) return { label: 'Sem estoque', variant: 'secondary' as const };
  if (minimum > 0 && item.quantity <= minimum) return { label: 'Repor', variant: 'destructive' as const };
  return { label: 'Em estoque', variant: 'outline' as const };
}

function ItemActions({ item, onEdit, onToggleActive, onViewHistory, onRegisterMovement }: InventoryStockListProps & { item: StockItem }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ações de ${itemName(item)}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => onRegisterMovement(item, 'entrada')}>
          <TrendingUp className="mr-2 h-4 w-4 text-emerald-600" /> Registrar entrada
        </DropdownMenuItem>
        <DropdownMenuItem disabled={item.quantity <= 0} onClick={() => onRegisterMovement(item, 'saida')}>
          <TrendingDown className="mr-2 h-4 w-4 text-destructive" /> Registrar saída
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(item)}>
          <DollarSign className="mr-2 h-4 w-4" /> Custos e preços
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onViewHistory(item)}>
          <History className="mr-2 h-4 w-4" /> Ver histórico
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!item.company_item_id}
          onClick={(event) => item.company_item_id && onToggleActive(event, item.company_item_id, item.is_active !== false)}
        >
          <Power className="mr-2 h-4 w-4" />
          {item.is_active !== false ? 'Desativar item' : 'Ativar item'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const InventoryStockList = memo(function InventoryStockList(props: InventoryStockListProps) {
  if (props.items.length === 0) return null;

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[120px]">Código</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Equivalência</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead>Venda</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-14 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.items.map((item) => {
              const stock = stockPresentation(item);
              const status = statusFor(item);
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{itemCode(item)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
                        {item.item_template?.image_url || item.company_item?.image_url ? (
                          <img
                            src={item.company_item?.image_url ?? item.item_template?.image_url ?? ''}
                            alt=""
                            className="h-8 w-8 object-contain"
                          />
                        ) : <Package className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="max-w-[260px] truncate font-medium">{itemName(item)}</p>
                        <p className="text-xs text-muted-foreground">{item.category_name ?? 'Sem categoria'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[210px] truncate">{item.variant_name || item.color_code || 'Padrão'}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{stock.primary}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{stock.equivalent}</TableCell>
                  <TableCell>{formatMoney(item.priceInfo?.cost ?? item.company_item?.cost ?? item.average_unit_cost)}</TableCell>
                  <TableCell>{formatMoney(item.priceInfo?.price ?? item.company_item?.sale_price)}</TableCell>
                  <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                  <TableCell className="text-right"><ItemActions {...props} item={item} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {props.items.map((item) => {
          const stock = stockPresentation(item);
          const status = statusFor(item);
          return (
            <article key={item.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{itemName(item)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {itemCode(item)} · {item.variant_name || item.color_code || 'Padrão'}
                  </p>
                </div>
                <ItemActions {...props} item={item} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Estoque</p>
                  <p className="font-semibold tabular-nums">{stock.primary}</p>
                  {stock.equivalent !== '—' && <p className="text-xs text-muted-foreground">{stock.equivalent}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Venda</p>
                  <p className="font-medium">{formatMoney(item.priceInfo?.price ?? item.company_item?.sale_price)}</p>
                  <Badge variant={status.variant} className="mt-1">{status.label}</Badge>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => props.onRegisterMovement(item, 'entrada')}>
                  <TrendingUp className="mr-2 h-4 w-4 text-emerald-600" /> Entrada
                </Button>
                <Button variant="outline" size="sm" disabled={item.quantity <= 0} onClick={() => props.onRegisterMovement(item, 'saida')}>
                  <TrendingDown className="mr-2 h-4 w-4 text-destructive" /> Saída
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
});
