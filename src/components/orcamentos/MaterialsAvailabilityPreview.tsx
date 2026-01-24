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
import { checkAllMaterialsAvailability, MaterialAvailability } from '@/utils/checkGlassStock';

interface QuoteItem {
  id: string;
  description: string;
  width: number | null;
  height: number | null;
  quantity: number;
  glass_thickness?: string | null;
  glass_color?: string | null;
  has_glass?: boolean | null;
  product_template_id?: string | null;
}

interface MaterialsAvailabilityPreviewProps {
  quoteItems: QuoteItem[];
  companyId: string | undefined;
}

export function MaterialsAvailabilityPreview({
  quoteItems,
  companyId,
}: MaterialsAvailabilityPreviewProps) {
  const { data: availability, isLoading } = useQuery({
    queryKey: ['materials-availability', quoteItems.map(i => i.id), companyId],
    queryFn: () => checkAllMaterialsAvailability(quoteItems, companyId!),
    enabled: !!companyId && quoteItems.length > 0,
    staleTime: 30000, // 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4" />
            Verificando estoque...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!availability || availability.length === 0) {
    return null;
  }

  const hasStockItems = availability.filter(a => a.origin === 'stock').length;
  const hasMixedItems = availability.filter(a => a.origin === 'mixed').length;
  const hasPurchaseItems = availability.filter(a => a.origin === 'purchase').length;

  const formatArea = (value: number) => `${value.toFixed(2)} m²`;

  return (
    <Card className="mb-4 border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Materiais para esta OS
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Material</TableHead>
              <TableHead className="text-xs text-right">Necessário</TableHead>
              <TableHead className="text-xs text-right">Estoque</TableHead>
              <TableHead className="text-xs">Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {availability.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="py-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium truncate max-w-[200px]">
                      {item.description}
                    </span>
                    {(item.glassType || item.glassColor) && (
                      <span className="text-[10px] text-muted-foreground">
                        {[item.glassType, item.glassColor].filter(Boolean).join(' ')}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-right py-2">
                  {formatArea(item.needed)}
                </TableCell>
                <TableCell className="text-xs text-right py-2">
                  {formatArea(item.available)}
                </TableCell>
                <TableCell className="py-2">
                  <OriginBadge origin={item.origin} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Summary */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
          {hasStockItems > 0 && (
            <Badge variant="outline" className="text-xs border-green-500 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {hasStockItems} do estoque
            </Badge>
          )}
          {hasPurchaseItems > 0 && (
            <Badge variant="outline" className="text-xs border-blue-500 text-blue-600 dark:text-blue-400">
              <ShoppingCart className="w-3 h-3 mr-1" />
              {hasPurchaseItems} a comprar
            </Badge>
          )}
          {hasMixedItems > 0 && (
            <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {hasMixedItems} misto
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OriginBadge({ origin }: { origin: 'stock' | 'purchase' | 'mixed' }) {
  if (origin === 'stock') {
    return (
      <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 text-[10px] px-1.5">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Estoque
      </Badge>
    );
  }
  if (origin === 'purchase') {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] px-1.5">
        <ShoppingCart className="w-3 h-3 mr-1" />
        Comprar
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 text-[10px] px-1.5">
      <AlertTriangle className="w-3 h-3 mr-1" />
      Misto
    </Badge>
  );
}
