import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GlassPanelData } from '@/pages/ProjetoVidro';

interface GroupedPanel {
  letters: string[];
  width: number;
  height: number;
  quantity: number;
  widthFormula: string | null;
  heightFormula: string | null;
}

interface PiecesTableProps {
  panels: GlassPanelData[];
  groupedPanels: GroupedPanel[];
  totalWidth: number;
  totalHeight: number;
  lockHeight: number;
  onLockHeightChange: (value: number) => void;
}

export function PiecesTable({ 
  panels, 
  groupedPanels, 
  totalWidth, 
  totalHeight,
  lockHeight,
  onLockHeightChange
}: PiecesTableProps) {
  const totalPieces = panels.length;

  return (
    <Card>
      <CardHeader className="pb-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{totalWidth}</span>
              <span className="ml-1 font-semibold">Vão</span>
            </div>
            <div>
              <span className="text-muted-foreground">{totalHeight}</span>
              <span className="ml-1 font-semibold">Vão</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Excel-style table */}
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-bold text-center w-16 border-r">Peça</TableHead>
              <TableHead className="font-bold text-center w-16 border-r">T. pçs.</TableHead>
              <TableHead className="font-bold text-center border-r" colSpan={2}>Largura</TableHead>
              <TableHead className="font-bold text-center" colSpan={2}>Altura</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedPanels.map((group, index) => (
              <TableRow key={index} className="hover:bg-muted/20">
                <TableCell className="font-bold text-center border-r text-base">
                  {group.letters.join(', ')}
                </TableCell>
                <TableCell className="text-center border-r font-medium">
                  {group.quantity}
                </TableCell>
                <TableCell className="text-center font-semibold text-primary">
                  {group.width}
                </TableCell>
                <TableCell className="text-center border-r text-xs text-muted-foreground">
                  Def
                </TableCell>
                <TableCell className="text-center font-semibold text-primary">
                  {group.height}
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">
                  Def
                </TableCell>
              </TableRow>
            ))}
            
            {/* Total row */}
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-t-2">
              <TableCell className="font-bold text-center border-r">Total</TableCell>
              <TableCell className="text-center border-r font-bold">{totalPieces}</TableCell>
              <TableCell className="text-center font-medium" colSpan={4}>
                Pçs.
              </TableCell>
            </TableRow>
            
            {/* Lock height row */}
            <TableRow className="hover:bg-muted/20">
              <TableCell colSpan={4} className="text-right font-medium text-sm border-r">
                Altura fechadura =
              </TableCell>
              <TableCell colSpan={2} className="p-1">
                <Input
                  type="number"
                  value={lockHeight}
                  onChange={e => onLockHeightChange(parseInt(e.target.value) || 0)}
                  min={0}
                  max={totalHeight}
                  className="h-8 text-center font-semibold"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
