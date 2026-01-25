import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExcelDropzone } from "@/components/admin/excel-import/ExcelDropzone";
import { ExcelImportPreview } from "@/components/admin/excel-import/ExcelImportPreview";
import { parseMultipleExcelFiles, ParsedProduct, extractUniqueItemTemplates } from "@/utils/parseExcelCuttingSheet";
import { bufferToBlob } from "@/utils/excelImageExtractor";
import { useProductCategories, useProductCategoryMutations } from "@/hooks/useProductCategories";
import { AlertCircle, CheckCircle, FileSpreadsheet, Loader2, Upload, Image } from "lucide-react";

export default function ImportExcelProducts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [pendingNewCategories, setPendingNewCategories] = useState<Set<string>>(new Set());

  // Fetch existing categories
  const { data: existingCategories = [] } = useProductCategories(true);
  const { createMutation: createCategoryMutation } = useProductCategoryMutations();

  // Fetch existing item templates
  const { data: existingTemplates = [] } = useQuery({
    queryKey: ['item-templates-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return (data || []).map(t => ({ id: t.id, name: t.name }));
    }
  });

  const handleFilesSelected = async (newFiles: File[]) => {
    const allFiles = [...files, ...newFiles];
    setFiles(allFiles);
    
    setIsProcessing(true);
    try {
      const result = await parseMultipleExcelFiles(allFiles);
      setParsedProducts(result.products);
      setParseErrors(result.errors);
      setParseWarnings(result.warnings);
      
      if (result.products.length > 0) {
        setImportStep('preview');
      }
    } catch (error) {
      toast({
        title: "Erro ao processar arquivos",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    
    if (newFiles.length === 0) {
      setParsedProducts([]);
      setParseErrors([]);
      setParseWarnings([]);
      setImportStep('upload');
    } else {
      // Re-parse remaining files
      handleFilesSelected([]);
    }
  };

  // Helper to normalize text for comparison (remove accents, lowercase, trim)
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Check if item name matches existing template (partial match)
  const findMatchingTemplate = (itemName: string, itemCode: string | null | undefined) => {
    const normalizedItemName = normalizeText(itemName);
    const normalizedCode = itemCode ? normalizeText(itemCode) : '';
    const fullName = itemCode ? `${itemCode} - ${itemName}` : itemName;
    const normalizedFullName = normalizeText(fullName);
    
    for (const template of existingTemplates) {
      const normalizedTemplateName = normalizeText(template.name);
      
      // Exact match on full name
      if (normalizedTemplateName === normalizedFullName) {
        return template.id;
      }
      
      // Match on item name alone
      if (normalizedTemplateName === normalizedItemName) {
        return template.id;
      }
      
      // Template contains the code and name parts
      if (normalizedCode && 
          normalizedTemplateName.includes(normalizedCode) && 
          normalizedTemplateName.includes(normalizedItemName)) {
        return template.id;
      }
      
      // Partial match - template name contains item name or vice versa
      if (normalizedTemplateName.includes(normalizedItemName) && normalizedItemName.length > 5) {
        return template.id;
      }
      if (normalizedItemName.includes(normalizedTemplateName) && normalizedTemplateName.length > 5) {
        return template.id;
      }
    }
    
    return null;
  };

  // Helper to upload image buffer to storage
  const uploadImageBuffer = async (buffer: ArrayBuffer, extension: string, folder: string, name: string): Promise<string | null> => {
    try {
      const mimeTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif' };
      const mimeType = mimeTypes[extension] || 'image/png';
      const blob = bufferToBlob(buffer, mimeType);
      const fileName = `${name}_${Date.now()}.${extension}`;
      const filePath = `${folder}/${fileName}`;
      
      const { error } = await supabase.storage.from('product-images').upload(filePath, blob, { contentType: mimeType, upsert: true });
      if (error) { console.error('Upload error:', error); return null; }
      
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (e) { console.error('Upload failed:', e); return null; }
  };

  const importMutation = useMutation({
    mutationFn: async (products: ParsedProduct[]) => {
      setImportStep('importing');
      
      // 0. Create any new categories that were requested
      const categorySlugMap = new Map<string, string>();
      const categoriesCreated: string[] = [];
      
      for (const product of products) {
        if (product.category.startsWith('new:')) {
          const newCategoryName = product.category.replace('new:', '');
          
          // Check if we already created this category
          if (categorySlugMap.has(newCategoryName.toLowerCase())) continue;
          
          // Create a slug from the name
          const slug = newCategoryName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
          
          // Check if category with this slug already exists
          const existingCat = existingCategories.find(c => c.slug === slug);
          if (existingCat) {
            categorySlugMap.set(newCategoryName.toLowerCase(), existingCat.slug);
            continue;
          }
          
          // Create the new category
          const { data: newCat, error: catError } = await supabase
            .from('product_categories')
            .insert({
              slug,
              name: newCategoryName,
              color: '#6366f1', // Default indigo color
              is_active: true,
              sort_order: existingCategories.length + 1,
            })
            .select('id, slug')
            .single();
          
          if (catError) throw new Error(`Erro ao criar categoria ${newCategoryName}: ${catError.message}`);
          
          categorySlugMap.set(newCategoryName.toLowerCase(), newCat.slug);
          categoriesCreated.push(newCategoryName);
          console.log(`Categoria criada: ${newCategoryName} (${newCat.slug})`);
        }
      }
      
      // 1. Extract unique items that need to be created
      const uniqueItems = extractUniqueItemTemplates(products);
      const itemTemplateMap = new Map<string, string>();
      
      // Map existing templates by normalized name
      for (const template of existingTemplates) {
        const normalizedName = normalizeText(template.name);
        itemTemplateMap.set(normalizedName, template.id);
      }
      
      // 2. Also pre-map all items from products for lookup later
      // This ensures we can find items by their exact parsed name/code combination
      const allProductItems = products.flatMap(p => p.items);
      
      // 3. Find or create item templates
      const newItems: typeof uniqueItems = [];
      const reuseCount = { count: 0 };
      
      for (const item of uniqueItems) {
        const existingId = findMatchingTemplate(item.name, item.code);
        const fullName = item.code ? `${item.code} - ${item.name}` : item.name;
        const normalizedKey = normalizeText(fullName);
        
        if (existingId) {
          // Reuse existing template - map ALL variations of this item
          itemTemplateMap.set(normalizedKey, existingId);
          itemTemplateMap.set(normalizeText(item.name), existingId);
          if (item.code) {
            itemTemplateMap.set(normalizeText(item.code), existingId);
          }
          reuseCount.count++;
        } else {
          // Mark for creation
          newItems.push(item);
        }
      }
      
      console.log(`Reutilizando ${reuseCount.count} itens existentes, criando ${newItems.length} novos`);
      
      for (const item of newItems) {
        const fullName = item.code ? `${item.code} - ${item.name}` : item.name;
        
        const { data, error } = await supabase
          .from('item_templates')
          .insert({
            name: fullName,
            type: item.type,
            unit: item.unit,
            linha: 'Portões',
            bar_length_mm: item.type === 'profile' ? 6000 : null,
          })
          .select('id')
          .single();
        
        if (error) throw new Error(`Erro ao criar item ${fullName}: ${error.message}`);
        
        // Map ALL variations for this new item
        const normalizedKey = normalizeText(fullName);
        itemTemplateMap.set(normalizedKey, data.id);
        itemTemplateMap.set(normalizeText(item.name), data.id);
        if (item.code) {
          itemTemplateMap.set(normalizeText(item.code), data.id);
        }
      }
      
      // 4. Create product templates
      const createdProducts: string[] = [];
      let imagesUploaded = 0;
      
      for (const product of products) {
        // Upload product image if available
        let productImageUrl: string | null = null;
        if (product.productImageBuffer) {
          productImageUrl = await uploadImageBuffer(
            product.productImageBuffer,
            product.productImageExtension || 'png',
            'products',
            product.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
          );
          if (productImageUrl) imagesUploaded++;
        }
        
        // Resolve category - handle new categories
        let finalCategory: string;
        if (product.category.startsWith('new:')) {
          const newCategoryName = product.category.replace('new:', '');
          finalCategory = categorySlugMap.get(newCategoryName.toLowerCase()) || 'other';
        } else {
          finalCategory = product.category;
        }
        
        // Validate category is a valid slug
        const validCategory = ['window', 'door', 'partition', 'mirror', 'shower', 'facade', 'other', 'guarda_corpo'].includes(finalCategory) 
          ? finalCategory as 'window' | 'door' | 'partition' | 'mirror' | 'shower' | 'facade' | 'other' | 'guarda_corpo'
          : existingCategories.some(c => c.slug === finalCategory)
            ? finalCategory as any
            : 'other' as const;
          
        const { data: productData, error: productError } = await supabase
          .from('product_templates')
          .insert({
            name: product.name,
            category: validCategory,
            linha: product.linha,
            description: product.description,
            image_url: productImageUrl,
          })
          .select('id')
          .single();
        
        if (productError) throw new Error(`Erro ao criar produto ${product.name}: ${productError.message}`);
        
        // 4. Create product template items
        const itemsToCreate = product.items.map((item, index) => {
          const fullName = item.code ? `${item.code} - ${item.name}` : item.name;
          
          // Try multiple variations to find the item
          let itemTemplateId = itemTemplateMap.get(normalizeText(fullName));
          if (!itemTemplateId) {
            itemTemplateId = itemTemplateMap.get(normalizeText(item.name));
          }
          if (!itemTemplateId && item.code) {
            itemTemplateId = itemTemplateMap.get(normalizeText(item.code));
          }
          
          // Try finding by partial match in the map
          if (!itemTemplateId) {
            const normalizedFullName = normalizeText(fullName);
            for (const [key, id] of itemTemplateMap.entries()) {
              if (key.includes(normalizedFullName) || normalizedFullName.includes(key)) {
                if (key.length > 5 || normalizedFullName.length > 5) {
                  itemTemplateId = id;
                  break;
                }
              }
            }
          }
          
          if (!itemTemplateId) {
            console.error(`Item não encontrado: ${fullName}`, { 
              mapKeys: Array.from(itemTemplateMap.keys()).slice(0, 20) 
            });
            throw new Error(`Item template não encontrado para: ${fullName}`);
          }

          const safePiecesQuantity = (() => {
            const n = Number(item.piecesQuantity);
            if (!Number.isFinite(n) || n <= 0) return 1;
            // DB expects integer
            return Math.max(1, Math.round(n));
          })();

          const safeCutAngle = (() => {
            const n = Number(item.cutAngle);
            return Number.isFinite(n) ? n : null;
          })();
          
          return {
            product_template_id: productData.id,
            item_template_id: itemTemplateId,
            quantity_formula: item.quantityFormula || '1',
            width_formula: item.widthFormula,
            height_formula: item.heightFormula,
            cut_angle: safeCutAngle,
            pieces_quantity: safePiecesQuantity,
          };
        });
        
        if (itemsToCreate.length > 0) {
          const { error: itemsError } = await supabase
            .from('product_template_items')
            .insert(itemsToCreate);
          
          if (itemsError) throw new Error(`Erro ao criar itens do produto ${product.name}: ${itemsError.message}`);
        }
        
        createdProducts.push(product.name);
      }
      
      return {
        itemsCreated: newItems.length,
        productsCreated: createdProducts.length,
        productNames: createdProducts,
        imagesUploaded,
        categoriesCreated: categoriesCreated.length,
      };
    },
    onSuccess: (result) => {
      setImportStep('complete');
      queryClient.invalidateQueries({ queryKey: ['item-templates'] });
      queryClient.invalidateQueries({ queryKey: ['product-templates'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      
      let description = `${result.itemsCreated} itens, ${result.productsCreated} produtos e ${result.imagesUploaded} imagens importados.`;
      if (result.categoriesCreated > 0) {
        description += ` ${result.categoriesCreated} categoria(s) criada(s).`;
      }
      
      toast({
        title: "Importação concluída!",
        description,
      });
    },
    onError: (error: Error) => {
      setImportStep('preview');
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleImport = () => {
    if (parsedProducts.length === 0) return;
    importMutation.mutate(parsedProducts);
  };

  const handleReset = () => {
    setFiles([]);
    setParsedProducts([]);
    setParseErrors([]);
    setParseWarnings([]);
    setImportStep('upload');
    setPendingNewCategories(new Set());
  };

  const handleNewCategoryRequest = (categoryName: string) => {
    setPendingNewCategories(prev => new Set(prev).add(categoryName));
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Importar Produtos via Excel</h1>
            <p className="text-muted-foreground">
              Importe planilhas de corte de material para criar produtos e componentes automaticamente
            </p>
          </div>
        </div>

        {parseErrors.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erros encontrados</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4 mt-2">
                {parseErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {parseWarnings.length > 0 && (
          <Alert className="mb-4 border-yellow-500 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Avisos</AlertTitle>
            <AlertDescription className="text-yellow-700">
              <ul className="list-disc pl-4 mt-2">
                {parseWarnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {importStep === 'complete' && (
          <Alert className="mb-4 border-green-500 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Importação concluída!</AlertTitle>
            <AlertDescription className="text-green-700">
              Todos os produtos e itens foram importados com sucesso.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              {importStep === 'upload' && 'Selecione os arquivos Excel'}
              {importStep === 'preview' && 'Revise os dados a importar'}
              {importStep === 'importing' && 'Importando...'}
              {importStep === 'complete' && 'Importação finalizada'}
            </CardTitle>
            <CardDescription>
              {importStep === 'upload' && 'Faça upload das planilhas de corte de material no formato Excel'}
              {importStep === 'preview' && 'Verifique os produtos e itens que serão criados'}
              {importStep === 'importing' && 'Aguarde enquanto os dados são salvos no banco de dados'}
              {importStep === 'complete' && 'Os produtos estão prontos para uso'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(importStep === 'upload' || importStep === 'preview') && (
              <ExcelDropzone
                onFilesSelected={handleFilesSelected}
                isLoading={isProcessing}
                selectedFiles={files}
                onRemoveFile={handleRemoveFile}
              />
            )}

            {importStep === 'preview' && parsedProducts.length > 0 && (
              <div className="mt-6">
                <ExcelImportPreview
                  products={parsedProducts}
                  onProductsChange={setParsedProducts}
                  existingItemTemplates={existingTemplates}
                  onNewCategoryRequest={handleNewCategoryRequest}
                />
                
                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="outline" onClick={handleReset}>
                    Cancelar
                  </Button>
                  <Button onClick={handleImport} disabled={importMutation.isPending}>
                    {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Upload className="mr-2 h-4 w-4" />
                    Importar {parsedProducts.length} Produto(s)
                  </Button>
                </div>
              </div>
            )}

            {importStep === 'importing' && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">Importando dados...</p>
                <p className="text-muted-foreground">Isso pode levar alguns segundos</p>
              </div>
            )}

            {importStep === 'complete' && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-lg font-medium mb-4">Importação concluída com sucesso!</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleReset}>
                    Importar mais arquivos
                  </Button>
                  <Button onClick={() => window.location.href = '/admin/product-templates'}>
                    Ver Produtos
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
