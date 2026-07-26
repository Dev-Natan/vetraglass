import { MainLayout } from '@/components/layout/MainLayout';
import { CaixaOperacionalTab } from '@/components/financeiro/CaixaOperacionalTab';
import { ShoppingCart } from 'lucide-react';

export default function CaixaVendas() {
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <header>
          <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-primary" />
            Caixa &amp; Vendas
          </h1>
          <p className="text-muted-foreground text-sm">
            Abertura e fechamento de caixa, registro de vendas e movimentações diárias.
          </p>
        </header>
        <CaixaOperacionalTab />
      </div>
    </MainLayout>
  );
}
