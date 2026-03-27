import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, ShoppingCart, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { checkCompositionStockAvailability, CompositionStockResult } from '@/utils/checkCompositionStock';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface QuoteItem {
  id: string;
  description: string;
  width: number | null;
  height: number | null;
  quantity: number;
  company_product_id?: string | null;
  product_template_id?: string | null;
  glass_thickness?: string | null;
  glass_color?: string | null;
  has_glass?: boolean | null;
}

interface MaterialsAvailabilityPreviewProps {
  quoteItems: QuoteItem[];
  companyId: string | undefined;
  onStockCheck?: (result: CompositionStockResult) => void;
}

const TYPE_LABELS: Record<string, string> = {
  profile: 'Perfil',
  glass: 'Vidro',
  component: 'Componente',
  accessory: 'Acessório',
  seal: 'Vedação',
  other: 'Outro',
};

export function MaterialsAvailabilityPreview({
  quoteItems,
  companyId,
  onStockCheck,
}: MaterialsAvailabilityPreviewProps) {
  const { data: result, isLoading } = useQuery({
    queryKey: ['composition-stock-check', quoteItems.map(i => i.id), companyId],
    queryFn: async () => {
      const r = await checkCompositionStockAvailability(companyId!, quoteItems);
      onStockCheck?.(r);
      return r;
    },
    enabled: !!companyId && quoteItems.length > 0,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4" />
            Verificando estoque de materiais...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!result || result.items.length === 0) {
    return null;
  }

  const formatQty = (value: number, unit: string) => {
    if (unit === 'm' || unit === 'metro' || unit === 'metros') return `${value.toFixed(2)} m`;
    if (unit === 'm²' || unit === 'm2') return `${value.toFixed(2)} m²`;
    return `${value.toFixed(value % 1 === 0 ? 0 : 2)} ${unit}`;
  };

  const stockItems = result.items.filter(a => a.origin === 'stock').length;
  const purchaseItems = result.items.filter(a => a.origin === 'purchase').length;
  const mixedItems = result.items.filter(a => a.origin === 'mixed').length;

  return (
    <div className="space-y-3 mb-4">
      {result.hasShortage && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção: {result.shortageCount} {result.shortageCount === 1 ? 'item' : 'itens'} em falta no estoque</AlertTitle>
          <AlertDescription>
            Os itens destacados abaixo não possuem quantidade suficiente em estoque para esta OS. 
            Será necessário realizar compra ou aguardar reposição.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Lista de Separação de Materiais ({result.totalItems} itens)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Material</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs text-right">Necessário</TableHead>
                <TableHead className="text-xs text-right">Disponível</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((item) => (
                <TableRow key={item.id} className={item.shortfall > 0 ? 'bg-destructive/5' : ''}>
                  <TableCell className="py-2">
                    <span className="text-xs font-medium truncate max-w-[180px] block">
                      {item.itemName}
                    </span>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {TYPE_LABELS[item.itemType] || item.itemType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-right py-2 font-mono">
                    {formatQty(item.quantityNeeded, item.unit)}
                  </TableCell>
                  <TableCell className="text-xs text-right py-2 font-mono">
                    {formatQty(item.quantityAvailable, item.unit)}
                  </TableCell>
                  <TableCell className="py-2">
                    <OriginBadge origin={item.origin} shortfall={item.shortfall} unit={item.unit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Summary */}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
            {stockItems > 0 && (
              <Badge variant="outline" className="text-xs border-green-500 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {stockItems} disponível
              </Badge>
            )}
            {purchaseItems > 0 && (
              <Badge variant="outline" className="text-xs border-red-500 text-red-600 dark:text-red-400">
                <ShoppingCart className="w-3 h-3 mr-1" />
                {purchaseItems} em falta
              </Badge>
            )}
            {mixedItems > 0 && (
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {mixedItems} parcial
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OriginBadge({ origin, shortfall, unit }: { origin: 'stock' | 'purchase' | 'mixed'; shortfall: number; unit: string }) {
  if (origin === 'stock') {
    return (
      <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 text-[10px] px-1.5">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        OK
      </Badge>
    );
  }
  if (origin === 'purchase') {
    return (
      <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 text-[10px] px-1.5">
        <ShoppingCart className="w-3 h-3 mr-1" />
        Falta total
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 text-[10px] px-1.5">
      <AlertTriangle className="w-3 h-3 mr-1" />
      Falta parcial
    </Badge>
  );
}
