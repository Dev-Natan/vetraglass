import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import RecuperarSenha from "./pages/RecuperarSenha";
import RedefinirSenha from "./pages/RedefinirSenha";
import CompanySetup from "./pages/CompanySetup";
import Clientes from "./pages/Clientes";
import Produtos from "./pages/Produtos";
import ProdutosLinha from "./pages/ProdutosLinha";
import EditarProduto from "./pages/EditarProduto";
import Estoque from "./pages/Estoque";
import PrecosEmpresa from "./pages/PrecosEmpresa";
import Orcamentos from "./pages/Orcamentos";
import OrdensServico from "./pages/OrdensServico";
import Financeiro from "./pages/Financeiro";
import Funcionarios from "./pages/Funcionarios";
import CaixaVendas from "./pages/CaixaVendas";
import PlanoCorte from "./pages/PlanoCorte";
import Configuracoes from "./pages/Configuracoes";
import NotasFiscais from "./pages/NotasFiscais";
import ItemTemplates from "./pages/admin/ItemTemplates";
import ProductTemplates from "./pages/admin/ProductTemplates";
import AdminLinhas from "./pages/admin/AdminLinhas";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCompanies from "./pages/admin/AdminCompanies";
import ImportProducts from "./pages/admin/ImportProducts";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

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
      <Route path="/plano-corte" element={
        <ProtectedRoute>
          <PlanoCorte />
        </ProtectedRoute>
      } />
      <Route path="/configuracoes" element={
        <ProtectedRoute>
          <Configuracoes />
        </ProtectedRoute>
      } />
      <Route path="/notas-fiscais" element={
        <ProtectedRoute>
          <NotasFiscais />
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
