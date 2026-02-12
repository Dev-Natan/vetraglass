import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, Plus, Layers } from 'lucide-react';
import { PrecificacaoCalculator } from '@/components/precificacao/PrecificacaoCalculator';
import { PrecificacaoCreateProduct } from '@/components/precificacao/PrecificacaoCreateProduct';
import { PrecificacaoLinhas } from '@/components/precificacao/PrecificacaoLinhas';

export default function Precificacao() {
  const [activeTab, setActiveTab] = useState('calcular');

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Precificação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie linhas, produtos e calcule preços detalhados
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="calcular" className="flex items-center gap-1.5">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Calcular Preço</span>
              <span className="sm:hidden">Calcular</span>
            </TabsTrigger>
            <TabsTrigger value="linhas" className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Linhas de Produtos</span>
              <span className="sm:hidden">Linhas</span>
            </TabsTrigger>
            <TabsTrigger value="criar" className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Criar Produto</span>
              <span className="sm:hidden">Criar</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calcular">
            <PrecificacaoCalculator />
          </TabsContent>

          <TabsContent value="linhas">
            <PrecificacaoLinhas />
          </TabsContent>

          <TabsContent value="criar">
            <PrecificacaoCreateProduct />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
