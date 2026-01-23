import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { createQueryClient } from "@/lib/queryConfig";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import RecuperarSenha from "./pages/RecuperarSenha";
import RedefinirSenha from "./pages/RedefinirSenha";
import CompanySetup from "./pages/CompanySetup";
import Clientes from "./pages/Clientes";
import Produtos from "./pages/Produtos";
import ProdutosLinha from "./pages/ProdutosLinha";
import EditarProduto from "./pages/EditarProduto";
import EditarProdutoEmpresa from "./pages/EditarProdutoEmpresa";
import Estoque from "./pages/Estoque";
import PrecosEmpresa from "./pages/PrecosEmpresa";
import Orcamentos from "./pages/Orcamentos";
import OrdensServico from "./pages/OrdensServico";
import OrdemServicoDetalhes from "./pages/OrdemServicoDetalhes";
import Financeiro from "./pages/Financeiro";
import Funcionarios from "./pages/Funcionarios";
import CaixaVendas from "./pages/CaixaVendas";
import PlanoCorte from "./pages/PlanoCorte";
import ProjetoVidro from "./pages/ProjetoVidro";
import Configuracoes from "./pages/Configuracoes";
import ConfiguracoesFiscais from "./pages/ConfiguracoesFiscais";
import ConfiguracoesUsuarios from "./pages/ConfiguracoesUsuarios";
import ConfiguracoesPerfis from "./pages/ConfiguracoesPerfis";
import ConfiguracoesNotificacoes from "./pages/ConfiguracoesNotificacoes";
import ConfiguracoesSeguranca from "./pages/ConfiguracoesSeguranca";
import ConfiguracoesDados from "./pages/ConfiguracoesDados";
import NotasFiscais from "./pages/NotasFiscais";
import Agenda from "./pages/Agenda";
import Medicoes from "./pages/Medicoes";
import Relatorios from "./pages/Relatorios";
import ItemTemplates from "./pages/admin/ItemTemplates";
import ProductTemplates from "./pages/admin/ProductTemplates";
import AdminLinhas from "./pages/admin/AdminLinhas";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCompanies from "./pages/admin/AdminCompanies";
import ImportProducts from "./pages/admin/ImportProducts";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminGlassFormulas from "./pages/admin/AdminGlassFormulas";
import AdminCategories from "./pages/admin/AdminCategories";
import AceitarConvite from "./pages/AceitarConvite";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// Create optimized QueryClient with caching
const queryClient = createQueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, companies, isSaasAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // SaaS admins can access the system without a company
  if (!isSaasAdmin && companies.length === 0) {
    return <Navigate to="/empresa/nova" replace />;
  }

  return <>{children}</>;
}

function IndexRedirect() {
  const { isSaasAdmin } = useAuth();
  
  if (isSaasAdmin) {
    return <Navigate to="/admin" replace />;
  }
  
  return <Index />;
}

function CompanySetupRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/recuperar-senha" element={<RecuperarSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/aceitar-convite" element={<AceitarConvite />} />
      <Route path="/empresa/nova" element={
        <CompanySetupRoute>
          <CompanySetup />
        </CompanySetupRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute>
          <IndexRedirect />
        </ProtectedRoute>
      } />
      <Route path="/clientes" element={
        <ProtectedRoute>
          <Clientes />
        </ProtectedRoute>
      } />
      <Route path="/produtos" element={
        <ProtectedRoute>
          <Produtos />
        </ProtectedRoute>
      } />
      <Route path="/produtos/linha/:linha" element={
        <ProtectedRoute>
          <ProdutosLinha />
        </ProtectedRoute>
      } />
      <Route path="/produtos/editar/:id" element={
        <ProtectedRoute>
          <EditarProduto />
        </ProtectedRoute>
      } />
      <Route path="/produtos/empresa/editar/:id" element={
        <ProtectedRoute>
          <EditarProdutoEmpresa />
        </ProtectedRoute>
      } />
      <Route path="/estoque" element={
        <ProtectedRoute>
          <Estoque />
        </ProtectedRoute>
      } />
      <Route path="/precos" element={
        <ProtectedRoute>
          <PrecosEmpresa />
        </ProtectedRoute>
      } />
      <Route path="/orcamentos" element={
        <ProtectedRoute>
          <Orcamentos />
        </ProtectedRoute>
      } />
      <Route path="/ordens-servico" element={
        <ProtectedRoute>
          <OrdensServico />
        </ProtectedRoute>
      } />
      <Route path="/ordens-servico/:id" element={
        <ProtectedRoute>
          <OrdemServicoDetalhes />
        </ProtectedRoute>
      } />
      <Route path="/financeiro" element={
        <ProtectedRoute>
          <Financeiro />
        </ProtectedRoute>
      } />
      <Route path="/funcionarios" element={
        <ProtectedRoute>
          <Funcionarios />
        </ProtectedRoute>
      } />
      <Route path="/caixa-vendas" element={
        <ProtectedRoute>
          <CaixaVendas />
        </ProtectedRoute>
      } />
      {/* Redirect /vendas to /caixa-vendas for consistency */}
      <Route path="/vendas" element={<Navigate to="/caixa-vendas" replace />} />
      <Route path="/plano-corte" element={
        <ProtectedRoute>
          <PlanoCorte />
        </ProtectedRoute>
      } />
      <Route path="/projeto-vidro" element={
        <ProtectedRoute>
          <ProjetoVidro />
        </ProtectedRoute>
      } />
      <Route path="/configuracoes" element={
        <ProtectedRoute>
          <Configuracoes />
        </ProtectedRoute>
      } />
      <Route path="/configuracoes/fiscal" element={
        <ProtectedRoute>
          <ConfiguracoesFiscais />
        </ProtectedRoute>
      } />
      <Route path="/configuracoes/usuarios" element={
        <ProtectedRoute>
          <ConfiguracoesUsuarios />
        </ProtectedRoute>
      } />
      <Route path="/configuracoes/perfis" element={
        <ProtectedRoute>
          <ConfiguracoesPerfis />
        </ProtectedRoute>
      } />
      <Route path="/configuracoes/notificacoes" element={
        <ProtectedRoute>
          <ConfiguracoesNotificacoes />
        </ProtectedRoute>
      } />
      <Route path="/configuracoes/seguranca" element={
        <ProtectedRoute>
          <ConfiguracoesSeguranca />
        </ProtectedRoute>
      } />
      <Route path="/configuracoes/dados" element={
        <ProtectedRoute>
          <ConfiguracoesDados />
        </ProtectedRoute>
      } />
      <Route path="/notas-fiscais" element={
        <ProtectedRoute>
          <NotasFiscais />
        </ProtectedRoute>
      } />
      <Route path="/agenda" element={
        <ProtectedRoute>
          <Agenda />
        </ProtectedRoute>
      } />
      <Route path="/medicoes" element={
        <ProtectedRoute>
          <Medicoes />
        </ProtectedRoute>
      } />
      <Route path="/relatorios" element={
        <ProtectedRoute>
          <Relatorios />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/item-templates" element={
        <ProtectedRoute>
          <ItemTemplates />
        </ProtectedRoute>
      } />
      <Route path="/admin/product-templates" element={
        <ProtectedRoute>
          <ProductTemplates />
        </ProtectedRoute>
      } />
      <Route path="/admin/linhas" element={
        <ProtectedRoute>
          <AdminLinhas />
        </ProtectedRoute>
      } />
      <Route path="/admin/linhas/:linha" element={
        <ProtectedRoute>
          <ProductTemplates />
        </ProtectedRoute>
      } />
      <Route path="/admin/companies" element={
        <ProtectedRoute>
          <AdminCompanies />
        </ProtectedRoute>
      } />
      <Route path="/admin/import-products" element={
        <ProtectedRoute>
          <ImportProducts />
        </ProtectedRoute>
      } />
      <Route path="/admin/support" element={
        <ProtectedRoute>
          <AdminSupport />
        </ProtectedRoute>
      } />
      <Route path="/admin/announcements" element={
        <ProtectedRoute>
          <AdminAnnouncements />
        </ProtectedRoute>
      } />
      <Route path="/admin/glass-formulas" element={
        <ProtectedRoute>
          <AdminGlassFormulas />
        </ProtectedRoute>
      } />
      <Route path="/admin/categories" element={
        <ProtectedRoute>
          <AdminCategories />
        </ProtectedRoute>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
