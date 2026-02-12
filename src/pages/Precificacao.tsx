import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, Plus } from 'lucide-react';
import { PrecificacaoCalculator } from '@/components/precificacao/PrecificacaoCalculator';
import { PrecificacaoCreateProduct } from '@/components/precificacao/PrecificacaoCreateProduct';

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
            Calcule preços detalhados e crie novos produtos
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="calcular" className="flex items-center gap-1.5">
              <Calculator className="h-4 w-4" />
              Calcular Preço
            </TabsTrigger>
            <TabsTrigger value="criar" className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              Criar Produto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calcular">
            <PrecificacaoCalculator />
          </TabsContent>

          <TabsContent value="criar">
            <PrecificacaoCreateProduct />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
