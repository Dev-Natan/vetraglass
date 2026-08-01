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
import { ModuleGuard } from "@/components/ModuleGuard";
import { useSubscriptionAccess, isSubscriptionAllowed } from "@/hooks/useSubscriptionAccess";


// Core pages - loaded immediately (minimal bundle)
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";

// Lazy loaded pages - all core pages loaded on demand
const Index = lazy(() => import("./pages/Index"));
const Produtos = lazy(() => import("./pages/Produtos"));
const ProdutosLinha = lazy(() => import("./pages/ProdutosLinha"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const OrdensServico = lazy(() => import("./pages/OrdensServico"));
const Clientes = lazy(() => import("./pages/Clientes"));


const Estoque = lazy(() => import("./pages/Estoque"));
const EstoqueLinha = lazy(() => import("./pages/EstoqueLinha"));
const EstoqueHistorico = lazy(() => import("./pages/EstoqueHistorico"));
const BancoRetalhos = lazy(() => import("./pages/BancoRetalhos"));


const RecuperarSenha = lazy(() => import("./pages/RecuperarSenha"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));
const CompanySetup = lazy(() => import("./pages/CompanySetup"));
const EditarProduto = lazy(() => import("./pages/EditarProduto"));
const EditarProdutoEmpresa = lazy(() => import("./pages/EditarProdutoEmpresa"));

const OrdemServicoDetalhes = lazy(() => import("./pages/OrdemServicoDetalhes"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const CaixaVendas = lazy(() => import("./pages/CaixaVendas"));
const Funcionarios = lazy(() => import("./pages/Funcionarios"));


const Agenda = lazy(() => import("./pages/Agenda"));
const Medicoes = lazy(() => import("./pages/Medicoes"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const PedidosCompra = lazy(() => import("./pages/PedidosCompra"));
const Feedbacks = lazy(() => import("./pages/Feedbacks"));

const AceitarConvite = lazy(() => import("./pages/AceitarConvite"));
const MeusPrecos = lazy(() => import("./pages/MeusPrecos"));
const PlanoDeCorte = lazy(() => import("./pages/PlanoDeCorte"));

const Planos = lazy(() => import("./pages/Planos"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

// Settings pages - lazy loaded
const Configuracoes = lazy(() => import("./pages/Configuracoes"));

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

const AdminCompanies = lazy(() => import("./pages/admin/AdminCompanies"));
const ImportProducts = lazy(() => import("./pages/admin/ImportProducts"));
const ImportExcelProducts = lazy(() => import("./pages/admin/ImportExcelProducts"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements"));

const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminCategoryDetail = lazy(() => import("./pages/admin/AdminCategoryDetail"));
const AdminCompanyDetail = lazy(() => import("./pages/admin/AdminCompanyDetail"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminFeedbacks = lazy(() => import("./pages/admin/AdminFeedbacks"));
const FormulaTester = lazy(() => import("./pages/admin/FormulaTester"));
const AdminInsumosLinha = lazy(() => import("./pages/admin/AdminInsumosLinha"));
const AdminMigrations = lazy(() => import("./pages/admin/AdminMigrations"));


// Create optimized QueryClient with caching
const queryClient = createQueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, companies, currentCompany, isSaasAdmin } = useAuth();

  // Estado local pode estar desatualizado (ex.: reativação feita no painel admin).
  // Revalidamos sempre contra o banco antes de bloquear o usuário.
  const needsSubscriptionCheck = Boolean(!isSaasAdmin && user && currentCompany);
  const {
    data: liveSubscription,
    isLoading: subscriptionLoading,
    allowed: liveAllowed,
  } = useSubscriptionAccess(currentCompany?.id, needsSubscriptionCheck);

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

  // Bloqueio de acesso: libera com assinatura ativa ou trial com data futura.
  if (needsSubscriptionCheck && currentCompany) {
    const cachedAllowed = isSubscriptionAllowed({
      subscription_status: currentCompany.subscription_status,
      trial_ends_at: currentCompany.trial_ends_at,
    });

    if (!cachedAllowed) {
      // Aguarda a verificação atualizada antes de expulsar da rota.
      if (subscriptionLoading || liveSubscription === undefined) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        );
      }
      if (!liveAllowed) {
        return <Navigate to="/planos" replace state={{ fromBlock: true }} />;
      }
    }
  }

  return <>{children}</>;
}


function IndexRedirect() {
  const { isSaasAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSaasAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <Suspense fallback={<LazyPageLoader />}><Index /></Suspense>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isSaasAdmin } = useAuth();

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

  if (!isSaasAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
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
      <Route path="/.lovable/oauth/consent" element={<LazyRoute><OAuthConsent /></LazyRoute>} />
      <Route path="/recuperar-senha" element={<LazyRoute><RecuperarSenha /></LazyRoute>} />
      <Route path="/redefinir-senha" element={<LazyRoute><RedefinirSenha /></LazyRoute>} />
      <Route path="/aceitar-convite" element={<LazyRoute><AceitarConvite /></LazyRoute>} />
      <Route path="/empresa/nova" element={
        <CompanySetupRoute>
          <LazyRoute><CompanySetup /></LazyRoute>
        </CompanySetupRoute>
      } />
      <Route path="/planos" element={
        <CompanySetupRoute><LazyRoute><Planos /></LazyRoute></CompanySetupRoute>
      } />
      
      {/* Dashboard - protected */}
      <Route path="/dashboard" element={<ProtectedRoute><IndexRedirect /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute><ModuleGuard moduleKey="clientes"><LazyRoute><Clientes /></LazyRoute></ModuleGuard></ProtectedRoute>} />
      
      <Route path="/produtos" element={<ProtectedRoute><ModuleGuard moduleKey="produtos"><LazyRoute><Produtos /></LazyRoute></ModuleGuard></ProtectedRoute>} />
      <Route path="/produtos/linha/:linha" element={<ProtectedRoute><ModuleGuard moduleKey="produtos"><LazyRoute><ProdutosLinha /></LazyRoute></ModuleGuard></ProtectedRoute>} />
      <Route path="/orcamentos" element={<ProtectedRoute><ModuleGuard moduleKey="orcamentos"><LazyRoute><Orcamentos /></LazyRoute></ModuleGuard></ProtectedRoute>} />
      <Route path="/ordens-servico" element={<ProtectedRoute><ModuleGuard moduleKey="ordens_servico"><LazyRoute><OrdensServico /></LazyRoute></ModuleGuard></ProtectedRoute>} />
      <Route path="/plano-de-corte" element={<ProtectedRoute><LazyRoute><PlanoDeCorte /></LazyRoute></ProtectedRoute>} />
      <Route path="/estoque" element={<ProtectedRoute><ModuleGuard moduleKey="estoque"><LazyRoute><Estoque /></LazyRoute></ModuleGuard></ProtectedRoute>} />
      <Route path="/estoque/historico" element={<ProtectedRoute><ModuleGuard moduleKey="estoque"><LazyRoute><EstoqueHistorico /></LazyRoute></ModuleGuard></ProtectedRoute>} />
      <Route path="/estoque/retalhos" element={<ProtectedRoute><ModuleGuard moduleKey="estoque"><LazyRoute><BancoRetalhos /></LazyRoute></ModuleGuard></ProtectedRoute>} />
      <Route path="/estoque/linha/:linha" element={<ProtectedRoute><ModuleGuard moduleKey="estoque"><LazyRoute><EstoqueLinha /></LazyRoute></ModuleGuard></ProtectedRoute>} />
      <Route path="/meus-precos" element={<ProtectedRoute><LazyRoute><MeusPrecos /></LazyRoute></ProtectedRoute>} />
      <Route path="/meus-precos/linha/:linha" element={<Navigate to="/meus-precos" replace />} />
      <Route path="/caixa-vendas" element={<ProtectedRoute><ModuleGuard moduleKey="caixa-vendas"><LazyRoute><CaixaVendas /></LazyRoute></ModuleGuard></ProtectedRoute>} />
      <Route path="/vendas" element={<Navigate to="/caixa-vendas" replace />} />
      
      
      
      
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
        <ProtectedRoute><ModuleGuard moduleKey="financeiro"><LazyRoute><Financeiro /></LazyRoute></ModuleGuard></ProtectedRoute>
      } />
      <Route path="/funcionarios" element={
        <ProtectedRoute><ModuleGuard moduleKey="funcionarios"><LazyRoute><Funcionarios /></LazyRoute></ModuleGuard></ProtectedRoute>
      } />
      
      <Route path="/pedidos-compra" element={
        <ProtectedRoute><ModuleGuard moduleKey="pedidos_compra"><LazyRoute><PedidosCompra /></LazyRoute></ModuleGuard></ProtectedRoute>
      } />
      <Route path="/agenda" element={
        <ProtectedRoute><ModuleGuard moduleKey="agenda"><LazyRoute><Agenda /></LazyRoute></ModuleGuard></ProtectedRoute>
      } />
      <Route path="/medicoes" element={
        <ProtectedRoute><ModuleGuard moduleKey="medicoes"><LazyRoute><Medicoes /></LazyRoute></ModuleGuard></ProtectedRoute>
      } />
      <Route path="/relatorios" element={
        <ProtectedRoute><ModuleGuard moduleKey="relatorios"><LazyRoute><Relatorios /></LazyRoute></ModuleGuard></ProtectedRoute>
      } />
      <Route path="/feedbacks" element={
        <ProtectedRoute><ModuleGuard moduleKey="feedbacks"><LazyRoute><Feedbacks /></LazyRoute></ModuleGuard></ProtectedRoute>
      } />
      
      
      {/* Settings routes - all lazy */}
      <Route path="/configuracoes" element={
        <ProtectedRoute><LazyRoute><Configuracoes /></LazyRoute></ProtectedRoute>
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
        <AdminRoute><LazyRoute><AdminDashboard /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/item-templates" element={
        <AdminRoute><LazyRoute><ItemTemplates /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/product-templates" element={
        <AdminRoute><LazyRoute><ProductTemplates /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/linhas" element={<Navigate to="/admin/categories" replace />} />
      <Route path="/admin/linhas/:linha" element={
        <AdminRoute><LazyRoute><ProductTemplates /></LazyRoute></AdminRoute>
      } />

      <Route path="/admin/companies" element={
        <AdminRoute><LazyRoute><AdminCompanies /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/companies/:id" element={
        <AdminRoute><LazyRoute><AdminCompanyDetail /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/import-products" element={
        <AdminRoute><LazyRoute><ImportProducts /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/import-excel" element={
        <AdminRoute><LazyRoute><ImportExcelProducts /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/support" element={
        <AdminRoute><LazyRoute><AdminSupport /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/announcements" element={
        <AdminRoute><LazyRoute><AdminAnnouncements /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/categories" element={
        <AdminRoute><LazyRoute><AdminCategories /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/categories/:slug" element={
        <AdminRoute><LazyRoute><AdminCategoryDetail /></LazyRoute></AdminRoute>
      } />
      {/* Audit logs migrated into /admin/companies/:id (Auditoria tab) */}
      <Route path="/admin/audit-logs" element={<Navigate to="/admin/companies" replace />} />
      <Route path="/admin/settings" element={
        <AdminRoute><LazyRoute><AdminSettings /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/feedbacks" element={
        <AdminRoute><LazyRoute><AdminFeedbacks /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/formula-tester" element={
        <AdminRoute><LazyRoute><FormulaTester /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/migrations" element={
        <AdminRoute><LazyRoute><AdminMigrations /></LazyRoute></AdminRoute>
      } />
      <Route path="/admin/insumos" element={<Navigate to="/admin/categories" replace />} />
      <Route path="/admin/insumos/linha/:linha" element={
        <AdminRoute><LazyRoute><AdminInsumosLinha /></LazyRoute></AdminRoute>
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
