import { Package, ChevronUp, Check, Trash2, Edit2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { resolveItemImageUrl } from '@/utils/imageUrl';
import { FormulaEditor } from '../../FormulaEditor';
import { GlassFormulaEditor } from '../../GlassFormulaEditor';
import { typeColors, typeLabels } from '../constants';
import type { ComponentItem } from '../types';

interface ComponentRowProps {
  item: ComponentItem;
  isEditing: boolean;
  onEdit: (item: ComponentItem) => void;
  onRemove: (id: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  // form state
  quantityFormula: string;
  setQuantityFormula: (v: string) => void;
  piecesQuantity: number;
  setPiecesQuantity: (n: number) => void;
  piecesFormula: string | null;
  setPiecesFormula: (v: string | null) => void;
  cutAngle: number;
  setCutAngle: (n: number) => void;
  widthFormula: string;
  setWidthFormula: (v: string) => void;
  heightFormula: string;
  setHeightFormula: (v: string) => void;
  glassName: string;
  setGlassName: (v: string) => void;
  side: string | null;
  setSide: (v: string | null) => void;
  calculationType: 'fixed' | 'per_side' | 'per_leaf' | 'per_glass' | 'formula';
  setCalculationType: (v: 'fixed' | 'per_side' | 'per_leaf' | 'per_glass' | 'formula') => void;
  appliesTo: 'product' | 'side' | 'leaf' | 'glass' | 'panel';
  setAppliesTo: (v: 'product' | 'side' | 'leaf' | 'glass' | 'panel') => void;
}

export function ComponentRow({
  item,
  isEditing,
  onEdit,
  onRemove,
  onSaveEdit,
  onCancelEdit,
  quantityFormula,
  setQuantityFormula,
  piecesQuantity,
  setPiecesQuantity,
  piecesFormula,
  setPiecesFormula,
  cutAngle,
  setCutAngle,
  widthFormula,
  setWidthFormula,
  heightFormula,
  setHeightFormula,
  glassName,
  setGlassName,
  side,
  setSide,
  calculationType,
  setCalculationType,
  appliesTo,
  setAppliesTo,
}: ComponentRowProps) {
  const itemType = item.item_template?.type;

  if (isEditing) {
    return (
      <div className="rounded-lg border-2 border-primary bg-primary/5 overflow-hidden">
        <button
          type="button"
          className="flex items-center gap-3 p-3 w-full text-left hover:bg-primary/10 transition-colors"
          onClick={onSaveEdit}
        >
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
            {item.item_template?.image_url ? (
              <img
                src={resolveItemImageUrl(item.item_template.image_url)}
                alt={item.item_template.name}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <Package className="w-5 h-5 text-muted-foreground/50" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{item.item_template?.name}</p>
            <p className="text-xs text-primary">Clique para fechar e salvar</p>
          </div>
          <ChevronUp className="w-5 h-5 text-primary shrink-0" />
        </button>

        <div className="p-4 pt-2 space-y-4 border-t border-primary/20">
          {itemType === 'glass' ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Quantidade de peças
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setPiecesQuantity(Math.max(1, piecesQuantity - 1))}
                    disabled={piecesQuantity <= 1}
                  >
                    <span className="text-lg font-medium">-</span>
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    value={piecesQuantity}
                    onChange={e => setPiecesQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center font-medium"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setPiecesQuantity(piecesQuantity + 1)}
                  >
                    <span className="text-lg font-medium">+</span>
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {piecesQuantity === 1 ? 'peça' : 'peças'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Quantas unidades deste vidro compõem o produto
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Nome do vidro (opcional)</Label>
                <Input
                  value={glassName}
                  onChange={e => setGlassName(e.target.value)}
                  placeholder="Ex: Vidro Fixo Superior"
                />
              </div>
              <GlassFormulaEditor
                widthFormula={widthFormula}
                heightFormula={heightFormula}
                onWidthFormulaChange={setWidthFormula}
                onHeightFormulaChange={setHeightFormula}
                showPiecesQuantity={true}
                piecesQuantity={piecesQuantity}
                onPiecesChange={setPiecesQuantity}
                piecesFormula={piecesFormula}
                onPiecesFormulaChange={setPiecesFormula}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <FormulaEditor
                value={quantityFormula}
                onChange={setQuantityFormula}
                showPiecesQuantity={itemType === 'profile'}
                piecesQuantity={piecesQuantity}
                onPiecesChange={setPiecesQuantity}
                piecesFormula={piecesFormula}
                onPiecesFormulaChange={setPiecesFormula}
              />
              {itemType === 'profile' && (
                <div className="space-y-2">
                  <Label>Ângulo de corte</Label>
                  <Select value={cutAngle.toString()} onValueChange={v => setCutAngle(Number(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="45">45°</SelectItem>
                      <SelectItem value="90">90°</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                  <Label className="text-sm">Tipo de cálculo</Label>
                  <Select value={calculationType} onValueChange={(v: any) => setCalculationType(v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixo (1x)</SelectItem>
                      <SelectItem value="per_side">Por Lado</SelectItem>
                      <SelectItem value="per_leaf">Por Folha</SelectItem>
                      <SelectItem value="per_glass">Por Vidro</SelectItem>
                      <SelectItem value="formula">Fórmula Personalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Aplicação</Label>
                  <Select value={appliesTo} onValueChange={(v: any) => setAppliesTo(v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Produto Inteiro</SelectItem>
                      <SelectItem value="side">Lado</SelectItem>
                      <SelectItem value="leaf">Folha</SelectItem>
                      <SelectItem value="glass">Vidro</SelectItem>
                      <SelectItem value="panel">Painel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t">
                <Label className="text-sm">Lado de aplicação</Label>
                <div className="flex gap-2">
                  {[
                    { value: null, label: 'Ambos' },
                    { value: 'A', label: 'Lado A' },
                    { value: 'B', label: 'Lado B' },
                    { value: 'C', label: 'Lado C' },
                  ].map(option => (
                    <Button
                      key={String(option.value)}
                      type="button"
                      variant={side === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSide(option.value)}
                      className="flex-1 text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Use "Tipo: Fixo" para itens únicos (kit, silicone, etc).
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border/50 mt-4">
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>
              Descartar alterações
            </Button>
            <Button size="sm" onClick={onSaveEdit} className="gap-1">
              <Check className="w-4 h-4" />
              Salvar e fechar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Display mode
  return (
    <button
      type="button"
      className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 transition-colors group w-full text-left"
      onClick={() => onEdit(item)}
    >
      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
        {item.item_template?.image_url ? (
          <img
            src={resolveItemImageUrl(item.item_template.image_url)}
            alt={item.item_template.name}
            className="w-full h-full object-contain p-1"
          />
        ) : (
          <Package className="w-6 h-6 text-muted-foreground/50" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {item.notes && itemType === 'glass' && (
          <p className="font-semibold text-sm truncate">{item.notes}</p>
        )}
        <p
          className={`text-sm truncate ${
            item.notes && itemType === 'glass' ? 'text-muted-foreground' : 'font-medium'
          }`}
        >
          {item.item_template?.name}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="secondary" className={`text-xs ${typeColors[itemType] || ''}`}>
            {typeLabels[itemType] || itemType}
          </Badge>
          {itemType === 'glass' ? (
            <>
              <span className="text-xs px-2 py-0.5 rounded bg-muted">
                {item.pieces_formula ? item.pieces_formula : (item.pieces_quantity || 1)}x
              </span>
              {item.width_formula && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  L: {item.width_formula}
                </span>
              )}
              {item.height_formula && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  A: {item.height_formula}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">{item.quantity_formula}</span>
              {itemType === 'profile' && (
                <>
                  <span className="text-xs px-2 py-0.5 rounded bg-muted">
                    {item.pieces_formula ? item.pieces_formula : (item.pieces_quantity || 1)}x
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-muted">{item.cut_angle}°</span>
                </>
              )}
            </>
          )}
          {calculationType && calculationType !== 'formula' && (
            <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">
              {calculationType === 'fixed' && 'Fixo'}
              {calculationType === 'per_side' && 'Por Lado'}
              {calculationType === 'per_leaf' && 'Por Folha'}
              {calculationType === 'per_glass' && 'Por Vidro'}
            </Badge>
          )}
          {side && (
            <Badge 
              variant="outline" 
              className={
                side === 'A' ? "bg-blue-50 text-blue-600 border-blue-200" : 
                side === 'B' ? "bg-green-50 text-green-600 border-green-200" : 
                "bg-purple-50 text-purple-600 border-purple-200"
              }
            >
              Lado {side}
            </Badge>
          )}
          {item.isNew && (
            <Badge variant="outline" className="text-xs border-green-500 text-green-600">
              Novo
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <div
          role="button"
          tabIndex={0}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => {
            e.stopPropagation();
            onRemove(item.id);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onRemove(item.id);
            }
          }}
        >
          <Trash2 className="w-4 h-4" />
        </div>
        <Edit2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </button>
  );
}
