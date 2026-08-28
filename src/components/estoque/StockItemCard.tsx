import { memo } from 'react';
import { Package, MapPin, DollarSign, Power, Scissors, Sparkles, Clock, AlertTriangle, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { StockItem } from '@/types/estoque';
import { formatGlassName, isGlassUnit } from '@/utils/glassName';


const itemTypeLabels: Record<string, string> = {
  glass: 'Vidro',
  profile: 'Perfil',
  accessory: 'Acessório',
  service: 'Serviço',
};

function formatQuantityDisplay(item: StockItem) {
  const rawUnit = (item.item_template?.unit || item.company_item?.unit || 'un').toLowerCase().trim();
  const qty = item.quantity;
  const barLengthMm = item.nominal_length_mm ?? item.company_item?.bar_length_mm ?? item.item_template?.bar_length_mm;
  const type = item.item_template?.type || item.company_item?.type || '';

  // Perfis: metro é a autoridade física; barras e peso são equivalências matemáticas.
  if (barLengthMm && barLengthMm > 0 && (type === 'profile' || rawUnit === 'barra' || rawUnit === 'barras')) {
    const barLengthM = barLengthMm / 1000;
    const totalMeters = Number(item.canonical_quantity || 0) / 1000;
    const bars = Number(item.package_quantity || 0);
    const fmtTotal = Number.isInteger(totalMeters) ? totalMeters : totalMeters.toFixed(2);
    const fmtBar = Number.isInteger(barLengthM) ? barLengthM : barLengthM.toFixed(2);
    return {
      primary: `${fmtTotal} m`,
      detail: `barra nominal de ${fmtBar} m · ≈ ${Number(bars).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} barras`,
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
  onViewHistory?: (item: StockItem) => void;
  showActivateBtn?: boolean;
}

function formatEquivalent(value: number | null | undefined, unit: string) {
  if (value == null) return null;
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unit}`;
}

export const StockItemCard = memo(function StockItemCard({
  item,
  onEdit,
  onToggleActive,
  onViewHistory,
  showActivateBtn = true,
}: StockItemCardProps) {
  const qtyDisplay = formatQuantityDisplay(item);
  const minQty = item.min_quantity ?? 0;
  const isZeroStock = item.quantity <= 0;
  const isLowStock = !isZeroStock && minQty > 0 && item.quantity <= minQty;

  const borderClass = (isZeroStock || isLowStock)
    ? 'border-destructive/60 bg-destructive/5'
    : '';

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer ${borderClass} ${
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
            <p className="font-medium truncate">{(() => {
              const ci = item.company_item;
              const baseName = item.item_template?.name ?? ci?.name ?? 'Item';
              const unit = item.item_template?.unit || ci?.unit;
              const type = item.item_template?.type || ci?.type;
              if (isGlassUnit(unit) || type === 'glass') {
                return formatGlassName(baseName, ci?.glass_color, ci?.thickness_mm);
              }
              return baseName;
            })()}</p>

            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
              {itemTypeLabels[item.item_template?.type || item.company_item?.type || ''] || item.item_template?.type || item.company_item?.type}
            </span>
            {item.company_item?.is_custom && (
              <Badge variant="outline" className="text-xs border-primary/50 text-primary shrink-0 gap-1">
                <Sparkles className="w-3 h-3" />
                Personalizado
              </Badge>
            )}
            {item.variant_name && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {item.variant_name}
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
              <Badge variant="destructive" className="text-xs shrink-0 gap-1">
                <AlertTriangle className="w-3 h-3" />
                Abaixo do mínimo
              </Badge>
            )}
          </div>
          {item.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              {item.location}
            </p>
          )}
          {item.locations && item.locations.length > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              {item.locations.map((location) => `${location.name}${location.needs_review ? ' (revisar)' : ''}`).join(' · ')}
            </p>
          )}
          {(item.line_name || item.nominal_length_mm || item.weight_per_meter_kg) && (
            <p className="text-xs text-muted-foreground mt-1">
              {[
                item.line_name ? `Linha: ${item.line_name}` : null,
                item.nominal_length_mm ? `Barra: ${Number(item.nominal_length_mm) / 1000} m` : null,
                item.weight_per_meter_kg ? `Peso: ${Number(item.weight_per_meter_kg).toLocaleString('pt-BR')} kg/m` : null,
              ].filter(Boolean).join(' · ')}
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
            {item.average_unit_cost != null && (
              <span className="text-muted-foreground">
                Custo médio físico: R$ {Number(item.average_unit_cost).toFixed(2)}/{item.consumption_unit}
              </span>
            )}
            {item.inventory_value != null && item.average_unit_cost != null && (
              <span className="font-medium">Valor físico: R$ {Number(item.inventory_value).toFixed(2)}</span>
            )}
            {item.quantity > 0 && item.average_unit_cost == null && (
              <span className="text-muted-foreground">Custo físico não disponível</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <div className="text-right">
          <p className={`font-semibold text-lg whitespace-nowrap ${(isZeroStock || isLowStock) ? 'text-destructive' : ''}`}>
            {qtyDisplay.primary}
          </p>
          {qtyDisplay.detail && (
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {qtyDisplay.detail}
            </p>
          )}
          {item.reserved_quantity > 0 && (
            <p className="text-xs text-amber-700 whitespace-nowrap">
              Reservado: {item.reserved_quantity.toFixed(3)} {item.consumption_unit || item.item_template?.unit}
            </p>
          )}
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            Disponível: {Math.max(0, item.quantity - item.reserved_quantity).toFixed(3)} {item.consumption_unit || item.item_template?.unit}
          </p>
          {[formatEquivalent(item.on_hand_bars, 'barras'), formatEquivalent(item.on_hand_meters, 'm'), formatEquivalent(item.on_hand_kg, 'kg')]
            .filter(Boolean).length > 0 && (
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {[item.on_hand_bars == null ? null : `≈ ${formatEquivalent(item.on_hand_bars, 'barras')}`, formatEquivalent(item.on_hand_kg, 'kg')]
                .filter(Boolean).join(' · ')}
            </p>
          )}
          {minQty > 0 && (
            <p className={`text-xs ${(isLowStock || isZeroStock) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              Mín: {item.min_quantity}
            </p>
          )}
        </div>

        {onViewHistory && (
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={(e) => { e.stopPropagation(); onViewHistory(item); }}
            title="Ver histórico de movimentações"
          >
            <History className="w-4 h-4" />
          </Button>
        )}

        {showActivateBtn && (
          <Button
            variant={item.is_active !== false ? 'outline' : 'default'}
            size="icon"
            className="shrink-0"
            onClick={(e) => item.company_item_id && onToggleActive(e, item.company_item_id, item.is_active !== false)}
            disabled={!item.company_item_id}
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
    prevProps.item.canonical_quantity === nextProps.item.canonical_quantity &&
    prevProps.item.package_quantity === nextProps.item.package_quantity &&
    prevProps.item.reserved_quantity === nextProps.item.reserved_quantity &&
    prevProps.item.inventory_value === nextProps.item.inventory_value &&
    prevProps.item.variant_name === nextProps.item.variant_name &&
    prevProps.item.on_hand_bars === nextProps.item.on_hand_bars &&
    prevProps.item.on_hand_meters === nextProps.item.on_hand_meters &&
    prevProps.item.on_hand_kg === nextProps.item.on_hand_kg &&
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
