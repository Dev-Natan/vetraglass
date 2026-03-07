import { memo } from 'react';
import { Package, MapPin, DollarSign, Power, Scissors, Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { StockItem } from '@/hooks/useStockData';

const unitLabels: Record<string, string> = {
  un: 'un',
  m: 'm',
  ml: 'm',
  m2: 'm²',
  'metro linear': 'm',
  'metro quadrado': 'm²',
  kg: 'kg',
  barra: 'barras',
  pç: 'pç',
  pc: 'pç',
};

const itemTypeLabels: Record<string, string> = {
  glass: 'Vidro',
  profile: 'Perfil',
  accessory: 'Acessório',
  service: 'Serviço',
};

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
  return (
    <div
      className={`flex items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer ${
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
          </div>
          {item.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              {item.location}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
            {(() => {
              const cost = item.priceInfo?.cost ?? item.company_item?.cost ?? 0;
              const price = item.priceInfo?.price ?? item.company_item?.sale_price ?? 0;
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
          <p className="font-semibold text-lg">
            {item.quantity}{' '}
            <span className="text-sm text-muted-foreground">{item.item_template?.unit || item.company_item?.unit}</span>
          </p>
          {(item.min_quantity ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">Mín: {item.min_quantity}</p>
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
  // Custom comparison for better performance
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.quantity === nextProps.item.quantity &&
    prevProps.item.is_active === nextProps.item.is_active &&
    prevProps.item.min_quantity === nextProps.item.min_quantity &&
    prevProps.item.priceInfo?.cost === nextProps.item.priceInfo?.cost &&
    prevProps.item.priceInfo?.price === nextProps.item.priceInfo?.price &&
    prevProps.item.company_item?.cost === nextProps.item.company_item?.cost &&
    prevProps.item.company_item?.sale_price === nextProps.item.company_item?.sale_price &&
    prevProps.showActivateBtn === nextProps.showActivateBtn
  );
});
