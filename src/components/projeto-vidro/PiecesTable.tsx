import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { GlassPanelData } from '@/pages/Producao';
import { Layers, Scale, Ruler, Lock } from 'lucide-react';

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
  
  // Calculate total area and weight for the table
  const stats = useMemo(() => {
    let totalArea = 0;
    groupedPanels.forEach(group => {
      const areaM2 = (group.width * group.height) / 1000000;
      totalArea += areaM2 * group.quantity;
    });
    // 10mm glass weighs ~25 kg/m²
    const totalWeight = totalArea * 25;
    return { totalArea, totalWeight };
  }, [groupedPanels]);

  return (
    <Card>
      <CardHeader className="pb-3 border-b bg-gradient-to-r from-muted/50 to-background">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          Tabela de Peças
        </CardTitle>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <Badge variant="secondary" className="text-xs gap-1">
            <Ruler className="w-3 h-3" />
            {totalWidth} × {totalHeight} mm
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <Scale className="w-3 h-3" />
            {stats.totalArea.toFixed(2)} m²
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            ~{stats.totalWeight.toFixed(1)} kg
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Enhanced table with area calculations */}
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-bold text-center w-16 border-r">Peça</TableHead>
              <TableHead className="font-bold text-center w-12 border-r">Qtd</TableHead>
              <TableHead className="font-bold text-center border-r">Largura</TableHead>
              <TableHead className="font-bold text-center border-r">Altura</TableHead>
              <TableHead className="font-bold text-center">Área (m²)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedPanels.map((group, index) => {
              const areaUnit = (group.width * group.height) / 1000000;
              const areaTotal = areaUnit * group.quantity;
              
              return (
                <TableRow key={index} className="hover:bg-muted/20">
                  <TableCell className="font-bold text-center border-r">
                    <div className="flex items-center justify-center gap-1">
                      {group.letters.map((letter, i) => (
                        <Badge 
                          key={letter} 
                          variant="secondary" 
                          className="w-7 h-7 p-0 flex items-center justify-center rounded-full text-xs font-bold"
                        >
                          {letter}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center border-r font-semibold">
                    {group.quantity}
                  </TableCell>
                  <TableCell className="text-center border-r">
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-primary">{group.width}</span>
                      {group.widthFormula && (
                        <span className="text-[10px] text-muted-foreground">{group.widthFormula}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center border-r">
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-primary">{group.height}</span>
                      {group.heightFormula && (
                        <span className="text-[10px] text-muted-foreground">{group.heightFormula}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{areaUnit.toFixed(3)}</span>
                      {group.quantity > 1 && (
                        <span className="text-[10px] text-muted-foreground">
                          (×{group.quantity} = {areaTotal.toFixed(3)})
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            
            {/* Total row */}
            <TableRow className="bg-primary/10 hover:bg-primary/10 border-t-2 border-primary/30">
              <TableCell className="font-bold text-center border-r">Total</TableCell>
              <TableCell className="text-center border-r font-bold text-lg text-primary">
                {totalPieces}
              </TableCell>
              <TableCell colSpan={2} className="text-center border-r text-sm text-muted-foreground">
                peças de vidro
              </TableCell>
              <TableCell className="text-center font-bold text-primary">
                {stats.totalArea.toFixed(2)} m²
              </TableCell>
            </TableRow>
            
            {/* Lock height row */}
            <TableRow className="hover:bg-muted/20">
              <TableCell colSpan={3} className="text-right border-r">
                <div className="flex items-center justify-end gap-2">
                  <Lock className="w-4 h-4 text-destructive" />
                  <span className="font-medium text-sm">Altura da fechadura</span>
                </div>
              </TableCell>
              <TableCell colSpan={2} className="p-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={lockHeight}
                    onChange={e => onLockHeightChange(parseInt(e.target.value) || 0)}
                    min={0}
                    max={totalHeight}
                    className="h-9 text-center font-semibold w-24"
                  />
                  <span className="text-sm text-muted-foreground">mm</span>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        
        {/* Weight estimation note */}
        <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground border-t">
          💡 Peso estimado baseado em vidro de 10mm (~25 kg/m²)
        </div>
      </CardContent>
    </Card>
  );
}
