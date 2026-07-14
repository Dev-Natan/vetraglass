import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { CutAngleIcon } from './CutAngleIcon';
import { cn } from '@/lib/utils';

export interface ProfileCutItem {
  id: string;
  profileName: string;
  imageUrl: string | null;
  widthFormula: string | null;
  heightFormula: string | null;
  quantityFormula: string;
  calculatedLength: number;
  quantity: number;
  piecesPerProduct: number;
  cutAngle: number;
  cutAngleStart?: number;
  cutAngleEnd?: number;
  position: 'Altura' | 'Largura';
  isCompleted?: boolean;
}

interface ProfileCutsTableProps {
  cuts: ProfileCutItem[];
  showCheckboxes?: boolean;
  onToggleComplete?: (id: string, completed: boolean) => void;
  getStorageUrl: (path: string | null) => string | null;
  hoveredId?: string | null;
  onHoverChange?: (id: string | null) => void;
}

export function ProfileCutsTable({ 
  cuts, 
  showCheckboxes = false,
  onToggleComplete,
  getStorageUrl,
  hoveredId,
  onHoverChange,
}: ProfileCutsTableProps) {
  if (cuts.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <span className="w-3 h-3 rounded bg-primary"></span>
        Perfis de Alumínio
      </h3>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary hover:bg-primary">
              {showCheckboxes && (
                <TableHead className="text-primary-foreground font-bold w-12">✓</TableHead>
              )}
              <TableHead className="text-primary-foreground font-bold">PERFIL</TableHead>
              <TableHead className="text-primary-foreground font-bold text-center">MEDIDA (mm)</TableHead>
              <TableHead className="text-primary-foreground font-bold text-center">QUANTIDADE</TableHead>
              <TableHead className="text-primary-foreground font-bold text-center">ÂNGULO DE CORTE</TableHead>
              <TableHead className="text-primary-foreground font-bold text-center">POSIÇÃO</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cuts.map((cut) => (
              <TableRow 
                key={cut.id} 
                className={`hover:bg-muted/50 ${cut.isCompleted ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
              >
                {showCheckboxes && (
                  <TableCell>
                    <Checkbox 
                      checked={cut.isCompleted}
                      onCheckedChange={(checked) => onToggleComplete?.(cut.id, !!checked)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-12 bg-white rounded border flex items-center justify-center overflow-hidden">
                      {cut.imageUrl ? (
                        <img 
                          src={getStorageUrl(cut.imageUrl) || ''} 
                          alt={cut.profileName}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">📦</span>
                      )}
                    </div>
                    <div>
                      <span className={`font-medium ${cut.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                        {cut.profileName}
                      </span>
                      {(cut.widthFormula || cut.heightFormula) && (
                        <div className="flex gap-2 mt-1">
                          {cut.widthFormula && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              L: {cut.widthFormula}
                            </span>
                          )}
                          {cut.heightFormula && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              A: {cut.heightFormula}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center font-bold text-lg">
                  {cut.calculatedLength}
                </TableCell>
                <TableCell className="text-center">
                  {cut.quantity}
                </TableCell>
                <TableCell className="text-center">
                  <div className="inline-flex gap-1">
                    <span className="bg-foreground text-background px-3 py-1 text-sm font-medium">
                      {cut.cutAngleStart ?? cut.cutAngle}°
                    </span>
                    <span className="bg-foreground text-background px-3 py-1 text-sm font-medium">
                      {cut.cutAngleEnd ?? cut.cutAngle}°
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="inline-flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      cut.position === 'Altura' ? 'bg-blue-500' : 'bg-amber-500'
                    }`} />
                    {cut.position}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
