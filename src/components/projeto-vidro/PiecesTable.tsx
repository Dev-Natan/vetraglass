import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Tabela de Peças</span>
          <Badge variant="secondary">{totalPieces} peças</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/10">
              <TableHead className="font-bold text-primary">Peça</TableHead>
              <TableHead className="font-bold text-primary text-center">T.pç.</TableHead>
              <TableHead className="font-bold text-primary text-center">Largura</TableHead>
              <TableHead className="font-bold text-primary text-center">-</TableHead>
              <TableHead className="font-bold text-primary text-center">Altura</TableHead>
              <TableHead className="font-bold text-primary text-center">-</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedPanels.map((group, index) => (
              <TableRow key={index}>
                <TableCell className="font-bold text-lg">
                  {group.letters.join(', ')}
                </TableCell>
                <TableCell className="text-center">
                  {group.quantity}
                </TableCell>
                <TableCell className="text-center font-medium text-green-600">
                  {group.width}
                </TableCell>
                <TableCell className="text-center">
                  {group.widthFormula ? (
                    <Badge variant="outline" className="text-xs bg-green-50">
                      Def
                    </Badge>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-center font-medium text-blue-600">
                  {group.height}
                </TableCell>
                <TableCell className="text-center">
                  {group.heightFormula ? (
                    <Badge variant="outline" className="text-xs bg-blue-50">
                      Def
                    </Badge>
                  ) : '-'}
                </TableCell>
              </TableRow>
            ))}
            {/* Total row */}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell className="font-bold">Total</TableCell>
              <TableCell className="text-center">{totalPieces}</TableCell>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Peças
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* VÃO Summary */}
        <div className="border rounded-lg p-3 bg-primary/5 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Largura do VÃO:</span>
            <span className="font-bold text-primary">{totalWidth} mm</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Altura do VÃO:</span>
            <span className="font-bold text-primary">{totalHeight} mm</span>
          </div>
        </div>

        {/* Lock Height */}
        <div className="space-y-2">
          <Label htmlFor="lock-height" className="text-sm font-medium">
            Altura do Fecho/Fechadura (mm)
          </Label>
          <Input
            id="lock-height"
            type="number"
            value={lockHeight}
            onChange={e => onLockHeightChange(parseInt(e.target.value) || 0)}
            min={0}
            max={totalHeight}
            placeholder="Ex: 1000"
          />
          <p className="text-xs text-muted-foreground">
            Posição da fechadura a partir do chão
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
