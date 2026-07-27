import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { GlassPreview } from './GlassPreview';

export interface GlassCutItem {
  id: string;
  glassName: string;
  customName: string | null;
  imageUrl: string | null;
  widthFormula: string | null;
  heightFormula: string | null;
  calculatedWidth: number;
  calculatedHeight: number;
  areaM2: number;
  quantity: number;
  isCompleted?: boolean;
}

export type GlassEditableField = 'widthFormula' | 'heightFormula';

interface GlassCutsTableProps {
  glassCuts: GlassCutItem[];
  showCheckboxes?: boolean;
  onToggleComplete?: (id: string, completed: boolean) => void;
  editable?: boolean;
  onFieldChange?: (id: string, field: GlassEditableField, value: string) => void;
}

export function GlassCutsTable({
  glassCuts,
  showCheckboxes = false,
  onToggleComplete,
  editable = false,
  onFieldChange,
}: GlassCutsTableProps) {
  if (glassCuts.length === 0) return null;

  const totalArea = glassCuts.reduce((sum, g) => sum + g.areaM2 * g.quantity, 0);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-purple-500"></span>
          Vidros
        </h3>
        <span className="text-sm text-muted-foreground">
          Área total: <strong className="text-purple-600">{totalArea.toFixed(3)} m²</strong>
        </span>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-purple-600 hover:bg-purple-600">
              {showCheckboxes && (
                <TableHead className="text-white font-bold w-12">✓</TableHead>
              )}
              <TableHead className="text-white font-bold">VIDRO</TableHead>
              {editable && (
                <TableHead className="text-white font-bold text-center min-w-[220px]">FÓRMULAS</TableHead>
              )}
              <TableHead className="text-white font-bold text-center">LARGURA (mm)</TableHead>
              <TableHead className="text-white font-bold text-center">ALTURA (mm)</TableHead>
              <TableHead className="text-white font-bold text-center">ÁREA (m²)</TableHead>
              <TableHead className="text-white font-bold text-center">QUANTIDADE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {glassCuts.map((glass) => (
              <TableRow
                key={glass.id}
                className={`hover:bg-muted/50 ${glass.isCompleted ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
              >
                {showCheckboxes && (
                  <TableCell>
                    <Checkbox
                      checked={glass.isCompleted}
                      onCheckedChange={(checked) => onToggleComplete?.(glass.id, !!checked)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <GlassPreview
                      width={glass.calculatedWidth}
                      height={glass.calculatedHeight}
                      name={glass.customName || glass.glassName}
                    />
                    <div>
                      <span className={`font-semibold text-foreground ${glass.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                        {glass.customName || glass.glassName}
                      </span>
                      {glass.customName && (
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">{glass.glassName}</div>
                      )}
                      {!editable && (glass.widthFormula || glass.heightFormula) && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {glass.widthFormula && (
                            <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium">
                              L: {glass.widthFormula}
                            </span>
                          )}
                          {glass.heightFormula && (
                            <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
                              A: {glass.heightFormula}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                {editable && (
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-1.5 min-w-[220px]">
                      <label className="text-[10px] uppercase text-muted-foreground font-medium">Largura</label>
                      <span className="inline-flex items-center h-7 px-2 rounded border border-dashed border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 text-xs font-mono text-emerald-700 dark:text-emerald-300 select-all">
                        {glass.widthFormula || '—'}
                      </span>
                      <label className="text-[10px] uppercase text-muted-foreground font-medium mt-1">Altura</label>
                      <span className="inline-flex items-center h-7 px-2 rounded border border-dashed border-blue-300 bg-blue-50 dark:bg-blue-900/20 text-xs font-mono text-blue-700 dark:text-blue-300 select-all">
                        {glass.heightFormula || '—'}
                      </span>
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-center">
                  <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{glass.calculatedWidth}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{glass.calculatedHeight}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-bold text-lg text-purple-600 dark:text-purple-400">{glass.areaM2.toFixed(3)}</span>
                </TableCell>
                <TableCell className="text-center font-medium">
                  {glass.quantity}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
