import { useRef } from 'react';
import { Plus, Package, Search, X, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resolveItemImageUrl } from '@/utils/imageUrl';
import { FormulaEditor } from '../../FormulaEditor';
import { GlassFormulaEditor } from '../../GlassFormulaEditor';
import { itemTypeTabs } from '../constants';
import type { ItemTemplate } from '../types';

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activeTab: string;
  setActiveTab: (v: string) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filteredAvailableItems: ItemTemplate[] | undefined;
  selectedItemTemplateId: string;
  setSelectedItemTemplateId: (v: string) => void;
  // form fields
  piecesQuantity: number;
  setPiecesQuantity: (n: number) => void;
  quantityFormula: string;
  setQuantityFormula: (v: string) => void;
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
  onAdd: () => void;
}

export function AddItemDialog(props: AddItemDialogProps) {
  const {
    open,
    onOpenChange,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    filteredAvailableItems,
    selectedItemTemplateId,
    setSelectedItemTemplateId,
    piecesQuantity,
    setPiecesQuantity,
    quantityFormula,
    setQuantityFormula,
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
    onAdd,
  } = props;
  const formRef = useRef<HTMLDivElement>(null);

  const groupedItems = filteredAvailableItems?.reduce(
    (acc, item) => {
      const linha = item.linha || 'Sem Linha';
      if (!acc[linha]) acc[linha] = [];
      acc[linha].push(item);
      return acc;
    },
    {} as Record<string, ItemTemplate[]>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="p-4 pb-0 space-y-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Adicionar Item
            </DialogTitle>
            <DialogDescription>Selecione a categoria e o item para adicionar</DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {itemTypeTabs.map(tab => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.value);
                    setSelectedItemTemplateId('');
                    setSearchTerm('');
                  }}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background'
                  }`}
                >
                  {tab.value === 'glass' && '🪟'}
                  {tab.value === 'profile' && '📐'}
                  {tab.value === 'accessory' && '🔩'}
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Buscar ${itemTypeTabs.find(t => t.value === activeTab)?.label.toLowerCase() || 'item'}...`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-2 space-y-4">
          <div className="border rounded-lg bg-muted/30">
            {filteredAvailableItems?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Package className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Nenhum item encontrado</p>
                {searchTerm && (
                  <Button variant="link" size="sm" onClick={() => setSearchTerm('')} className="mt-1">
                    Limpar busca
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {Object.entries(groupedItems || {}).map(([linha, items]) => (
                  <div key={linha}>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 sticky top-0 bg-muted/80 backdrop-blur-sm">
                      {linha}
                    </div>
                    {items?.map(item => (
                      <button
                        type="button"
                        key={item.id}
                        className={`flex items-center gap-3 p-2 rounded-lg w-full text-left transition-all ${
                          selectedItemTemplateId === item.id
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'hover:bg-background border border-transparent hover:border-border'
                        }`}
                        onClick={() => {
                          setSelectedItemTemplateId(item.id);
                          setTimeout(() => {
                            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 100);
                        }}
                      >
                        <div
                          className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${
                            selectedItemTemplateId === item.id
                              ? 'bg-primary-foreground/20'
                              : 'bg-muted'
                          }`}
                        >
                          {item.image_url ? (
                            <img
                              src={resolveItemImageUrl(item.image_url)}
                              alt={item.name}
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <Package className="w-5 h-5 opacity-50" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                        </div>
                        {selectedItemTemplateId === item.id && (
                          <CheckCircle2 className="w-5 h-5 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedItemTemplateId && (
            <div className="p-2 bg-primary/10 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate">
                {filteredAvailableItems?.find(i => i.id === selectedItemTemplateId)?.name}
              </span>
            </div>
          )}

          {selectedItemTemplateId ? (
            <div ref={formRef} className="space-y-4 pt-4 border-t">
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
                    onChange={e =>
                      setPiecesQuantity(Math.max(1, parseInt(e.target.value) || 1))
                    }
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
                  Quantas unidades deste item compõem o produto
                </p>
              </div>

              {activeTab === 'glass' ? (
                <>
                  <div className="space-y-2">
                    <Label>Nome do vidro (opcional)</Label>
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
                  />
                </>
              ) : (
                <>
                  <FormulaEditor value={quantityFormula} onChange={setQuantityFormula} />
                  {activeTab === 'profile' && (
                    <div className="space-y-2">
                      <Label>Ângulo de corte</Label>
                      <div className="flex gap-2">
                        {[45, 90].map(angle => (
                          <Button
                            key={angle}
                            type="button"
                            variant={cutAngle === angle ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCutAngle(angle)}
                            className="flex-1"
                          >
                            {angle}°
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="space-y-2">
                <Label>Lado de aplicação</Label>
                <div className="flex gap-2">
                  {[
                    { value: null, label: 'Ambos' },
                    { value: 'A', label: 'Lado A' },
                    { value: 'B', label: 'Lado B' },
                    { value: 'Todos', label: 'Produto' },
                  ].map(option => (
                    <Button
                      key={String(option.value)}
                      type="button"
                      variant={side === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSide(option.value)}
                      className="flex-1"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Selecione "Produto" para itens usados uma única vez no conjunto todo (ex: kit fechadura).
                </p>
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center py-4">
                👆 Selecione um item acima para configurar
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {itemTypeTabs.map(tab => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    isActive ? 'bg-primary w-4' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  aria-label={tab.label}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={onAdd} disabled={!selectedItemTemplateId} className="gap-1">
              <Plus className="w-4 h-4" />
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
