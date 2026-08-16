import { parseCurrencyBRL } from '@/utils/currencyMask';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Trash2, Plus, ArrowLeftRight, Search, Package, AlertTriangle } from 'lucide-react';
import { SaleCompositionLine } from '@/utils/buildCompositionFromFormula';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createUuid } from '@/utils/createUuid';

interface StockOption {
  company_item_id: string;
  item_template_id: string | null;
  name: string;
  unit: string;
  type: string;
  available: number;
}

interface ProductCompositionEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  initialLines: SaleCompositionLine[];
  onSave: (lines: SaleCompositionLine[]) => void;
}

export function ProductCompositionEditor({
  open,
  onOpenChange,
  productName,
  initialLines,
  onSave,
}: ProductCompositionEditorProps) {
  const { currentCompany } = useAuth();
  const [lines, setLines] = useState<SaleCompositionLine[]>(initialLines);
  const [search, setSearch] = useState('');
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);

  // Reset whenever sheet opens with new product
  useMemo(() => { if (open) setLines(initialLines); }, [open, initialLines]);

  const { data: stockOptions = [] } = useQuery<StockOption[]>({
    queryKey: ['composition-stock-options', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_items')
        .select(`id, item_template_id, name, unit, type,
                 company_stock!company_stock_company_item_id_fkey (quantity)`)
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name');
      if (error) {
        // Fallback without nested select if FK alias not present
        const { data: items } = await supabase
          .from('company_items')
          .select('id, item_template_id, name, unit, type')
          .eq('company_id', currentCompany.id)
          .eq('is_active', true)
          .order('name');
        const { data: stocks } = await supabase
          .from('company_stock')
          .select('company_item_id, quantity')
          .eq('company_id', currentCompany.id);
        const stockMap = new Map((stocks || []).map((s: any) => [s.company_item_id, s.quantity]));
        return (items || []).map((i: any) => ({
          company_item_id: i.id,
          item_template_id: i.item_template_id,
          name: i.name,
          unit: i.unit,
          type: i.type,
          available: Number(stockMap.get(i.id) || 0),
        }));
      }
      return (data || []).map((i: any) => ({
        company_item_id: i.id,
        item_template_id: i.item_template_id,
        name: i.name,
        unit: i.unit,
        type: i.type,
        available: Number(i.company_stock?.[0]?.quantity || 0),
      }));
    },
    enabled: open && !!currentCompany?.id,
    staleTime: 30 * 1000,
  });

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stockOptions.slice(0, 50);
    return stockOptions
      .filter((o) => o.name.toLowerCase().includes(q) || o.type.toLowerCase().includes(q))
      .slice(0, 50);
  }, [stockOptions, search]);

  const updateQty = (id: string, value: string) => {
    const qty = parseCurrencyBRL(value);
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, quantity: qty } : l)));
  };

  const remove = (id: string) => setLines((p) => p.filter((l) => l.id !== id));

  const swap = (id: string, option: StockOption) => {
    setLines((p) =>
      p.map((l) =>
        l.id === id
          ? {
              ...l,
              companyItemId: option.company_item_id,
              itemTemplateId: option.item_template_id,
              itemName: option.name,
              unit: option.unit,
              itemType: option.type,
              stockAvailable: option.available,
              source: 'manual_swap',
            }
          : l,
      ),
    );
  };

  const addLine = (option: StockOption) => {
    if (lines.some((l) => l.companyItemId === option.company_item_id)) {
      toast.info('Esse item já está na composição');
      return;
    }
    setLines((p) => [
      ...p,
      {
        id: createUuid(),
        companyItemId: option.company_item_id,
        itemTemplateId: option.item_template_id,
        itemName: option.name,
        unit: option.unit,
        itemType: option.type,
        quantity: 1,
        source: 'manual_add',
        stockAvailable: option.available,
      },
    ]);
    setAddPopoverOpen(false);
    setSearch('');
  };

  const handleSave = () => {
    const valid = lines.filter((l) => l.quantity > 0);
    onSave(valid);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>Composição do produto</SheetTitle>
          <SheetDescription className="text-xs">
            {productName} — ajuste, troque ou adicione os itens de estoque que serão consumidos nesta venda.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-2">
            {lines.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12 border-2 border-dashed rounded-lg">
                Nenhum item na composição. Adicione manualmente abaixo.
              </div>
            )}
            {lines.map((line) => {
              const exceeds =
                line.stockAvailable !== undefined && line.quantity > line.stockAvailable;
              return (
                <div
                  key={line.id}
                  className={cn(
                    'p-3 rounded-lg border bg-card flex items-center gap-3',
                    exceeds && 'border-destructive/60 bg-destructive/5',
                  )}
                >
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{line.itemName}</p>
                      {line.source !== 'formula' && (
                        <Badge variant="outline" className="text-[10px] h-4">
                          {line.source === 'manual_add' ? 'manual' : 'trocado'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Estoque:{' '}
                      <span className={cn(exceeds && 'text-destructive font-medium')}>
                        {line.stockAvailable?.toLocaleString('pt-BR') ?? '—'} {line.unit}
                      </span>
                      {exceeds && (
                        <AlertTriangle className="inline-block ml-1 h-3 w-3 text-destructive" />
                      )}
                    </p>
                  </div>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={String(line.quantity).replace('.', ',')}
                    onChange={(e) => updateQty(line.id, e.target.value)}
                    className="h-8 w-20 text-right text-sm"
                  />
                  <span className="text-xs text-muted-foreground w-8">{line.unit}</span>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Trocar item">
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-0">
                      <SwapList
                        options={stockOptions}
                        onSelect={(opt) => swap(line.id, opt)}
                      />
                    </PopoverContent>
                  </Popover>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => remove(line.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <SheetFooter className="p-4 border-t flex-row gap-2 sm:gap-2">
          <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1">
                <Plus className="h-4 w-4 mr-2" /> Adicionar item do estoque
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-96 p-0">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Buscar item..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-7 h-8 text-sm"
                  />
                </div>
              </div>
              <ScrollArea className="max-h-72">
                <div className="p-1">
                  {filteredOptions.length === 0 && (
                    <p className="text-xs text-muted-foreground p-3 text-center">
                      Nenhum item encontrado
                    </p>
                  )}
                  {filteredOptions.map((opt) => (
                    <button
                      key={opt.company_item_id}
                      type="button"
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-sm flex items-center justify-between gap-2"
                      onClick={() => addLine(opt)}
                    >
                      <span className="truncate">{opt.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {opt.available} {opt.unit}
                      </span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <Button onClick={handleSave} className="flex-1">
            Confirmar composição
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function SwapList({
  options,
  onSelect,
}: {
  options: StockOption[];
  onSelect: (o: StockOption) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, 50);
    return options.filter((o) => o.name.toLowerCase().includes(s)).slice(0, 50);
  }, [options, q]);
  return (
    <>
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Trocar por..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>
      </div>
      <ScrollArea className="max-h-72">
        <div className="p-1">
          {filtered.map((opt) => (
            <button
              key={opt.company_item_id}
              type="button"
              className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-sm flex items-center justify-between gap-2"
              onClick={() => onSelect(opt)}
            >
              <span className="truncate">{opt.name}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {opt.available} {opt.unit}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </>
  );
}
