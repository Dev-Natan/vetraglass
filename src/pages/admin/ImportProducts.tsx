import { useState, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Upload, FileJson, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";

interface ProductItem {
  item_nome: string;
  item_tipo: string;
  formula: string;
  quantidade_multiplicador: number;
  angulo_corte_1: number;
  angulo_corte_2: number;
  posicao: string;
  opcional: boolean;
  ordem: number;
}

interface ProductData {
  produto_nome: string;
  linha: string;
  categoria: string;
  tipo: string;
  parametros: string[];
  descricao: string;
  itens: ProductItem[];
  ativo: boolean;
}

interface ImportResult {
  success: boolean;
  productName: string;
  linha: string;
  message: string;
  missingItems?: string[];
}

// Category mapping
const categoryMap: Record<string, string> = {
  janela: "janelas",
  porta: "portas",
  divisoria: "other",
  tampo: "other",
  espelho: "espelhos",
  box: "box",
  fachada: "fachadas",
};

// Line mapping
const lineMap: Record<string, string> = {
  temperados: "Temperados",
  modulo_pratico: "Modulo Pratico",
  linha_25: "Linha 25",
  gold: "Gold",
  suprema: "Suprema",
  inova: "Inova",
};

export default function ImportProducts() {
  const { isSaasAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [missingItems, setMissingItems] = useState<Set<string>>(new Set());
  const [itemTemplatesMap, setItemTemplatesMap] = useState<Map<string, string>>(new Map());

  if (!isSaasAdmin) {
    return (
      <AdminLayout>
        <div className="p-8">
          <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </AdminLayout>
    );
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ProductData[];
      setProducts(data);
      setResults([]);
      setMissingItems(new Set());
      toast.success(`${data.length} produtos carregados do arquivo`);
    } catch (error) {
      console.error("Erro ao ler arquivo:", error);
      toast.error("Erro ao ler arquivo JSON");
    }
  };

  const loadItemTemplates = async () => {
    const { data, error } = await supabase
      .from("item_templates")
      .select("id, name")
      .eq("is_active", true);

    if (error) {
      console.error("Erro ao carregar item templates:", error);
      return new Map();
    }

    const map = new Map<string, string>();
    data?.forEach((item) => {
      // Store both exact name and normalized version
      map.set(item.name.toLowerCase().trim(), item.id);
      map.set(item.name, item.id);
    });
    return map;
  };

  const findItemTemplateId = (itemName: string, itemsMap: Map<string, string>): string | null => {
    // Try exact match first
    if (itemsMap.has(itemName)) return itemsMap.get(itemName)!;
    
    // Try lowercase
    const lowerName = itemName.toLowerCase().trim();
    if (itemsMap.has(lowerName)) return itemsMap.get(lowerName)!;
    
    // Try to find partial match
    for (const [key, id] of itemsMap.entries()) {
      if (key.toLowerCase().includes(lowerName) || lowerName.includes(key.toLowerCase())) {
        return id;
      }
    }
    
    return null;
  };

  const mapCategory = (cat: string): string => {
    const mapped = categoryMap[cat.toLowerCase()];
    return mapped || "other";
  };

  const mapLine = (line: string): string => {
    const mapped = lineMap[line.toLowerCase().replace(/ /g, "_")];
    return mapped || line;
  };

  const importProducts = async () => {
    if (products.length === 0) {
      toast.error("Nenhum produto para importar");
      return;
    }

    setImporting(true);
    setProgress(0);
    setResults([]);
    const newMissingItems = new Set<string>();
    const importResults: ImportResult[] = [];

    // Load all item templates
    const itemsMap = await loadItemTemplates();
    setItemTemplatesMap(itemsMap);

    // Check existing products to avoid duplicates
    const { data: existingProducts } = await supabase
      .from("product_templates")
      .select("name, linha");

    const existingSet = new Set(
      existingProducts?.map((p) => `${p.name.toLowerCase()}|${(p.linha || "").toLowerCase()}`) || []
    );

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const productKey = `${product.produto_nome.toLowerCase()}|${mapLine(product.linha).toLowerCase()}`;

      // Skip if already exists
      if (existingSet.has(productKey)) {
        importResults.push({
          success: false,
          productName: product.produto_nome,
          linha: mapLine(product.linha),
          message: "Produto já existe",
        });
        setProgress(((i + 1) / products.length) * 100);
        continue;
      }

      // Create product template
      const { data: newProduct, error: productError } = await supabase
        .from("product_templates")
        .insert({
          name: product.produto_nome,
          description: product.descricao || null,
          linha: mapLine(product.linha),
          category: mapCategory(product.categoria) as any,
          is_active: product.ativo,
        })
        .select()
        .single();

      if (productError) {
        importResults.push({
          success: false,
          productName: product.produto_nome,
          linha: mapLine(product.linha),
          message: `Erro: ${productError.message}`,
        });
        setProgress(((i + 1) / products.length) * 100);
        continue;
      }

      // Process items
      const productMissingItems: string[] = [];
      const itemsToInsert = [];

      for (const item of product.itens) {
        const itemTemplateId = findItemTemplateId(item.item_nome, itemsMap);

        if (!itemTemplateId) {
          newMissingItems.add(item.item_nome);
          productMissingItems.push(item.item_nome);
          continue;
        }

        itemsToInsert.push({
          product_template_id: newProduct.id,
          item_template_id: itemTemplateId,
          quantity_formula: item.formula || "1",
          pieces_quantity: item.quantidade_multiplicador || 1,
          cut_angle: item.angulo_corte_1 || 90,
          is_optional: item.opcional || false,
          notes: item.posicao || null,
        });
      }

      // Insert product items
      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from("product_template_items")
          .insert(itemsToInsert);

        if (itemsError) {
          console.error("Erro ao inserir itens:", itemsError);
        }
      }

      importResults.push({
        success: true,
        productName: product.produto_nome,
        linha: mapLine(product.linha),
        message: productMissingItems.length > 0 
          ? `Importado com ${productMissingItems.length} itens faltantes`
          : "Importado com sucesso",
        missingItems: productMissingItems.length > 0 ? productMissingItems : undefined,
      });

      setProgress(((i + 1) / products.length) * 100);
      setResults([...importResults]);
    }

    setMissingItems(newMissingItems);
    setImporting(false);

    const successCount = importResults.filter((r) => r.success).length;
    toast.success(`Importação concluída: ${successCount}/${products.length} produtos importados`);
  };

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  // Get unique lines from loaded products
  const uniqueLines = [...new Set(products.map((p) => mapLine(p.linha)))];
  const uniqueCategories = [...new Set(products.map((p) => p.categoria))];

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Importar Produtos</h1>
          <p className="text-muted-foreground">
            Importe produtos em massa a partir de um arquivo JSON
          </p>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5" />
              Arquivo JSON
            </CardTitle>
            <CardDescription>
              Selecione o arquivo JSON com os produtos para importar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex items-center gap-4">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={importing}
              >
                <Upload className="w-4 h-4 mr-2" />
                Selecionar Arquivo
              </Button>
              {products.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {products.length} produtos carregados
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        {products.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Preview dos Dados</CardTitle>
              <CardDescription>
                Resumo dos produtos que serão importados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{products.length}</p>
                  <p className="text-sm text-muted-foreground">Total de Produtos</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{uniqueLines.length}</p>
                  <p className="text-sm text-muted-foreground">Linhas</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{uniqueCategories.length}</p>
                  <p className="text-sm text-muted-foreground">Categorias</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">
                    {products.reduce((acc, p) => acc + p.itens.length, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total de Itens</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium">Linhas:</span>
                {uniqueLines.map((linha) => (
                  <Badge key={linha} variant="secondary">
                    {linha}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium">Categorias:</span>
                {uniqueCategories.map((cat) => (
                  <Badge key={cat} variant="outline">
                    {cat} → {mapCategory(cat)}
                  </Badge>
                ))}
              </div>

              <Button
                onClick={importProducts}
                disabled={importing}
                className="w-full"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Iniciar Importação
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Progress Section */}
        {importing && (
          <Card>
            <CardHeader>
              <CardTitle>Progresso da Importação</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">
                {Math.round(progress)}% concluído
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-4">
                Resultado da Importação
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {successCount} sucesso
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="w-3 h-3 mr-1" />
                    {errorCount} erros
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        result.success
                          ? "border-green-500/20 bg-green-500/5"
                          : "border-destructive/20 bg-destructive/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                        <span className="font-medium">{result.productName}</span>
                        <Badge variant="outline" className="text-xs">
                          {result.linha}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground ml-6">
                        {result.message}
                      </p>
                      {result.missingItems && result.missingItems.length > 0 && (
                        <div className="ml-6 mt-1 flex flex-wrap gap-1">
                          {result.missingItems.slice(0, 5).map((item) => (
                            <Badge key={item} variant="secondary" className="text-xs">
                              {item}
                            </Badge>
                          ))}
                          {result.missingItems.length > 5 && (
                            <Badge variant="secondary" className="text-xs">
                              +{result.missingItems.length - 5} mais
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Missing Items Section */}
        {missingItems.size > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Itens Não Encontrados ({missingItems.size})
              </CardTitle>
              <CardDescription>
                Estes itens não foram encontrados na tabela de item_templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="flex flex-wrap gap-2">
                  {[...missingItems].sort().map((item) => (
                    <Badge key={item} variant="outline">
                      {item}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
