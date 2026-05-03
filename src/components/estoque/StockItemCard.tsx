import { memo } from 'react';
import { Package, MapPin, DollarSign, Power, Scissors, Sparkles, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { StockItem } from '@/types/estoque';

const itemTypeLabels: Record<string, string> = {
  glass: 'Vidro',
  profile: 'Perfil',
  accessory: 'Acessório',
  service: 'Serviço',
};

function formatQuantityDisplay(item: StockItem) {
  const rawUnit = (item.item_template?.unit || item.company_item?.unit || 'un').toLowerCase().trim();
  const qty = item.quantity;
  const barLengthMm = item.company_item?.bar_length_mm;
  const type = item.item_template?.type || item.company_item?.type || '';

  // Profiles with bar_length_mm: show "X barras de Y m = Z m"
  if (barLengthMm && barLengthMm > 0 && (type === 'profile' || rawUnit === 'barra' || rawUnit === 'barras')) {
    const barLengthM = barLengthMm / 1000;
    const totalMeters = qty * barLengthM;
    const fmtQty = Number.isInteger(qty) ? qty : qty.toFixed(2);
    const fmtTotal = Number.isInteger(totalMeters) ? totalMeters : totalMeters.toFixed(2);
    const fmtBar = Number.isInteger(barLengthM) ? barLengthM : barLengthM.toFixed(2);
    return {
      primary: `${fmtQty} ${qty === 1 ? 'barra' : 'barras'}`,
      detail: `de ${fmtBar} m = ${fmtTotal} m`,
    };
  }

  // Glass (m²)
  if (rawUnit === 'm2' || rawUnit === 'metro quadrado') {
    const fmtQty = Number.isInteger(qty) ? qty : qty.toFixed(2);
    return { primary: `${fmtQty} m²`, detail: null };
  }

  // Linear meter
  if (rawUnit === 'm' || rawUnit === 'ml' || rawUnit === 'metro linear') {
    const fmtQty = Number.isInteger(qty) ? qty : qty.toFixed(2);
    return { primary: `${fmtQty} m`, detail: null };
  }

  // Kg
  if (rawUnit === 'kg') {
    const fmtQty = Number.isInteger(qty) ? qty : qty.toFixed(2);
    return { primary: `${fmtQty} kg`, detail: null };
  }

  // Default (un, pç, etc.)
  const unitMap: Record<string, string> = { un: 'un', pç: 'pç', pc: 'pç' };
  const displayUnit = unitMap[rawUnit] || rawUnit;
  const fmtQty = Number.isInteger(qty) ? qty : qty.toFixed(2);
  return { primary: `${fmtQty} ${displayUnit}`, detail: null };
}

interface StockItemCardProps {
  item: StockItem;
  onEdit: (item: StockItem) => void;
  onToggleActive: (e: React.MouseEvent, stockId: string, currentActive: boolean) => void;
  showActivateBtn?: boolean;
}

export const StockItemCard = memo(function StockItemCard({
  item,
  onEdit,
  onToggleActive,
  showActivateBtn = true,
}: StockItemCardProps) {
  const qtyDisplay = formatQuantityDisplay(item);
  const minQty = item.min_quantity ?? 0;
  const isZeroStock = item.quantity <= 0;
  const isLowStock = !isZeroStock && minQty > 0 && item.quantity <= minQty;

  const borderClass = isZeroStock
    ? 'border-destructive/60 bg-destructive/5'
    : isLowStock
      ? 'border-amber-500/60 bg-amber-50/50 dark:bg-amber-950/20'
      : '';

  return (
    <div
      className={`flex items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer ${borderClass} ${
        item.is_active === false ? 'opacity-60' : ''
      }`}
      onClick={() => onEdit(item)}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {item.item_template?.image_url ? (
          <div className="h-12 w-12 rounded-md border bg-white p-1 flex items-center justify-center shrink-0">
            <img
              src={item.item_template.image_url}
              alt={item.item_template?.name ?? 'Item'}
              loading="lazy"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="h-12 w-12 rounded-md border bg-background flex items-center justify-center shrink-0">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <p className="font-medium truncate">{item.item_template?.name ?? item.company_item?.name ?? 'Item'}</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
              {itemTypeLabels[item.item_template?.type || item.company_item?.type || ''] || item.item_template?.type || item.company_item?.type}
            </span>
            {item.company_item?.is_custom && (
              <Badge variant="outline" className="text-xs border-primary/50 text-primary shrink-0 gap-1">
                <Sparkles className="w-3 h-3" />
                Personalizado
              </Badge>
            )}
            {item.allow_fractional && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0 flex items-center gap-1" title="Venda fracionada habilitada">
                <Scissors className="w-3 h-3" />
                Fracionado
              </span>
            )}
            {isZeroStock && (
              <Badge variant="destructive" className="text-xs shrink-0 gap-1">
                <AlertTriangle className="w-3 h-3" />
                Sem estoque
              </Badge>
            )}
            {isLowStock && (
              <Badge variant="outline" className="text-xs shrink-0 gap-1 border-amber-500 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                Estoque baixo
              </Badge>
            )}
          </div>
          {item.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              {item.location}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
            {(() => {
              const cost = item.priceInfo?.cost ?? item.company_item?.cost ?? item.item_template?.default_cost ?? 0;
              const templatePrice = item.item_template?.type === 'profile' ? item.item_template?.default_sale_price : item.item_template?.default_price;
              const price = item.priceInfo?.price ?? item.company_item?.sale_price ?? templatePrice ?? 0;
              if (cost > 0 || price > 0) {
                return (
                  <>
                    {cost > 0 && (
                      <span className="text-muted-foreground">
                        Custo: R$ {Number(cost).toFixed(2)}
                      </span>
                    )}
                    {price > 0 && (
                      <span className="text-green-600 font-medium">
                        Venda: R$ {Number(price).toFixed(2)}
                      </span>
                    )}
                  </>
                );
              }
              return (
                <span className="text-muted-foreground/70 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Clique para definir preços
                </span>
              );
            })()}
            {item.updated_at && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Atualizado: {format(new Date(item.updated_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className={`font-semibold text-lg whitespace-nowrap ${isZeroStock ? 'text-destructive' : isLowStock ? 'text-amber-600 dark:text-amber-400' : ''}`}>
            {qtyDisplay.primary}
          </p>
          {qtyDisplay.detail && (
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {qtyDisplay.detail}
            </p>
          )}
          {minQty > 0 && (
            <p className={`text-xs ${isLowStock || isZeroStock ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
              Mín: {item.min_quantity}
            </p>
          )}
        </div>

        {showActivateBtn && (
          <Button
            variant={item.is_active !== false ? 'outline' : 'default'}
            size="icon"
            className="shrink-0"
            onClick={(e) => onToggleActive(e, item.id, item.is_active !== false)}
            title={item.is_active !== false ? 'Desativar item' : 'Ativar item'}
          >
            <Power className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.quantity === nextProps.item.quantity &&
    prevProps.item.is_active === nextProps.item.is_active &&
    prevProps.item.min_quantity === nextProps.item.min_quantity &&
    prevProps.item.priceInfo?.cost === nextProps.item.priceInfo?.cost &&
    prevProps.item.priceInfo?.price === nextProps.item.priceInfo?.price &&
    prevProps.item.company_item?.cost === nextProps.item.company_item?.cost &&
    prevProps.item.company_item?.sale_price === nextProps.item.company_item?.sale_price &&
    prevProps.item.item_template?.default_cost === nextProps.item.item_template?.default_cost &&
    prevProps.item.item_template?.default_price === nextProps.item.item_template?.default_price &&
    prevProps.item.item_template?.default_sale_price === nextProps.item.item_template?.default_sale_price &&
    prevProps.item.company_item?.bar_length_mm === nextProps.item.company_item?.bar_length_mm &&
    prevProps.showActivateBtn === nextProps.showActivateBtn
  );
});
