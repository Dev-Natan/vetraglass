import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParsedProduct, ParsedCuttingItem, extractUniqueItemTemplates } from "@/utils/parseExcelCuttingSheet";
import { useProductCategories } from "@/hooks/useProductCategories";
import { Package, Layers, Edit2, Check, X, Plus } from "lucide-react";

interface ExcelImportPreviewProps {
  products: ParsedProduct[];
  onProductsChange: (products: ParsedProduct[]) => void;
  existingItemTemplates: { id: string; name: string; code?: string }[];
  onNewCategoryRequest?: (name: string) => void;
}

export function ExcelImportPreview({ 
  products, 
  onProductsChange,
  existingItemTemplates,
  onNewCategoryRequest
}: ExcelImportPreviewProps) {
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(
    new Set(products.map((_, i) => i))
  );
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [editedName, setEditedName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  
  const { data: categories = [] } = useProductCategories(true);
  
  const handleCategoryChange = (productIndex: number, categorySlug: string) => {
    if (categorySlug === '__new__') {
      setCreatingCategory(productIndex);
      setNewCategoryName("");
      return;
    }
    
    const newProducts = [...products];
    newProducts[productIndex] = { ...newProducts[productIndex], category: categorySlug };
    onProductsChange(newProducts);
  };
  
  const handleCreateNewCategory = (productIndex: number) => {
    if (!newCategoryName.trim()) return;
    
    // Add the new category name to the product (will be created during import)
    const newProducts = [...products];
    newProducts[productIndex] = { 
      ...newProducts[productIndex], 
      category: `new:${newCategoryName.trim()}` 
    };
    onProductsChange(newProducts);
    
    if (onNewCategoryRequest) {
      onNewCategoryRequest(newCategoryName.trim());
    }
    
    setCreatingCategory(null);
    setNewCategoryName("");
  };
  
  const cancelCreateCategory = () => {
    setCreatingCategory(null);
    setNewCategoryName("");
  };
  const uniqueItems = extractUniqueItemTemplates(products);
  
  // Check which items already exist
  const itemExistenceMap = new Map<string, string>();
  for (const item of uniqueItems) {
    const key = item.name.toLowerCase();
    const existing = existingItemTemplates.find(
      t => t.name.toLowerCase().includes(key) || 
           key.includes(t.name.toLowerCase())
    );
    if (existing) {
      itemExistenceMap.set(key, existing.id);
    }
  }

  const toggleProduct = (index: number) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedProducts(newSelected);
  };

  const startEditingProduct = (index: number) => {
    setEditingProduct(index);
    setEditedName(products[index].name);
  };

  const saveProductEdit = (index: number) => {
    const newProducts = [...products];
    newProducts[index] = { ...newProducts[index], name: editedName };
    onProductsChange(newProducts);
    setEditingProduct(null);
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setEditedName("");
  };

  const newItemsCount = uniqueItems.filter(
    item => !itemExistenceMap.has(item.name.toLowerCase())
  ).length;

  const existingItemsCount = uniqueItems.length - newItemsCount;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Produtos ({products.length})
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Itens Templates ({uniqueItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">
                Produtos a Importar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Nome do Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Linha</TableHead>
                      <TableHead className="text-center">Componentes</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Checkbox
                            checked={selectedProducts.has(index)}
                            onCheckedChange={() => toggleProduct(index)}
                          />
                        </TableCell>
                        <TableCell>
                          {editingProduct === index ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="h-8"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => saveProductEdit(index)}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={cancelEdit}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-medium">{product.name}</span>
                              <span className="text-xs text-muted-foreground">{product.fileName}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {creatingCategory === index ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Nova categoria"
                                className="h-8 w-32"
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleCreateNewCategory(index)}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={cancelCreateCategory}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <Select
                              value={product.category.startsWith('new:') ? product.category : product.category}
                              onValueChange={(value) => handleCategoryChange(index, value)}
                            >
                              <SelectTrigger className="h-8 w-36">
                                <SelectValue>
                                  {product.category.startsWith('new:') 
                                    ? product.category.replace('new:', '') 
                                    : categories.find(c => c.slug === product.category)?.name || product.category}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.slug}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__new__" className="text-primary font-medium">
                                  <div className="flex items-center gap-1">
                                    <Plus className="h-3 w-3" />
                                    Nova Categoria
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>{product.linha}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{product.items.length}</Badge>
                        </TableCell>
                        <TableCell>
                          {editingProduct !== index && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => startEditingProduct(index)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="mt-4">
          <div className="flex gap-4 mb-4">
            <Card className="flex-1">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{newItemsCount}</div>
                <div className="text-sm text-muted-foreground">Novos a criar</div>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{existingItemsCount}</div>
                <div className="text-sm text-muted-foreground">Já existentes</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">
                Item Templates Identificados
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[350px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uniqueItems.map((item, index) => {
                      const key = item.name.toLowerCase();
                      const exists = itemExistenceMap.has(key);
                      
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">
                            {item.code || '-'}
                          </TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>
                            <Badge variant={item.type === 'profile' ? 'default' : 'secondary'}>
                              {item.type === 'profile' ? 'Perfil' : 'Acessório'}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>
                            {exists ? (
                              <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                Existente
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                Novo
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Product Details Expandable */}
      {products.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">
              Detalhes do Primeiro Produto: {products[0].name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[250px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Largura</TableHead>
                    <TableHead>Altura</TableHead>
                    <TableHead>Ângulo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products[0].items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{item.code || '-'}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {item.quantityFormula}
                        </code>
                      </TableCell>
                      <TableCell>
                        {item.widthFormula && (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {item.widthFormula}
                          </code>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.heightFormula && (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {item.heightFormula}
                          </code>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.cutAngle && `${item.cutAngle}°`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
