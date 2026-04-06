import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Calculator, Info, RefreshCw, Copy, Check, ChevronRight, Settings2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { evaluateFormula, validateFormula, calculateFormulaQuantity } from '@/utils/safeFormulaEvaluator';
import { toast } from 'sonner';

export default function FormulaTester() {
  const [formula, setFormula] = useState('(Largura - 40) / 2');
  const [qtyFormula, setQtyFormula] = useState('L * A');
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(2100);
  const [fl, setFl] = useState(40);
  const [fa, setFa] = useState(10);
  const [piecesQty, setPiecesQty] = useState(1);
  
  const [result, setResult] = useState<number | null>(null);
  const [qtyResult, setQtyResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  // Evaluate normal formula
  useEffect(() => {
    const validation = validateFormula(formula, width, height, fl, fa);
    setIsValid(validation.isValid);
    setError(validation.error);
    setResult(validation.result);
  }, [formula, width, height, fl, fa]);

  // Evaluate quantity formula
  useEffect(() => {
    try {
      const res = calculateFormulaQuantity(qtyFormula, width, height, piecesQty);
      setQtyResult(res);
    } catch (e) {
      setQtyResult(null);
    }
  }, [qtyFormula, width, height, piecesQty]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  const sampleFormulas = [
    { label: 'Meia Largura com Folga', value: '(Largura - 40) / 2' },
    { label: 'Altura com Folga Superior', value: 'Altura - 10' },
    { label: 'Trespasso Simples', value: '(L - FL) / 2 + 30' },
    { label: 'Cálculo de Área (m²)', value: '(L * A) / 1000000' },
    { label: 'Três Painéis', value: '(Largura - 60) / 3' },
  ];

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calculator className="w-8 h-8 text-primary" />
              Testador de Fórmulas
            </h1>
            <p className="text-muted-foreground mt-1">
              Ferramenta para validar cálculos geométricos e de insumos
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Inputs Section */}
          <Card className="md:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Variáveis de Teste
              </CardTitle>
              <CardDescription>Valores base para os cálculos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="width">Largura (L) em mm</Label>
                <Input 
                  id="width" 
                  type="number" 
                  value={width} 
                  onChange={(e) => setWidth(Number(e.target.value))} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Altura (A) em mm</Label>
                <Input 
                  id="height" 
                  type="number" 
                  value={height} 
                  onChange={(e) => setHeight(Number(e.target.value))} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fl">Folga L (FL)</Label>
                  <Input 
                    id="fl" 
                    type="number" 
                    value={fl} 
                    onChange={(e) => setFl(Number(e.target.value))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fa">Folga A (FA)</Label>
                  <Input 
                    id="fa" 
                    type="number" 
                    value={fa} 
                    onChange={(e) => setFa(Number(e.target.value))} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pieces">Qtd. Peças</Label>
                <Input 
                  id="pieces" 
                  type="number" 
                  value={piecesQty} 
                  onChange={(e) => setPiecesQty(Number(e.target.value))} 
                />
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Variáveis Disponíveis</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-mono">Largura / L / W</Badge>
                  <Badge variant="outline" className="font-mono">Altura / A / H</Badge>
                  <Badge variant="outline" className="font-mono">FL</Badge>
                  <Badge variant="outline" className="font-mono">FA</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tester Section */}
          <div className="md:col-span-2 space-y-6">
            <Tabs defaultValue="geometric" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="geometric">Fórmulas Geométricas (mm)</TabsTrigger>
                <TabsTrigger value="quantity">Fórmulas de Quantidade (m²/un)</TabsTrigger>
              </TabsList>
              
              <TabsContent value="geometric" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Cálculo de Medida</CardTitle>
                    <CardDescription>
                      Usado em perfis e vidros para determinar as dimensões de corte.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="formula">Sua Fórmula</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="formula" 
                          value={formula} 
                          onChange={(e) => setFormula(e.target.value)}
                          className={`font-mono text-lg ${!isValid ? 'border-destructive' : 'border-primary'}`}
                          placeholder="Ex: (Largura - FL) / 2"
                        />
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(formula)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      {error && <p className="text-sm text-destructive font-medium">{error}</p>}
                    </div>

                    <div className="p-6 bg-muted/30 rounded-xl border flex flex-col items-center justify-center text-center space-y-2">
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Resultado Final (mm)</span>
                      <div className="text-5xl font-bold text-primary font-mono tabular-nums">
                        {result !== null ? result : '---'}
                      </div>
                      <span className="text-xs text-muted-foreground">Arredondado para o inteiro mais próximo</span>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Exemplos Comuns</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {sampleFormulas.map((f, i) => (
                          <Button 
                            key={i} 
                            variant="outline" 
                            className="justify-start text-xs h-auto py-2"
                            onClick={() => setFormula(f.value)}
                          >
                            <ChevronRight className="w-3 h-3 mr-2 text-primary" />
                            <div className="text-left">
                              <div className="font-semibold">{f.label}</div>
                              <code className="text-[10px] opacity-70">{f.value}</code>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="quantity" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Cálculo de Quantidade</CardTitle>
                    <CardDescription>
                      Usado para calcular área de vidro ou consumo de materiais em metros.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="qtyFormula">Fórmula de Quantidade</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="qtyFormula" 
                          value={qtyFormula} 
                          onChange={(e) => setQtyFormula(e.target.value)}
                          className="font-mono text-lg border-primary"
                          placeholder="Ex: L * A"
                        />
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(qtyFormula)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Nesta fórmula, L e A são tratados como <strong>metros</strong>.
                      </p>
                    </div>

                    <div className="p-6 bg-muted/30 rounded-xl border flex flex-col items-center justify-center text-center space-y-2">
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Resultado do Consumo</span>
                      <div className="text-5xl font-bold text-primary font-mono tabular-nums">
                        {qtyResult !== null ? qtyResult.toFixed(4) : '---'}
                      </div>
                      <span className="text-xs text-muted-foreground">Calculado: (FormulaResult / 1000) * QtdPeças</span>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3">
                      <Info className="w-5 h-5 text-amber-500 shrink-0" />
                      <div className="text-xs text-amber-800 space-y-1">
                        <p className="font-bold">Como funciona:</p>
                        <p>1. L e A são convertidos de mm para metros (ex: 1200mm → 1.2m).</p>
                        <p>2. A fórmula é avaliada com esses valores.</p>
                        <p>3. O resultado é dividido por 1000 e multiplicado pela Qtd de Peças.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex gap-4 items-start">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Info className="w-5 h-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm">Dica de Arredondamento</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      O sistema utiliza a biblioteca <code className="bg-primary/10 px-1 rounded text-primary">mathjs</code> para garantir segurança. 
                      Fórmulas geométricas são arredondadas para o inteiro mais próximo para facilitar o corte. 
                      Se precisar de precisão decimal em medidas, certifique-se de testar aqui primeiro.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
