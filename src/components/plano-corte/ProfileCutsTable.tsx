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
            {cuts.map((cut) => {
              const isHovered = hoveredId === cut.id;
              const angleStart = cut.cutAngleStart ?? cut.cutAngle;
              const angleEnd = cut.cutAngleEnd ?? cut.cutAngle;
              const isAltura = cut.position === 'Altura';
              return (
                <TableRow
                  key={cut.id}
                  onMouseEnter={() => onHoverChange?.(cut.id)}
                  onMouseLeave={() => onHoverChange?.(null)}
                  className={cn(
                    'transition-colors',
                    cut.isCompleted && 'bg-green-50 dark:bg-green-900/20',
                    isHovered ? 'bg-destructive/10 ring-1 ring-destructive/40' : 'hover:bg-muted/50'
                  )}
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
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-center font-bold text-lg text-primary tabular-nums">
                    {cut.calculatedLength}
                  </TableCell>
                  <TableCell className="text-center font-bold text-lg tabular-nums">{cut.quantity}</TableCell>

                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-foreground text-background px-2 py-1 text-xs font-medium">
                        <CutAngleIcon angle={angleStart} side="start" className="text-background" />
                        {angleStart}°
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-foreground text-background px-2 py-1 text-xs font-medium">
                        <CutAngleIcon angle={angleEnd} side="end" className="text-background" />
                        {angleEnd}°
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border',
                        isAltura
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full', isAltura ? 'bg-blue-500' : 'bg-amber-500')} />
                      {cut.position}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
