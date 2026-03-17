import { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowUpDown, 
  ArrowLeftRight, 
  Calculator, 
  Plus, 
  Minus, 
  X as Multiply, 
  Divide,
  Check,
  AlertCircle,
  Square
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateFormula } from '@/utils/safeFormulaEvaluator';

interface GlassFormulaEditorProps {
  widthFormula: string;
  heightFormula: string;
  onWidthFormulaChange: (value: string) => void;
  onHeightFormulaChange: (value: string) => void;
  showPiecesQuantity?: boolean;
  piecesQuantity?: number;
  onPiecesChange?: (value: number) => void;
}

// Common formulas for width (based on VÃO - opening dimensions)
const widthFormulas = [
  { label: 'Vão', formula: 'Largura' },
  { label: 'Vão - 10', formula: 'Largura - 10' },
  { label: 'Vão - 20', formula: 'Largura - 20' },
  { label: 'Vão / 2', formula: 'Largura / 2' },
  { label: '(Vão / 2) - 10', formula: '(Largura / 2) - 10' },
  { label: 'Vão / 3', formula: 'Largura / 3' },
  { label: 'Vão / 4', formula: 'Largura / 4' },
];

// Common formulas for height (based on VÃO - opening dimensions)
const heightFormulas = [
  { label: 'Vão', formula: 'Altura' },
  { label: 'Vão - 10', formula: 'Altura - 10' },
  { label: 'Vão - 20', formula: 'Altura - 20' },
  { label: 'Vão / 2', formula: 'Altura / 2' },
  { label: '(Vão / 2) - 10', formula: '(Altura / 2) - 10' },
];

// Operators
const operators = [
  { label: '+', value: ' + ', icon: Plus },
  { label: '-', value: ' - ', icon: Minus },
  { label: '×', value: ' * ', icon: Multiply },
  { label: '÷', value: ' / ', icon: Divide },
  { label: '(', value: '(', icon: null },
  { label: ')', value: ')', icon: null },
];

interface FormulaInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  quickFormulas: { label: string; formula: string }[];
  icon: React.ReactNode;
  color: string;
  variableName: string;
  variableDescription?: string;
}

function FormulaInput({ label, value, onChange, quickFormulas, icon, color, variableName, variableDescription }: FormulaInputProps) {
  const [focusedInput, setFocusedInput] = useState(false);
  const validation = validateFormula(value);

  const insertText = (text: string) => {
    onChange(value + text);
  };

  return (
    <div className="space-y-3 p-4 rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={cn("p-2 rounded-lg", color)}>
          {icon}
        </div>
        <div>
          <Label className="font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground">Fórmula para calcular a {label.toLowerCase()} do vidro</p>
        </div>
      </div>

      {/* Input */}
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Ex: ${variableName} - 40`}
          className={cn(
            "pr-10 font-mono text-sm",
            !validation.isValid && "border-destructive focus-visible:ring-destructive"
          )}
          onFocus={() => setFocusedInput(true)}
          onBlur={() => setFocusedInput(false)}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {value && (
            validation.isValid ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-destructive" />
            )
          )}
        </div>
      </div>

      {/* Error message */}
      {!validation.isValid && validation.error && (
        <p className="text-xs text-destructive">{validation.error}</p>
      )}

      {/* Preview */}
      {value && validation.isValid && validation.result !== null && (
        <div className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
          <span className="text-muted-foreground">Preview (1000×800mm):</span>
          <span className="font-mono font-medium text-foreground">
            {validation.result.toFixed(0)}mm
          </span>
        </div>
      )}

      {/* Quick formulas */}
      <div className="flex flex-wrap gap-2">
        {quickFormulas.map((formula, index) => (
          <Button
            key={index}
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "text-xs h-7",
              value === formula.formula && "ring-2 ring-primary"
            )}
            onClick={() => onChange(formula.formula)}
          >
            {formula.label}
          </Button>
        ))}
      </div>

      {/* Variable and operators */}
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn("h-8 text-xs gap-1", color.replace('bg-', 'text-').replace('/10', ''))}
          onClick={() => insertText(variableName)}
          title={variableDescription || variableName}
        >
          {icon}
          {variableDescription || variableName}
        </Button>
        {operators.map((op, index) => (
          <Button
            key={index}
            type="button"
            variant="outline"
            size="sm"
            className="w-8 h-8 p-0 font-mono"
            onClick={() => insertText(op.value)}
          >
            {op.icon ? <op.icon className="w-3 h-3" /> : op.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => onChange('')}
        >
          Limpar
        </Button>
      </div>
    </div>
  );
}

export function GlassFormulaEditor({ 
  widthFormula, 
  heightFormula, 
  onWidthFormulaChange, 
  onHeightFormulaChange,
  showPiecesQuantity = false,
  piecesQuantity = 1,
  onPiecesChange
}: GlassFormulaEditorProps) {
  const widthValid = validateFormula(widthFormula);
  const heightValid = validateFormula(heightFormula);

  // Calculate preview dimensions
  const previewWidth = widthValid.result ?? 800;
  const previewHeight = heightValid.result ?? 1000;
  const areaM2 = (previewWidth * previewHeight) / 1000000;

  return (
    <div className="space-y-4">
      {/* Glass icon header */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Square className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-sm">Fórmulas de Dimensão do Vidro</h3>
          <p className="text-xs text-muted-foreground">
            As fórmulas são calculadas com base nas dimensões do <strong>VÃO</strong> (abertura)
          </p>
        </div>
      </div>

      {/* Width formula */}
      <FormulaInput
        label="Largura do Vidro"
        value={widthFormula}
        onChange={onWidthFormulaChange}
        quickFormulas={widthFormulas}
        icon={<ArrowLeftRight className="w-4 h-4 text-green-600" />}
        color="bg-green-500/10"
        variableName="Largura"
        variableDescription="Largura do Vão"
      />

      {/* Height formula */}
      <FormulaInput
        label="Altura do Vidro"
        value={heightFormula}
        onChange={onHeightFormulaChange}
        quickFormulas={heightFormulas}
        icon={<ArrowUpDown className="w-4 h-4 text-blue-600" />}
        color="bg-blue-500/10"
        variableName="Altura"
        variableDescription="Altura do Vão"
      />

      {/* Combined preview */}
      {(widthFormula || heightFormula) && widthValid.isValid && heightValid.isValid && (
        <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Preview do Vidro (Vão: 800×1000mm)</span>
        </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-xs text-green-600 mb-1">Largura</div>
              <div className="font-mono font-bold text-lg">{previewWidth.toFixed(0)}mm</div>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="text-xs text-blue-600 mb-1">Altura</div>
              <div className="font-mono font-bold text-lg">{previewHeight.toFixed(0)}mm</div>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="text-xs text-purple-600 mb-1">Área</div>
              <div className="font-mono font-bold text-lg">{areaM2.toFixed(3)}m²</div>
            </div>
          </div>
        </div>
      )}

      {/* Pieces quantity */}
      {showPiecesQuantity && onPiecesChange && (
        <div className="space-y-2 pt-2 border-t">
          <Label>Quantidade de peças por produto</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => onPiecesChange(Math.max(1, piecesQuantity - 1))}
              disabled={piecesQuantity <= 1}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <Input
              type="number"
              value={piecesQuantity}
              onChange={(e) => onPiecesChange(Math.max(1, Number(e.target.value)))}
              className="w-20 text-center"
              min={1}
              max={20}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => onPiecesChange(piecesQuantity + 1)}
              disabled={piecesQuantity >= 20}
            >
              <Plus className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              peças
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Ex: Janela de correr 2 folhas = 2 peças, Fixo = 1 peça
          </p>
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <p className="font-medium mb-1">💡 Fórmulas baseadas no VÃO</p>
        <p className="mb-2">
          <strong>"Largura"</strong> = Largura do Vão | <strong>"Altura"</strong> = Altura do Vão
        </p>
        <p>Exemplo: Uma basculante de vão 500×500mm com fórmula "Largura - 10" resultará em vidro de 490mm.</p>
      </div>
    </div>
  );
}