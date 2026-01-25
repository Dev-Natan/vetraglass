import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParsedProduct, ParsedCuttingItem } from "@/utils/parseExcelCuttingSheet";
import { ExtractedImage, bufferToDataUrl } from "@/utils/excelImageExtractor";
import { Image, Package, Layers, Check, AlertTriangle, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImageAssignment {
  imageIndex: number;
  targetType: 'product' | 'item';
  productIndex?: number;
  itemName?: string;
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
  const [selectedTarget, setSelectedTarget] = useState<{
    type: 'product' | 'item';
    id: string;
  } | null>(null);

  // Get unique items from all products
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

  // Get currently assigned image for a target
  const getAssignedImage = (type: 'product' | 'item', id: string): number | null => {
    for (const [imageIndex, assignment] of imageAssignments.entries()) {
      if (type === 'product' && assignment.targetType === 'product') {
        if (assignment.productIndex?.toString() === id) return imageIndex;
      } else if (type === 'item' && assignment.targetType === 'item') {
        if (assignment.itemName === id) return imageIndex;
      }
    }
    return null;
  };

  // Handle selecting a target (product or item)
  const handleSelectTarget = (type: 'product' | 'item', id: string) => {
    if (selectedTarget?.type === type && selectedTarget?.id === id) {
      setSelectedTarget(null);
    } else {
      setSelectedTarget({ type, id });
    }
  };

  // Handle assigning an image to the selected target
  const handleAssignImage = (imageIndex: number) => {
    if (!selectedTarget) return;

    const newAssignments = new Map(imageAssignments);

    // Remove any existing assignment for this target
    for (const [idx, assignment] of newAssignments.entries()) {
      if (selectedTarget.type === 'product' && assignment.targetType === 'product') {
        if (assignment.productIndex?.toString() === selectedTarget.id) {
          newAssignments.delete(idx);
        }
      } else if (selectedTarget.type === 'item' && assignment.targetType === 'item') {
        if (assignment.itemName === selectedTarget.id) {
          newAssignments.delete(idx);
        }
      }
    }

    // Remove any existing assignment for this image
    newAssignments.delete(imageIndex);

    // Create new assignment
    if (selectedTarget.type === 'product') {
      newAssignments.set(imageIndex, {
        imageIndex,
        targetType: 'product',
        productIndex: parseInt(selectedTarget.id),
      });
    } else {
      newAssignments.set(imageIndex, {
        imageIndex,
        targetType: 'item',
        itemName: selectedTarget.id,
      });
    }

    onAssignmentsChange(newAssignments);
    setSelectedTarget(null);
  };

  // Remove assignment for a target
  const handleRemoveAssignment = (type: 'product' | 'item', id: string) => {
    const newAssignments = new Map(imageAssignments);
    
    for (const [idx, assignment] of newAssignments.entries()) {
      if (type === 'product' && assignment.targetType === 'product') {
        if (assignment.productIndex?.toString() === id) {
          newAssignments.delete(idx);
          break;
        }
      } else if (type === 'item' && assignment.targetType === 'item') {
        if (assignment.itemName === id) {
          newAssignments.delete(idx);
          break;
        }
      }
    }
    
    onAssignmentsChange(newAssignments);
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

  const productsWithImages = products.filter((_, i) => getAssignedImage('product', i.toString()) !== null).length;
  const itemsWithImages = uniqueItems.filter(item => getAssignedImage('item', item.name.toLowerCase()) !== null).length;

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Image className="h-4 w-4" />
            Associar Imagens
          </CardTitle>
          <div className="flex gap-2 text-xs">
            <Badge variant="secondary" className="bg-green-50 text-green-700">
              <Check className="h-3 w-3 mr-1" />
              {productsWithImages}/{products.length} produtos
            </Badge>
            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
              <Check className="h-3 w-3 mr-1" />
              {itemsWithImages}/{uniqueItems.length} itens
            </Badge>
          </div>
        </div>
        {selectedTarget && (
          <div className="mt-2 p-2 bg-primary/10 rounded-md text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <span>
              Selecione uma imagem abaixo para{' '}
              <strong>
                {selectedTarget.type === 'product' 
                  ? products[parseInt(selectedTarget.id)]?.name 
                  : uniqueItems.find(i => i.name.toLowerCase() === selectedTarget.id)?.name}
              </strong>
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="w-full rounded-none border-b">
            <TabsTrigger value="products" className="flex-1">
              <Package className="h-4 w-4 mr-2" />
              Produtos ({products.length})
            </TabsTrigger>
            <TabsTrigger value="items" className="flex-1">
              <Layers className="h-4 w-4 mr-2" />
              Perfis/Itens ({uniqueItems.length})
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-0">
            <ScrollArea className="h-[200px]">
              <div className="p-3 space-y-2">
                {products.map((product, index) => {
                  const assignedImageIdx = getAssignedImage('product', index.toString());
                  const isSelected = selectedTarget?.type === 'product' && selectedTarget?.id === index.toString();
                  
                  return (
                    <div
                      key={index}
                      onClick={() => handleSelectTarget('product', index.toString())}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        isSelected 
                          ? "border-primary bg-primary/5 ring-2 ring-primary" 
                          : "hover:border-primary/50 hover:bg-muted/50",
                        assignedImageIdx !== null && !isSelected && "border-green-300 bg-green-50/50"
                      )}
                    >
                      {/* Image preview or placeholder */}
                      <div className="w-16 h-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {assignedImageIdx !== null ? (
                          <img
                            src={bufferToDataUrl(
                              extractedImages[assignedImageIdx].buffer,
                              extractedImages[assignedImageIdx].mimeType
                            )}
                            alt={product.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageOff className="h-6 w-6 text-muted-foreground/50" />
                        )}
                      </div>
                      
                      {/* Product info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{product.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {product.items.length} itens • {product.linha || 'Sem linha'}
                        </p>
                      </div>

                      {/* Status badge */}
                      {assignedImageIdx !== null ? (
                        <Badge 
                          variant="outline" 
                          className="bg-green-100 text-green-700 border-green-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAssignment('product', index.toString());
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Imagem definida
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Clique para selecionar
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="mt-0">
            <ScrollArea className="h-[200px]">
              <div className="p-3 space-y-2">
                {uniqueItems.map((item) => {
                  const itemKey = item.name.toLowerCase();
                  const assignedImageIdx = getAssignedImage('item', itemKey);
                  const isSelected = selectedTarget?.type === 'item' && selectedTarget?.id === itemKey;
                  
                  return (
                    <div
                      key={itemKey}
                      onClick={() => handleSelectTarget('item', itemKey)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        isSelected 
                          ? "border-primary bg-primary/5 ring-2 ring-primary" 
                          : "hover:border-primary/50 hover:bg-muted/50",
                        assignedImageIdx !== null && !isSelected && "border-green-300 bg-green-50/50"
                      )}
                    >
                      {/* Image preview or placeholder */}
                      <div className="w-12 h-12 rounded-md border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {assignedImageIdx !== null ? (
                          <img
                            src={bufferToDataUrl(
                              extractedImages[assignedImageIdx].buffer,
                              extractedImages[assignedImageIdx].mimeType
                            )}
                            alt={item.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageOff className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </div>
                      
                      {/* Item info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm truncate">{item.name}</h4>
                          <Badge variant="outline" className="text-[10px]">
                            {item.type === 'profile' ? 'Perfil' : 'Acessório'}
                          </Badge>
                        </div>
                      </div>

                      {/* Status */}
                      {assignedImageIdx !== null ? (
                        <Badge 
                          variant="outline" 
                          className="bg-green-100 text-green-700 border-green-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAssignment('item', itemKey);
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          Selecionar
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Images Grid */}
        <div className="p-3">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Image className="h-4 w-4" />
            Imagens Disponíveis ({extractedImages.length})
          </h4>
          <ScrollArea className="h-[180px]">
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {extractedImages.map((image, index) => {
                const dataUrl = bufferToDataUrl(image.buffer, image.mimeType);
                const assignment = imageAssignments.get(index);
                const isAssigned = !!assignment;
                
                return (
                  <div
                    key={index}
                    onClick={() => selectedTarget && handleAssignImage(index)}
                    className={cn(
                      "aspect-square rounded-md border overflow-hidden transition-all relative group",
                      selectedTarget 
                        ? "cursor-pointer hover:ring-2 hover:ring-primary hover:scale-105" 
                        : "cursor-default",
                      isAssigned && "ring-2 ring-green-500 opacity-60"
                    )}
                  >
                    <img
                      src={dataUrl}
                      alt={`Imagem ${index + 1}`}
                      className="w-full h-full object-contain bg-muted p-0.5"
                    />
                    
                    {isAssigned && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                        <Check className="h-6 w-6 text-green-600" />
                      </div>
                    )}
                    
                    <Badge 
                      variant="secondary" 
                      className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/70 text-white px-1"
                    >
                      L{image.rowIndex}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
