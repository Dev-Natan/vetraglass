 import { useState, useMemo } from 'react';
 import { resolveItemImageUrl } from '@/utils/imageUrl';
 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Search, Package, Check, ArrowLeft, Hash, DollarSign, Layers } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import { useItemTypes } from '@/hooks/useItemTypes';
 import { useProductLinhas } from '@/hooks/useProductLinhas';
 
 interface AddItemPanelProps {
   onAdd: (item: {
     company_item_id: string;
     name: string;
     unit: string;
     unit_price: number;
     quantity: number;
     total_price: number;
     image_url?: string | null;
     linha?: string | null;
     type?: string;
   }) => void;
   onCancel: () => void;
 }
 
 export function AddItemPanel({ onAdd, onCancel }: AddItemPanelProps) {
   const { currentCompany } = useAuth();
   const { data: itemTypes } = useItemTypes();
   const { data: productLinhas } = useProductLinhas();
   
   const [selectedLinha, setSelectedLinha] = useState<string>('');
   const [selectedType, setSelectedType] = useState<string>('');
   const [selectedItemId, setSelectedItemId] = useState<string>('');
   const [searchQuery, setSearchQuery] = useState('');
   const [quantity, setQuantity] = useState<number>(1);
   const [customPrice, setCustomPrice] = useState<number | null>(null);
 
   // Fetch company items with stock data
   const { data: companyItems, isLoading } = useQuery({
     queryKey: ['company-items-for-quote', currentCompany?.id],
     queryFn: async () => {
       if (!currentCompany?.id) return [];
       const { data, error } = await supabase
         .from('company_items')
         .select(`
           id,
           name,
           type,
           unit,
           cost,
           sale_price,
           image_url,
           linha,
           is_custom,
           company_stock (quantity)
         `)
         .eq('company_id', currentCompany.id)
         .eq('is_active', true)
         .order('name');
       
       if (error) throw error;
       return data || [];
     },
     enabled: !!currentCompany?.id
   });
 
   // Get unique linhas from items
   const linhas = useMemo(() => {
     const linhaSet = new Set<string>();
     companyItems?.forEach(item => {
       if (item.linha) linhaSet.add(item.linha);
     });
     return Array.from(linhaSet).sort();
   }, [companyItems]);
 
   // Get types for selected linha
   const types = useMemo(() => {
     if (!selectedLinha) return [];
     const typeSet = new Set<string>();
     companyItems
       ?.filter(item => item.linha === selectedLinha)
       .forEach(item => {
         if (item.type) typeSet.add(item.type);
       });
     return Array.from(typeSet).sort();
   }, [companyItems, selectedLinha]);
 
   // Filtered items
   const filteredItems = useMemo(() => {
     if (!selectedLinha) return [];
     
     let items = companyItems || [];
     
     items = items.filter(item => item.linha === selectedLinha);
     
     if (selectedType) {
       items = items.filter(item => item.type === selectedType);
     }
     
     if (searchQuery) {
       const query = searchQuery.toLowerCase();
       items = items.filter(item => 
         item.name.toLowerCase().includes(query)
       );
     }
     
     return items;
   }, [companyItems, selectedLinha, selectedType, searchQuery]);
 
   const selectedItem = filteredItems?.find(item => item.id === selectedItemId);
   
   const unitPrice = customPrice !== null ? customPrice : (selectedItem?.sale_price || 0);
   const totalPrice = unitPrice * quantity;
 
   const getTypeLabel = (type: string) => {
     const found = itemTypes?.find(t => t.slug === type);
     return found?.name || type;
   };
 
   const getItemImage = resolveItemImageUrl;
 
   const handleLinhaChange = (value: string) => {
     setSelectedLinha(value);
     setSelectedType('');
     setSelectedItemId('');
   };
 
   const handleTypeChange = (value: string) => {
     setSelectedType(value);
     setSelectedItemId('');
   };
 
   const handleItemSelect = (itemId: string) => {
     setSelectedItemId(itemId);
     setCustomPrice(null);
   };
 
   const handleAdd = () => {
     if (!selectedItem) return;
 
     onAdd({
       company_item_id: selectedItem.id,
       name: selectedItem.name,
       unit: selectedItem.unit,
       unit_price: unitPrice,
       quantity,
       total_price: totalPrice,
       image_url: selectedItem.image_url,
       linha: selectedItem.linha,
       type: selectedItem.type,
     });
   };
 
   const formatCurrency = (value: number) => {
     return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
   };
 
   const canAdd = selectedItemId && quantity > 0 && unitPrice > 0;
 
   return (
     <div className="flex flex-col h-full min-h-0">
       {/* Header - Filters */}
       <div className="shrink-0 space-y-4 pb-4 border-b mb-4">
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
           <div className="space-y-1.5">
             <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Linha</label>
             <Select value={selectedLinha} onValueChange={handleLinhaChange}>
               <SelectTrigger className="bg-background h-10">
                 <SelectValue placeholder="Selecione a linha..." />
               </SelectTrigger>
               <SelectContent className="bg-popover border shadow-lg z-50">
                 {linhas.map((linha) => (
                   <SelectItem key={linha} value={linha}>
                     {linha}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
           <div className="space-y-1.5">
             <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Buscar</label>
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
               <Input
                 placeholder="Filtrar itens..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="pl-9 bg-background h-10"
               />
             </div>
           </div>
         </div>
 
         {/* Type Filter Chips */}
         {selectedLinha && types.length > 0 && (
           <ScrollArea className="w-full">
             <div className="flex gap-2 pb-1">
               <Badge
                 variant={selectedType === '' ? 'default' : 'outline'}
                 className="cursor-pointer shrink-0 h-8 px-4"
                 onClick={() => setSelectedType('')}
               >
                 Todos
               </Badge>
               {types.map((type) => (
                 <Badge
                   key={type}
                   variant={selectedType === type ? 'default' : 'outline'}
                   className="cursor-pointer shrink-0 h-8 px-4"
                   onClick={() => handleTypeChange(type)}
                 >
                   {getTypeLabel(type)}
                 </Badge>
               ))}
             </div>
           </ScrollArea>
         )}
       </div>
 
       {/* Scrollable - Items List */}
       <div className="flex-1 min-h-0 mb-4">
         <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
           Selecione um item {selectedLinha ? `(${filteredItems.length})` : ''}
         </label>
         <ScrollArea className="h-[240px] rounded-xl border bg-muted/20 p-3">
           {isLoading ? (
             <div className="space-y-2">
               {[1, 2, 3, 4].map((i) => (
                 <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
               ))}
             </div>
           ) : !selectedLinha ? (
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
               <Layers className="w-12 h-12 mb-3 opacity-50" />
               <p className="text-sm font-medium">Selecione uma linha</p>
               <p className="text-xs mt-1 text-center max-w-[200px]">
                 Escolha a linha do item no filtro acima
               </p>
             </div>
           ) : filteredItems.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
               <Package className="w-12 h-12 mb-3 opacity-50" />
               <p className="text-sm font-medium">Nenhum item encontrado</p>
               <p className="text-xs mt-1">Tente ajustar os filtros</p>
             </div>
           ) : (
             <div className="space-y-2">
               {filteredItems.map((item) => {
                 const isSelected = selectedItemId === item.id;
                 const imageUrl = getItemImage(item.image_url);
                 const stock = (item.company_stock as any)?.[0]?.quantity || 0;
 
                 return (
                   <button
                     key={item.id}
                     type="button"
                     onClick={() => handleItemSelect(item.id)}
                     className={cn(
                       "w-full flex items-center gap-3 p-3 rounded-lg border-2 bg-card transition-all text-left",
                       "hover:shadow-md hover:border-primary/50",
                       isSelected ? "border-primary ring-2 ring-primary/20" : "border-border"
                     )}
                   >
                     {/* Image */}
                     <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                       {imageUrl ? (
                         <img src={imageUrl} alt={item.name} className="w-full h-full object-contain" />
                       ) : (
                         <Package className="w-6 h-6 text-muted-foreground/30" />
                       )}
                     </div>
 
                     {/* Info */}
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2">
                         <span className="font-medium text-sm truncate">{item.name}</span>
                         {isSelected && (
                           <Check className="w-4 h-4 text-primary shrink-0" />
                         )}
                       </div>
                       <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                         <Badge variant="outline" className="text-[10px] h-5">
                           {getTypeLabel(item.type)}
                         </Badge>
                         <span>•</span>
                         <span>{item.unit}</span>
                         <span>•</span>
                         <span className={cn(stock <= 0 && "text-destructive")}>
                           Estoque: {stock}
                         </span>
                       </div>
                     </div>
 
                     {/* Price */}
                     <div className="text-right shrink-0">
                       <span className="text-sm font-semibold text-primary">
                         {formatCurrency(item.sale_price || 0)}
                       </span>
                       <p className="text-[10px] text-muted-foreground">/{item.unit}</p>
                     </div>
                   </button>
                 );
               })}
             </div>
           )}
         </ScrollArea>
       </div>
 
       {/* Bottom - Quantity & Price */}
       <div className="shrink-0 space-y-4 pt-4 border-t">
         {selectedItem && (
           <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
             <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
               {getItemImage(selectedItem.image_url) ? (
                 <img 
                   src={getItemImage(selectedItem.image_url)!} 
                   alt={selectedItem.name} 
                   className="w-full h-full object-contain" 
                 />
               ) : (
                 <Package className="w-5 h-5 text-muted-foreground/30" />
               )}
             </div>
             <div className="flex-1 min-w-0">
               <p className="font-medium text-sm truncate">{selectedItem.name}</p>
               <p className="text-xs text-muted-foreground">
                 {selectedItem.linha} • {selectedItem.unit}
               </p>
             </div>
           </div>
         )}
 
         <div className="grid grid-cols-2 gap-4">
           <div className="space-y-1.5">
             <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
               <Hash className="w-3 h-3" /> Quantidade
             </label>
             <Input
               type="number"
               min="1"
               step="1"
               value={quantity}
               onChange={(e) => setQuantity(Number(e.target.value) || 1)}
               className="h-12 text-lg font-medium"
               disabled={!selectedItemId}
             />
           </div>
           <div className="space-y-1.5">
             <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
               <DollarSign className="w-3 h-3" /> Preço Unitário
             </label>
             <Input
               type="number"
               min="0"
               step="0.01"
               value={customPrice !== null ? customPrice : (selectedItem?.sale_price || 0)}
               onChange={(e) => setCustomPrice(Number(e.target.value))}
               className="h-12 text-lg font-medium"
               disabled={!selectedItemId}
             />
           </div>
         </div>
 
         {/* Total */}
         {selectedItem && (
           <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
             <span className="text-sm font-medium text-muted-foreground">Total do Item</span>
             <span className="text-2xl font-bold text-primary">
               {formatCurrency(totalPrice)}
             </span>
           </div>
         )}
 
         {/* Actions */}
         <div className="flex gap-3">
           <Button
             type="button"
             variant="outline"
             onClick={onCancel}
             className="flex-1"
           >
             <ArrowLeft className="w-4 h-4 mr-2" />
             Voltar
           </Button>
           <Button
             type="button"
             onClick={handleAdd}
             disabled={!canAdd}
             className="flex-1"
           >
             <Check className="w-4 h-4 mr-2" />
             Adicionar Item
           </Button>
         </div>
       </div>
     </div>
   );
 }