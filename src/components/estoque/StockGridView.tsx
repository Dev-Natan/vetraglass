import { memo } from 'react';
import { Package, AlertTriangle, Power, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { StockItem } from '@/types/estoque';

interface StockGridViewProps {
  items: StockItem[];
  onEdit: (item: StockItem) => void;
  onToggleActive: (e: React.MouseEvent, stockId: string, currentActive: boolean) => void;
  onRegisterMovement?: (item: StockItem, type: 'entrada' | 'saida') => void;
}

const StockGridCard = memo(function StockGridCard({
  item,
  onEdit,
  onToggleActive,
  onRegisterMovement,
}: {
  item: StockItem;
  onEdit: (item: StockItem) => void;
  onToggleActive: (e: React.MouseEvent, stockId: string, currentActive: boolean) => void;
  onRegisterMovement?: (item: StockItem, type: 'entrada' | 'saida') => void;
}) {
  const isLowStock = item.quantity <= (item.min_quantity || 0) && (item.min_quantity || 0) > 0;
  const isZeroStock = item.quantity === 0;

  return (
    <div
      className={`relative flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer ${
        (isZeroStock || isLowStock) ? 'border-destructive/60 bg-destructive/5' : ''
      } ${item.is_active === false ? 'opacity-60' : ''}`}
      onClick={() => onEdit(item)}
    >
      {/* Status Badges */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
        {item.company_item?.is_custom && (
          <Badge variant="outline" className="text-xs border-primary/50 text-primary gap-1">
            <Sparkles className="w-3 h-3" />
          </Badge>
        )}
        {isZeroStock && (
          <Badge variant="destructive" className="text-xs">
            Zerado
          </Badge>
        )}
        {isLowStock && !isZeroStock && (
          <Badge variant="destructive" className="text-xs gap-1">
            <AlertTriangle className="w-3 h-3" />
            Abaixo do mín.
          </Badge>
        )}
      </div>

      {/* Image */}
      <div className="h-20 w-20 rounded-md border bg-white p-2 flex items-center justify-center mb-3">
        {item.item_template?.image_url ? (
          <img
            src={item.item_template.image_url}
            alt={item.item_template?.name ?? 'Item'}
            loading="lazy"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <Package className="h-10 w-10 text-muted-foreground/50" />
        )}
      </div>

      {/* Name */}
      <p className="font-medium text-sm text-center line-clamp-2 mb-1">
        {item.item_template?.name ?? item.company_item?.name ?? 'Item'}
      </p>
      {item.variant_name && <p className="text-xs text-muted-foreground mb-1">{item.variant_name}</p>}

      {/* Quantity */}
      <p className={`text-lg font-bold ${(isZeroStock || isLowStock) ? 'text-destructive' : ''}`}>
        {item.quantity} <span className="text-xs text-muted-foreground font-normal">{item.item_template?.unit}</span>
      </p>
      {(item.min_quantity || 0) > 0 && (
        <p className={`text-[10px] ${(isZeroStock || isLowStock) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
          Mín: {item.min_quantity}
        </p>
      )}

      {/* Price Info */}
      {item.priceInfo && item.priceInfo.price > 0 && (
        <p className="text-xs text-green-600 mt-1">
          R$ {Number(item.priceInfo.price).toFixed(2)}
        </p>
      )}

      {/* Toggle Button */}
      {onRegisterMovement && (
        <div className="absolute bottom-2 left-2 flex gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={(event) => { event.stopPropagation(); onRegisterMovement(item, 'entrada'); }} title="Registrar entrada deste item">
            <TrendingUp className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={(event) => { event.stopPropagation(); onRegisterMovement(item, 'saida'); }} disabled={item.quantity <= 0} title="Registrar saída deste item">
            <TrendingDown className="w-3 h-3" />
          </Button>
        </div>
      )}

      <Button
        variant={item.is_active !== false ? 'outline' : 'default'}
        size="sm"
        className="absolute bottom-2 right-2 h-7 w-7 p-0"
        onClick={(e) => item.company_item_id && onToggleActive(e, item.company_item_id, item.is_active !== false)}
        disabled={!item.company_item_id}
        title={item.is_active !== false ? 'Desativar' : 'Ativar'}
      >
        <Power className="w-3 h-3" />
      </Button>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.quantity === nextProps.item.quantity &&
    prevProps.item.is_active === nextProps.item.is_active &&
    prevProps.item.min_quantity === nextProps.item.min_quantity
  );
});

export const StockGridView = memo(function StockGridView({
  items,
  onEdit,
  onToggleActive,
  onRegisterMovement,
}: StockGridViewProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-foreground mb-1">Nenhum item encontrado</h3>
        <p className="text-sm text-muted-foreground">
          Tente ajustar os filtros ou adicione novos itens.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map((item) => (
        <StockGridCard
          key={item.id}
          item={item}
          onEdit={onEdit}
          onToggleActive={onToggleActive}
          onRegisterMovement={onRegisterMovement}
        />
      ))}
    </div>
  );
});
