import { resolveImageUrl } from '@/utils/imageUrl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Layers, Package, Gem, Frame } from 'lucide-react';

interface CompositionItem {
  id: string;
  quantity_formula: string;
  width_formula: string | null;
  height_formula: string | null;
  pieces_quantity: number | null;
  cut_angle: number | null;
  notes: string | null;
  sort_order: number | null;
  section?: string | null;
  is_optional?: boolean | null;
  item_template?: {
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
    linha: string | null;
  } | null;
  company_item?: {
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
  } | null;
}

interface CompositionSectionsProps {
  items: CompositionItem[];
  onAddItem: (section: 'profile' | 'accessory' | 'glass' | 'contramarco') => void;
  onEditItem: (item: CompositionItem) => void;
  onRemoveItem: (itemId: string) => void;
}

const getStorageUrl = (path: string | null) => resolveImageUrl(path, 'item-templates');

const getCutAngleLabel = (angle: number | null) => {
  if (!angle) return '-';
  if (angle === 45) return 'L45/45';
  if (angle === 90) return 'H90/90';
  return `${angle}°`;
};

function SectionHeader({ 
  icon: Icon, 
  title, 
  count, 
  buttonLabel, 
  onAdd 
}: { 
  icon: any; 
  title: string; 
  count: number; 
  buttonLabel: string; 
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-0">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
        <Badge variant="secondary" className="text-xs">{count} itens</Badge>
      </div>
      <Button size="sm" variant="default" className="gap-1.5 h-8" onClick={onAdd}>
        <Plus className="w-3.5 h-3.5" />
        {buttonLabel}
      </Button>
    </div>
  );
}

function ItemActions({ item, onEdit, onRemove }: { item: CompositionItem; onEdit: () => void; onRemove: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-7 h-7">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
        <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={onRemove}>Remover</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ItemImage({ item }: { item: CompositionItem }) {
  const itemData = item.item_template || item.company_item;
  return (
    <div className="w-10 h-10 rounded border bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
      {itemData?.image_url ? (
        <img
          src={getStorageUrl(itemData.image_url)}
          alt={itemData?.name}
          className="w-full h-full object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement!.innerHTML = '<span class="text-xs text-muted-foreground/50">📦</span>';
          }}
        />
      ) : (
        <span className="text-xs text-muted-foreground/50">📦</span>
      )}
    </div>
  );
}

function ItemCode({ item }: { item: CompositionItem }) {
  const itemData = item.item_template || item.company_item;
  const linha = item.item_template?.linha;
  // Extract code-like identifier from name or linha
  const code = linha || '-';
  return (
    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0.5 bg-primary/5 text-primary border-primary/20">
      {code}
    </Badge>
  );
}

// ==================== PERFIS SECTION ====================
function ProfilesSection({ items, onAdd, onEdit, onRemove }: {
  items: CompositionItem[];
  onAdd: () => void;
  onEdit: (item: CompositionItem) => void;
  onRemove: (id: string) => void;
}) {
  // Calculate total weight (simplified - would need actual weight data)
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <SectionHeader icon={Layers} title="Perfis" count={items.length} buttonLabel="Adicionar Perfil" onAdd={onAdd} />
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 px-4">
            Nenhum perfil adicionado. Clique em "Adicionar Perfil".
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground text-xs">Imagem</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Código</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Nome</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Qtd.</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Comprimento</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Corte</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground text-xs">Opções</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const itemData = item.item_template || item.company_item;
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onEdit(item)}>
                      <td className="py-2 px-4"><ItemImage item={item} /></td>
                      <td className="py-2 px-2"><ItemCode item={item} /></td>
                      <td className="py-2 px-2 font-medium text-primary">{itemData?.name}</td>
                      <td className="py-2 px-2 text-center">
                        {(item as any).pieces_formula ? (
                          <div className="flex flex-col items-center">
                            <span className="text-primary font-bold">f(x)</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[60px]" title={(item as any).pieces_formula}>
                              {(item as any).pieces_formula}
                            </span>
                          </div>
                        ) : (
                          item.pieces_quantity || 1
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-xs text-muted-foreground">{item.quantity_formula}</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {getCutAngleLabel(item.cut_angle)}
                        </Badge>
                      </td>
                      <td className="py-2 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <ItemActions item={item} onEdit={() => onEdit(item)} onRemove={() => onRemove(item.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== COMPONENTES SECTION ====================
function ComponentsSection({ items, onAdd, onEdit, onRemove }: {
  items: CompositionItem[];
  onAdd: () => void;
  onEdit: (item: CompositionItem) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <SectionHeader icon={Package} title="Componentes" count={items.length} buttonLabel="Adicionar Componente" onAdd={onAdd} />
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 px-4">
            Nenhum componente adicionado. Clique em "Adicionar Componente".
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground text-xs">Imagem</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Código</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Nome</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Quantidade</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground text-xs">Opções</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const itemData = item.item_template || item.company_item;
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onEdit(item)}>
                      <td className="py-2 px-4"><ItemImage item={item} /></td>
                      <td className="py-2 px-2"><ItemCode item={item} /></td>
                      <td className="py-2 px-2 font-medium text-primary">{itemData?.name}</td>
                      <td className="py-2 px-2 text-center">
                        <span>{item.quantity_formula}</span>
                        <span className="text-xs text-muted-foreground ml-1">{itemData?.unit === 'metro' ? 'm' : itemData?.unit === 'barra' ? 'br' : 'pç'}</span>
                      </td>
                      <td className="py-2 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <ItemActions item={item} onEdit={() => onEdit(item)} onRemove={() => onRemove(item.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== VIDROS SECTION ====================
function GlassSection({ items, onAdd, onEdit, onRemove }: {
  items: CompositionItem[];
  onAdd: () => void;
  onEdit: (item: CompositionItem) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <SectionHeader icon={Gem} title="Vidros" count={items.length} buttonLabel="Adicionar Vidro" onAdd={onAdd} />
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 px-4">
            Nenhum vidro adicionado. Clique em "Adicionar Vidro".
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground text-xs">Imagem</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Código</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Nome</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Largura</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Altura</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Quantidade</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground text-xs">Opções</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const itemData = item.item_template || item.company_item;
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onEdit(item)}>
                      <td className="py-2 px-4"><ItemImage item={item} /></td>
                      <td className="py-2 px-2"><ItemCode item={item} /></td>
                      <td className="py-2 px-2 font-medium text-primary">
                        {item.notes || itemData?.name}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-xs">{item.width_formula || '-'}</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-xs">{item.height_formula || '-'}</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {(item as any).pieces_formula ? (
                          <div className="flex flex-col items-center">
                            <span className="text-primary font-bold">f(x)</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[60px]" title={(item as any).pieces_formula}>
                              {(item as any).pieces_formula}
                            </span>
                          </div>
                        ) : (
                          item.pieces_quantity || 1
                        )}
                      </td>
                      <td className="py-2 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <ItemActions item={item} onEdit={() => onEdit(item)} onRemove={() => onRemove(item.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== CONTRAMARCO SECTION ====================
function ContramarcoSection({ items, onAdd, onEdit, onRemove }: {
  items: CompositionItem[];
  onAdd: () => void;
  onEdit: (item: CompositionItem) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-2 pt-4 px-4">
        <SectionHeader icon={Frame} title="Contramarco (Opcional)" count={items.length} buttonLabel="Adicionar Contramarco" onAdd={onAdd} />
        <p className="text-xs text-muted-foreground mt-1">
          Itens opcionais — incluídos no plano de corte apenas quando ativados no orçamento
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 px-4">
            Nenhum contramarco adicionado. Clique em "Adicionar Contramarco".
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-amber-50/50 dark:bg-amber-900/10">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground text-xs">Imagem</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Código</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Nome</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Qtd.</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Comprimento</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Corte</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground text-xs">Opções</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const itemData = item.item_template || item.company_item;
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onEdit(item)}>
                      <td className="py-2 px-4"><ItemImage item={item} /></td>
                      <td className="py-2 px-2"><ItemCode item={item} /></td>
                      <td className="py-2 px-2 font-medium text-primary">{itemData?.name}</td>
                      <td className="py-2 px-2 text-center">{item.pieces_quantity || 1}</td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-xs text-muted-foreground">{item.quantity_formula}</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {getCutAngleLabel(item.cut_angle)}
                        </Badge>
                      </td>
                      <td className="py-2 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <ItemActions item={item} onEdit={() => onEdit(item)} onRemove={() => onRemove(item.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== MAIN EXPORT ====================
export function CompositionSections({ items, onAddItem, onEditItem, onRemoveItem }: CompositionSectionsProps) {
  // Separate contramarco items first (by section field)
  const contramarcoItems = items.filter(i => (i as any).section === 'contramarco');
  const nonContramarcoItems = items.filter(i => (i as any).section !== 'contramarco');

  const profiles = nonContramarcoItems.filter(i => {
    const type = i.item_template?.type || i.company_item?.type;
    return type === 'profile';
  });
  
  const components = nonContramarcoItems.filter(i => {
    const type = i.item_template?.type || i.company_item?.type;
    return type === 'accessory';
  });
  
  const glasses = nonContramarcoItems.filter(i => {
    const type = i.item_template?.type || i.company_item?.type;
    return type === 'glass';
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Materiais da tipologia</h2>
        <p className="text-sm text-muted-foreground">
          {items.length} itens configurados
        </p>
      </div>

      <ProfilesSection 
        items={profiles} 
        onAdd={() => onAddItem('profile')} 
        onEdit={onEditItem} 
        onRemove={onRemoveItem} 
      />
      
      <ComponentsSection 
        items={components} 
        onAdd={() => onAddItem('accessory')} 
        onEdit={onEditItem} 
        onRemove={onRemoveItem} 
      />
      
      <GlassSection 
        items={glasses} 
        onAdd={() => onAddItem('glass')} 
        onEdit={onEditItem} 
        onRemove={onRemoveItem} 
      />

      <ContramarcoSection 
        items={contramarcoItems} 
        onAdd={() => onAddItem('contramarco')} 
        onEdit={onEditItem} 
        onRemove={onRemoveItem} 
      />
    </div>
  );
}
