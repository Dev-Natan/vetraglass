import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Clientes from "./pages/Clientes";
import Produtos from "./pages/Produtos";
import Estoque from "./pages/Estoque";
import Orcamentos from "./pages/Orcamentos";
import OrdensServico from "./pages/OrdensServico";
import Financeiro from "./pages/Financeiro";
import Funcionarios from "./pages/Funcionarios";
import CaixaVendas from "./pages/CaixaVendas";
import PlanoCorte from "./pages/PlanoCorte";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/orcamentos" element={<Orcamentos />} />
          <Route path="/ordens-servico" element={<OrdensServico />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/funcionarios" element={<Funcionarios />} />
          <Route path="/caixa-vendas" element={<CaixaVendas />} />
          <Route path="/plano-corte" element={<PlanoCorte />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
