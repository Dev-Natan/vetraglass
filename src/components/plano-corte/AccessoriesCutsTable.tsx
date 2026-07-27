import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, Wrench, Droplets } from 'lucide-react';

export interface AccessoryCutItem {
  id: string;
  itemName: string;
  type: string;
  unit: string;
  quantity: number;
  formula?: string | null;
  isFixed: boolean;
  imageUrl?: string | null;
}

interface Props {
  items: AccessoryCutItem[];
  title: string;
  icon: 'accessory' | 'component' | 'input';
  emptyMessage?: string;
}

const iconMap = {
  accessory: Wrench,
  component: Package,
  input: Droplets,
};

export function AccessoriesCutsTable({ items, title, icon, emptyMessage }: Props) {
  const Icon = iconMap[icon];

  if (!items.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="w-4 h-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {emptyMessage || 'Nenhum item nesta categoria.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {title}
          <Badge variant="secondary" className="ml-1">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="text-right">Qtd Total</TableHead>
              <TableHead>Unidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.itemName}</TableCell>
                <TableCell>
                  {item.isFixed ? (
                    <Badge variant="outline">Qtd fixa</Badge>
                  ) : (
                    <Badge variant="outline" className="font-mono text-xs">
                      {item.formula || '—'}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono font-bold tabular-nums">
                  {item.quantity.toFixed(item.quantity % 1 === 0 ? 0 : 3)}
                </TableCell>
                <TableCell className="text-muted-foreground">{item.unit}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
