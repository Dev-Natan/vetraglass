import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { createQueryClient } from "@/lib/queryConfig";
import { lazy, Suspense } from "react";
import { LazyPageLoader } from "@/components/common/LazyPageLoader";
import { Loader2 } from "lucide-react";

// Core pages - loaded immediately (most used)
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Produtos from "./pages/Produtos";
import ProdutosLinha from "./pages/ProdutosLinha";
import Orcamentos from "./pages/Orcamentos";
import OrdensServico from "./pages/OrdensServico";
import Clientes from "./pages/Clientes";
import CaixaVendas from "./pages/CaixaVendas";
import Estoque from "./pages/Estoque";
import PlanoCorte from "./pages/PlanoCorte";

// Lazy loaded pages - less frequently used
const RecuperarSenha = lazy(() => import("./pages/RecuperarSenha"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));
const CompanySetup = lazy(() => import("./pages/CompanySetup"));
const EditarProduto = lazy(() => import("./pages/EditarProduto"));
const EditarProdutoEmpresa = lazy(() => import("./pages/EditarProdutoEmpresa"));

const OrdemServicoDetalhes = lazy(() => import("./pages/OrdemServicoDetalhes"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Funcionarios = lazy(() => import("./pages/Funcionarios"));
const ProjetoVidro = lazy(() => import("./pages/ProjetoVidro"));
const NotasFiscais = lazy(() => import("./pages/NotasFiscais"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Medicoes = lazy(() => import("./pages/Medicoes"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const PedidosCompra = lazy(() => import("./pages/PedidosCompra"));
const AceitarConvite = lazy(() => import("./pages/AceitarConvite"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Settings pages - lazy loaded
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const ConfiguracoesFiscais = lazy(() => import("./pages/ConfiguracoesFiscais"));
const ConfiguracoesUsuarios = lazy(() => import("./pages/ConfiguracoesUsuarios"));
const ConfiguracoesPerfis = lazy(() => import("./pages/ConfiguracoesPerfis"));
const ConfiguracoesNotificacoes = lazy(() => import("./pages/ConfiguracoesNotificacoes"));
const ConfiguracoesSeguranca = lazy(() => import("./pages/ConfiguracoesSeguranca"));
const ConfiguracoesPagamento = lazy(() => import("./pages/ConfiguracoesPagamento"));
const ConfiguracoesDados = lazy(() => import("./pages/ConfiguracoesDados"));

// Admin pages - lazy loaded (only for SaaS admins)
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const ItemTemplates = lazy(() => import("./pages/admin/ItemTemplates"));
const ProductTemplates = lazy(() => import("./pages/admin/ProductTemplates"));
const AdminLinhas = lazy(() => import("./pages/admin/AdminLinhas"));
const AdminCompanies = lazy(() => import("./pages/admin/AdminCompanies"));
const ImportProducts = lazy(() => import("./pages/admin/ImportProducts"));
const ImportExcelProducts = lazy(() => import("./pages/admin/ImportExcelProducts"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminGlassFormulas = lazy(() => import("./pages/admin/AdminGlassFormulas"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

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

function LandingRedirect() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // If user is logged in, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Show landing page for non-authenticated users
  return <Landing />;
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

// Wrapper for lazy routes with Suspense
function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LazyPageLoader />}>{children}</Suspense>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<LandingRedirect />} />
      
      {/* Auth routes */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/recuperar-senha" element={<LazyRoute><RecuperarSenha /></LazyRoute>} />
      <Route path="/redefinir-senha" element={<LazyRoute><RedefinirSenha /></LazyRoute>} />
      <Route path="/aceitar-convite" element={<LazyRoute><AceitarConvite /></LazyRoute>} />
      <Route path="/empresa/nova" element={
        <CompanySetupRoute>
          <LazyRoute><CompanySetup /></LazyRoute>
        </CompanySetupRoute>
      } />
      
      {/* Dashboard - protected */}
      <Route path="/dashboard" element={<ProtectedRoute><IndexRedirect /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
      <Route path="/produtos" element={<ProtectedRoute><Produtos /></ProtectedRoute>} />
      <Route path="/produtos/linha/:linha" element={<ProtectedRoute><ProdutosLinha /></ProtectedRoute>} />
      <Route path="/orcamentos" element={<ProtectedRoute><Orcamentos /></ProtectedRoute>} />
      <Route path="/ordens-servico" element={<ProtectedRoute><OrdensServico /></ProtectedRoute>} />
      <Route path="/estoque" element={<ProtectedRoute><Estoque /></ProtectedRoute>} />
      <Route path="/caixa-vendas" element={<ProtectedRoute><CaixaVendas /></ProtectedRoute>} />
      <Route path="/vendas" element={<Navigate to="/caixa-vendas" replace />} />
      <Route path="/plano-corte" element={<ProtectedRoute><PlanoCorte /></ProtectedRoute>} />
      
      {/* Lazy loaded routes */}
      <Route path="/produtos/editar/:id" element={
        <ProtectedRoute><LazyRoute><EditarProduto /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/produtos/empresa/editar/:id" element={
        <ProtectedRoute><LazyRoute><EditarProdutoEmpresa /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/ordens-servico/:id" element={
        <ProtectedRoute><LazyRoute><OrdemServicoDetalhes /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/financeiro" element={
        <ProtectedRoute><LazyRoute><Financeiro /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/funcionarios" element={
        <ProtectedRoute><LazyRoute><Funcionarios /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/projeto-vidro" element={
        <ProtectedRoute><LazyRoute><ProjetoVidro /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/notas-fiscais" element={
        <ProtectedRoute><LazyRoute><NotasFiscais /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/pedidos-compra" element={
        <ProtectedRoute><LazyRoute><PedidosCompra /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/agenda" element={
        <ProtectedRoute><LazyRoute><Agenda /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/medicoes" element={
        <ProtectedRoute><LazyRoute><Medicoes /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/relatorios" element={
        <ProtectedRoute><LazyRoute><Relatorios /></LazyRoute></ProtectedRoute>
      } />
      
      {/* Settings routes - all lazy */}
      <Route path="/configuracoes" element={
        <ProtectedRoute><LazyRoute><Configuracoes /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/configuracoes/fiscal" element={
        <ProtectedRoute><LazyRoute><ConfiguracoesFiscais /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/configuracoes/usuarios" element={
        <ProtectedRoute><LazyRoute><ConfiguracoesUsuarios /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/configuracoes/perfis" element={
        <ProtectedRoute><LazyRoute><ConfiguracoesPerfis /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/configuracoes/notificacoes" element={
        <ProtectedRoute><LazyRoute><ConfiguracoesNotificacoes /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/configuracoes/seguranca" element={
        <ProtectedRoute><LazyRoute><ConfiguracoesSeguranca /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/configuracoes/dados" element={
        <ProtectedRoute><LazyRoute><ConfiguracoesDados /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/configuracoes/pagamento" element={
        <ProtectedRoute><LazyRoute><ConfiguracoesPagamento /></LazyRoute></ProtectedRoute>
      } />
      
      {/* Admin routes - all lazy */}
      <Route path="/admin" element={
        <ProtectedRoute><LazyRoute><AdminDashboard /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/item-templates" element={
        <ProtectedRoute><LazyRoute><ItemTemplates /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/product-templates" element={
        <ProtectedRoute><LazyRoute><ProductTemplates /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/linhas" element={
        <ProtectedRoute><LazyRoute><AdminLinhas /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/linhas/:linha" element={
        <ProtectedRoute><LazyRoute><ProductTemplates /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/companies" element={
        <ProtectedRoute><LazyRoute><AdminCompanies /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/import-products" element={
        <ProtectedRoute><LazyRoute><ImportProducts /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/import-excel" element={
        <ProtectedRoute><LazyRoute><ImportExcelProducts /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/support" element={
        <ProtectedRoute><LazyRoute><AdminSupport /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/announcements" element={
        <ProtectedRoute><LazyRoute><AdminAnnouncements /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/glass-formulas" element={
        <ProtectedRoute><LazyRoute><AdminGlassFormulas /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/categories" element={
        <ProtectedRoute><LazyRoute><AdminCategories /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/audit-logs" element={
        <ProtectedRoute><LazyRoute><AdminAuditLogs /></LazyRoute></ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute><LazyRoute><AdminSettings /></LazyRoute></ProtectedRoute>
      } />
      
      <Route path="*" element={<LazyRoute><NotFound /></LazyRoute>} />
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
