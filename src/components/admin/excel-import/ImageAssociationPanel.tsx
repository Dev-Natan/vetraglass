import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ParsedProduct, ParsedCuttingItem } from "@/utils/parseExcelCuttingSheet";
import { ExtractedImage, bufferToDataUrl } from "@/utils/excelImageExtractor";
import { Image, Package, Layers, X, Check, AlertTriangle } from "lucide-react";

export interface ImageAssignment {
  imageIndex: number;
  targetType: 'product' | 'item';
  productIndex?: number;
  itemName?: string; // normalized item name
}

interface ImageAssociationPanelProps {
  products: ParsedProduct[];
  extractedImages: ExtractedImage[];
  imageAssignments: Map<number, ImageAssignment>;
  onAssignmentsChange: (assignments: Map<number, ImageAssignment>) => void;
}

export function ImageAssociationPanel({
  products,
  extractedImages,
  imageAssignments,
  onAssignmentsChange,
}: ImageAssociationPanelProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  // Get unique items from all products for the dropdown
  const uniqueItems = useMemo(() => {
    const itemMap = new Map<string, { name: string; code?: string; type: string }>();
    
    for (const product of products) {
      for (const item of product.items) {
        const key = item.code ? `${item.code} - ${item.name}` : item.name;
        if (!itemMap.has(key.toLowerCase())) {
          itemMap.set(key.toLowerCase(), {
            name: key,
            code: item.code,
            type: item.type,
          });
        }
      }
    }
    
    return Array.from(itemMap.values());
  }, [products]);

  const handleAssignToProduct = (imageIndex: number, productIndex: number) => {
    const newAssignments = new Map(imageAssignments);
    
    if (productIndex === -1) {
      // Unassign
      newAssignments.delete(imageIndex);
    } else {
      newAssignments.set(imageIndex, {
        imageIndex,
        targetType: 'product',
        productIndex,
      });
    }
    
    onAssignmentsChange(newAssignments);
  };

  const handleAssignToItem = (imageIndex: number, itemName: string) => {
    const newAssignments = new Map(imageAssignments);
    
    if (itemName === '__none__') {
      newAssignments.delete(imageIndex);
    } else {
      newAssignments.set(imageIndex, {
        imageIndex,
        targetType: 'item',
        itemName: itemName.toLowerCase(),
      });
    }
    
    onAssignmentsChange(newAssignments);
  };

  const getAssignmentLabel = (imageIndex: number): string | null => {
    const assignment = imageAssignments.get(imageIndex);
    if (!assignment) return null;
    
    if (assignment.targetType === 'product' && assignment.productIndex !== undefined) {
      return `Produto: ${products[assignment.productIndex]?.name || 'Desconhecido'}`;
    }
    
    if (assignment.targetType === 'item' && assignment.itemName) {
      const item = uniqueItems.find(i => i.name.toLowerCase() === assignment.itemName);
      return `Item: ${item?.name || assignment.itemName}`;
    }
    
    return null;
  };

  const getAssignmentValue = (imageIndex: number): string => {
    const assignment = imageAssignments.get(imageIndex);
    if (!assignment) return '__none__';
    
    if (assignment.targetType === 'product' && assignment.productIndex !== undefined) {
      return `product:${assignment.productIndex}`;
    }
    
    if (assignment.targetType === 'item' && assignment.itemName) {
      return `item:${assignment.itemName}`;
    }
    
    return '__none__';
  };

  const handleValueChange = (imageIndex: number, value: string) => {
    if (value === '__none__') {
      const newAssignments = new Map(imageAssignments);
      newAssignments.delete(imageIndex);
      onAssignmentsChange(newAssignments);
      return;
    }
    
    const [type, indexOrName] = value.split(':');
    
    if (type === 'product') {
      handleAssignToProduct(imageIndex, parseInt(indexOrName));
    } else if (type === 'item') {
      handleAssignToItem(imageIndex, indexOrName);
    }
  };

  if (extractedImages.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhuma imagem encontrada nos arquivos Excel</p>
        </CardContent>
      </Card>
    );
  }

  const assignedCount = imageAssignments.size;
  const unassignedCount = extractedImages.length - assignedCount;

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Image className="h-4 w-4" />
            Associar Imagens ({extractedImages.length})
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-green-50 text-green-700">
              <Check className="h-3 w-3 mr-1" />
              {assignedCount} associadas
            </Badge>
            {unassignedCount > 0 && (
              <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {unassignedCount} sem associação
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {extractedImages.map((image, index) => {
              const dataUrl = bufferToDataUrl(image.buffer, image.mimeType);
              const assignment = imageAssignments.get(index);
              const isAssigned = !!assignment;
              
              return (
                <Card 
                  key={index} 
                  className={`overflow-hidden transition-all ${
                    isAssigned 
                      ? 'ring-2 ring-green-500 ring-offset-1' 
                      : 'hover:ring-2 hover:ring-primary/50'
                  }`}
                >
                  <div className="aspect-square relative bg-muted">
                    <img
                      src={dataUrl}
                      alt={`Imagem ${index + 1}`}
                      className="absolute inset-0 w-full h-full object-contain p-1"
                    />
                    {isAssigned && (
                      <div className="absolute top-1 right-1">
                        <Badge variant="default" className="bg-green-600 text-xs">
                          <Check className="h-3 w-3" />
                        </Badge>
                      </div>
                    )}
                    <Badge 
                      variant="secondary" 
                      className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white"
                    >
                      Linha {image.rowIndex}
                    </Badge>
                  </div>
                  
                  <div className="p-2 space-y-1.5">
                    <Select
                      value={getAssignmentValue(index)}
                      onValueChange={(value) => handleValueChange(index, value)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecionar destino..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="__none__" className="text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <X className="h-3 w-3" />
                            Não importar
                          </div>
                        </SelectItem>
                        
                        <Separator className="my-1" />
                        
                        {/* Products section */}
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                          Produtos
                        </div>
                        {products.map((product, productIndex) => (
                          <SelectItem 
                            key={`product:${productIndex}`} 
                            value={`product:${productIndex}`}
                          >
                            <div className="flex items-center gap-1">
                              <Package className="h-3 w-3 text-primary" />
                              <span className="truncate max-w-[180px]">{product.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                        
                        <Separator className="my-1" />
                        
                        {/* Items section */}
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                          Itens/Perfis ({uniqueItems.length})
                        </div>
                        {uniqueItems.slice(0, 50).map((item) => (
                          <SelectItem 
                            key={`item:${item.name.toLowerCase()}`} 
                            value={`item:${item.name.toLowerCase()}`}
                          >
                            <div className="flex items-center gap-1">
                              <Layers className="h-3 w-3 text-secondary-foreground" />
                              <span className="truncate max-w-[180px]">{item.name}</span>
                              <Badge variant="outline" className="text-[9px] ml-1">
                                {item.type === 'profile' ? 'Perfil' : 'Acess.'}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                        {uniqueItems.length > 50 && (
                          <div className="px-2 py-1 text-xs text-muted-foreground">
                            +{uniqueItems.length - 50} itens...
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    
                    {assignment && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        → {getAssignmentLabel(index)}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
