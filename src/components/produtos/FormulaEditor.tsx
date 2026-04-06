import { useState, useEffect, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateFormula } from '@/utils/safeFormulaEvaluator';

interface FormulaEditorProps {
  value: string;
  onChange: (value: string) => void;
  showPiecesQuantity?: boolean;
  piecesQuantity?: number;
  onPiecesChange?: (value: number) => void;
  piecesFormula?: string | null;
  onPiecesFormulaChange?: (value: string) => void;
}

// Common glass formulas
const commonFormulas = [
  { label: 'Altura', formula: 'Altura', icon: ArrowUpDown, color: 'bg-blue-500' },
  { label: 'Largura', formula: 'Largura', icon: ArrowLeftRight, color: 'bg-green-500' },
  { label: 'Vez. Comum', formula: '(Largura - 134) / 2', icon: null, color: 'bg-orange-500' },
  { label: 'Qtde Vez.', formula: '((Altura - 132) / 60) * 2', icon: null, color: 'bg-purple-500' },
  { label: '(Largura / 2) - 20', formula: '(Largura / 2) - 20', icon: null, color: 'bg-emerald-500' },
  { label: 'Área m²', formula: 'Altura * Largura / 1000000', icon: null, color: 'bg-purple-500' },
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

export const FormulaEditor = forwardRef<HTMLDivElement, FormulaEditorProps>(
  function FormulaEditor({ 
    value, 
    onChange, 
    showPiecesQuantity = false,
    piecesQuantity = 1,
    onPiecesChange,
    piecesFormula = null,
    onPiecesFormulaChange
  }, ref) {
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Test formula with sample values
  useEffect(() => {
    if (!value || value.trim() === '') {
      setPreviewResult(null);
      setIsValid(true);
      setErrorMessage('');
      return;
    }

    const validation = validateFormula(value, 800, 1000);
    
    if (validation.isValid && validation.result !== null) {
      setPreviewResult(validation.result.toFixed(2));
      setIsValid(true);
      setErrorMessage('');
    } else {
      setIsValid(false);
      setErrorMessage(validation.error || 'Fórmula inválida');
      setPreviewResult(null);
    }
  }, [value]);

  const insertText = (text: string) => {
    onChange(value + text);
  };

  const applyFormula = (formula: string) => {
    onChange(formula);
  };

  const getFormulaType = (formula: string): 'altura' | 'largura' | 'mixed' | 'none' => {
    const lower = formula.toLowerCase();
    const hasAltura = lower.includes('altura');
    const hasLargura = lower.includes('largura');
    
    if (hasAltura && hasLargura) return 'mixed';
    if (hasAltura) return 'altura';
    if (hasLargura) return 'largura';
    return 'none';
  };

  const formulaType = getFormulaType(value);

  return (
    <div ref={ref} className="space-y-4">
      {/* Main input with status indicator */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          Fórmula de cálculo
        </Label>
        <div className="relative">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ex: Altura - 40"
            className={cn(
              "pr-10 font-mono text-sm",
              !isValid && "border-destructive focus-visible:ring-destructive"
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {value && (
              isValid ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-destructive" />
              )
            )}
          </div>
        </div>
        {!isValid && errorMessage && (
          <p className="text-xs text-destructive">{errorMessage}</p>
        )}
      </div>

      {/* Formula type indicator and preview */}
      {value && isValid && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          {/* Type badge */}
          <div className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium text-white",
            formulaType === 'altura' && "bg-blue-500",
            formulaType === 'largura' && "bg-green-500",
            formulaType === 'mixed' && "bg-purple-500",
            formulaType === 'none' && "bg-gray-500"
          )}>
            {formulaType === 'altura' && 'Usa Altura'}
            {formulaType === 'largura' && 'Usa Largura'}
            {formulaType === 'mixed' && 'Altura + Largura'}
            {formulaType === 'none' && 'Valor fixo'}
          </div>
          
          {/* Preview result */}
          {previewResult && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Preview (1000×800mm):</span>
              <span className="font-mono font-medium text-foreground">
                {previewResult}mm
              </span>
            </div>
          )}
        </div>
      )}

      {/* Quick formulas */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Fórmulas comuns
        </Label>
        <div className="flex flex-wrap gap-2">
          {commonFormulas.map((formula, index) => (
            <Button
              key={index}
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "text-xs gap-1.5 h-8",
                value === formula.formula && "ring-2 ring-primary"
              )}
              onClick={() => applyFormula(formula.formula)}
            >
              {formula.icon && <formula.icon className="w-3 h-3" />}
              {formula.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Variable buttons */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Variáveis</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30"
            onClick={() => insertText('Altura')}
          >
            <ArrowUpDown className="w-4 h-4" />
            Altura
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2 bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30"
            onClick={() => insertText('Largura')}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Largura
          </Button>
        </div>
      </div>

      {/* Operators */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Operadores</Label>
        <div className="flex gap-1">
          {operators.map((op, index) => (
            <Button
              key={index}
              type="button"
              variant="outline"
              size="sm"
              className="w-9 h-9 p-0 font-mono"
              onClick={() => insertText(op.value)}
            >
              {op.icon ? <op.icon className="w-4 h-4" /> : op.label}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="px-3 h-9 font-mono text-xs"
            onClick={() => onChange('')}
          >
            Limpar
          </Button>
        </div>
      </div>

      {/* Pieces quantity (for profiles) */}
      {showPiecesQuantity && (onPiecesChange || onPiecesFormulaChange) && (
        <div className="space-y-3 pt-3 border-t">
          <Label className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Quantidade de peças
          </Label>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1 border">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onPiecesChange?.(Math.max(1, (piecesQuantity || 1) - 1))}
                  disabled={!onPiecesChange || (piecesQuantity || 1) <= 1 || (piecesFormula !== null && piecesFormula !== '')}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <Input
                  type="number"
                  value={piecesQuantity || 1}
                  onChange={(e) => onPiecesChange?.(Math.max(1, Number(e.target.value)))}
                  className="w-12 h-7 p-0 border-none bg-transparent text-center focus-visible:ring-0"
                  min={1}
                  disabled={(piecesFormula !== null && piecesFormula !== '')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onPiecesChange?.((piecesQuantity || 1) + 1)}
                  disabled={!onPiecesChange || (piecesQuantity || 1) >= 100 || (piecesFormula !== null && piecesFormula !== '')}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                quantidade fixa
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ou use uma fórmula para calcular a quantidade:</span>
                {(piecesFormula !== null && piecesFormula !== '') && (
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded animate-pulse">
                    Fórmula Ativa
                  </span>
                )}
              </div>
              <Input
                value={piecesFormula || ''}
                onChange={(e) => onPiecesFormulaChange?.(e.target.value)}
                placeholder="Ex: (Largura / 500) + 1"
                className={cn(
                  "font-mono text-sm h-8",
                  (piecesFormula !== null && piecesFormula !== '') && "border-primary/50 bg-primary/5"
                )}
              />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Se preenchido, a fórmula calcula dinamicamente a quantidade de peças baseado nas dimensões.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg space-y-1">
        <p className="font-medium">💡 Dicas:</p>
        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground/80">
          <li><strong>Altura</strong> e <strong>Largura</strong> são as dimensões do produto em milímetros</li>
          <li>Use parênteses para agrupar operações: <code className="font-mono bg-muted px-1 rounded">(Largura / 2) - 20</code></li>
          <li>Para calcular área em m²: <code className="font-mono bg-muted px-1 rounded">Altura * Largura / 10000</code></li>
        </ul>
      </div>
    </div>
  );
});
