import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Search, Building2, Users, Phone, Mail, MapPin, Trash2, 
  Eye, CreditCard, Calendar, Clock, AlertTriangle, CheckCircle2, 
  XCircle, Edit, Crown, Shield, Package, Trash
} from 'lucide-react';
import { format, differenceInDays, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  created_at: string;
  user_count: number;
}

interface Subscription {
  id: string;
  company_id: string;
  plan_name: string;
  plan_price: number;
  status: string;
  started_at: string;
  expires_at: string | null;
  renewed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
}

export default function AdminCompanies() {
  const { isSaasAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring' | 'no_plan'>('all');
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subCompany, setSubCompany] = useState<Company | null>(null);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [clearAllConfirmText, setClearAllConfirmText] = useState('');
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [subForm, setSubForm] = useState({
    plan_name: 'basico',
    plan_price: 149.90,
    status: 'active',
    expires_at: '',
    notes: '',
  });
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: async (): Promise<Company[]> => {
      const { data, error } = await supabase
        .from('companies')
        .select(`
          id, name, cnpj, email, phone, address, city, state, logo_url, created_at,
          user_companies(count)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data?.map(company => ({
        id: company.id,
        name: company.name,
        cnpj: company.cnpj,
        email: company.email,
        phone: company.phone,
        address: company.address,
        city: (company as any).city,
        state: (company as any).state,
        logo_url: company.logo_url,
        created_at: company.created_at,
        user_count: (company.user_companies as any)?.[0]?.count || 0,
      })) || [];
    },
    enabled: isSaasAdmin,
    staleTime: 1000 * 60 * 2,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: async (): Promise<Subscription[]> => {
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select('*');
      if (error) throw error;
      return (data || []) as unknown as Subscription[];
    },
    enabled: isSaasAdmin,
  });

  const subscriptionMap = new Map(subscriptions.map(s => [s.company_id, s]));

  const upsertSubscription = useMutation({
    mutationFn: async (params: { company_id: string; data: typeof subForm }) => {
      const existing = subscriptionMap.get(params.company_id);
      const payload = {
        company_id: params.company_id,
        plan_name: params.data.plan_name,
        plan_price: params.data.plan_price,
        status: params.data.status,
        expires_at: params.data.expires_at || null,
        notes: params.data.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from('company_subscriptions')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_subscriptions')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Assinatura atualizada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setSubDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao salvar assinatura');
    },
  });

  const clearProductsMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await supabase
        .from('company_products')
        .delete()
        .eq('company_id', companyId);
      
      if (error) throw error;
      
      // Also clear company_linhas
      await supabase
        .from('company_linhas')
        .delete()
        .eq('company_id', companyId);
    },
    onSuccess: () => {
      toast.success('Produtos da empresa apagados com sucesso');
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao apagar produtos');
    },
  });

  const handleClearProducts = (company: Company) => {
    if (confirm(`Tem certeza que deseja APAGAR TODOS os produtos da empresa "${company.name}"? Esta ação não pode ser desfeita.`)) {
      clearProductsMutation.mutate(company.id);
    }
  };

  const handleClearAllCompaniesProducts = async () => {
    setIsClearingAll(true);
    try {
      const { error } = await supabase
        .from('company_products')
        .delete()
        .not('id', 'is', null);
      if (error) throw error;
      await supabase.from('company_linhas').delete().not('id', 'is', null);
      toast.success('Todos os produtos de todas as empresas foram apagados');
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      setClearAllDialogOpen(false);
      setClearAllConfirmText('');
    } catch (err: any) {
      toast.error('Erro ao apagar produtos: ' + (err.message || ''));
    } finally {
      setIsClearingAll(false);
    }
  };

  const filteredCompanies = companies.filter(company => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      company.name.toLowerCase().includes(searchLower) ||
      company.cnpj?.includes(searchTerm) ||
      company.email?.toLowerCase().includes(searchLower) ||
      company.phone?.includes(searchTerm)
    );
    if (!matchesSearch) return false;

    const sub = subscriptionMap.get(company.id);
    if (statusFilter === 'active') return sub?.status === 'active';
    if (statusFilter === 'no_plan') return !sub;
    if (statusFilter === 'expiring') {
      if (!sub?.expires_at) return false;
      const days = differenceInDays(new Date(sub.expires_at), new Date());
      return days >= 0 && days <= 7;
    }
    return true;
  });

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;
    setIsDeleting(true);
    try {
      const { data, error } = await (supabase.rpc as any)('admin_delete_company', {
        p_company_id: companyToDelete.id,
      });

      if (error) {
        throw new Error(error.message || 'Erro ao excluir empresa');
      }

      if (data && data.success === false) {
        throw new Error(data.error || 'Erro ao excluir empresa');
      }

      toast.success(`Empresa "${companyToDelete.name}" excluída com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir empresa');
    } finally {
      setIsDeleting(false);
      setCompanyToDelete(null);
    }
  };

  const openSubDialog = (company: Company) => {
    const existing = subscriptionMap.get(company.id);
    setSubCompany(company);
    setSubForm({
      plan_name: existing?.plan_name || 'basico',
      plan_price: existing?.plan_price || 149.90,
      status: existing?.status || 'active',
      expires_at: existing?.expires_at ? existing.expires_at.split('T')[0] : format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
      notes: existing?.notes || '',
    });
    setSubDialogOpen(true);
  };

  const formatDocument = (doc: string | null) => {
    if (!doc) return '-';
    const cleaned = doc.replace(/\D/g, '');
    if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return doc;
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  const formatCNPJ = formatDocument;

  const getSubscriptionBadge = (companyId: string) => {
    const sub = subscriptionMap.get(companyId);
    if (!sub) {
      return <Badge variant="outline" className="text-muted-foreground border-muted">Sem plano</Badge>;
    }
    
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
      active: { label: 'Ativo', variant: 'default', icon: CheckCircle2 },
      trial: { label: 'Trial', variant: 'secondary', icon: Clock },
      expired: { label: 'Expirado', variant: 'destructive', icon: XCircle },
      cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
      suspended: { label: 'Suspenso', variant: 'outline', icon: AlertTriangle },
    };

    const status = statusMap[sub.status] || statusMap.active;
    const Icon = status.icon;

    return (
      <Badge variant={status.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.label}
      </Badge>
    );
  };

  const getDaysRemaining = (companyId: string) => {
    const sub = subscriptionMap.get(companyId);
    if (!sub?.expires_at) return null;
    const days = differenceInDays(new Date(sub.expires_at), new Date());
    if (days < 0) return <span className="text-destructive font-medium">Vencido há {Math.abs(days)}d</span>;
    if (days <= 7) return <span className="text-orange-500 font-medium">{days}d restantes</span>;
    if (days <= 30) return <span className="text-yellow-600">{days}d restantes</span>;
    return <span className="text-muted-foreground">{days}d restantes</span>;
  };

  const getPlanLabel = (planName: string) => {
    const plans: Record<string, string> = {
      basico: 'Start',
      fiscal: 'Fiscal',
      trial: 'Trial',
    };
    return plans[planName] || planName;
  };

  // Stats
  const activeCount = companies.filter(c => {
    const sub = subscriptionMap.get(c.id);
    return sub?.status === 'active';
  }).length;
  const expiringSoonCount = companies.filter(c => {
    const sub = subscriptionMap.get(c.id);
    if (!sub?.expires_at) return false;
    const days = differenceInDays(new Date(sub.expires_at), new Date());
    return days >= 0 && days <= 7;
  }).length;
  const noSubCount = companies.filter(c => !subscriptionMap.get(c.id)).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSaasAdmin) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Acesso não autorizado.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-3xl text-foreground">Empresas</h1>
            <p className="text-muted-foreground">Gerencie empresas, assinaturas e acessos</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              <Shield className="h-3 w-3 mr-1" />
              SaaS Admin
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClearAllDialogOpen(true)}
              className="gap-2 text-muted-foreground hover:text-destructive"
              title="Ação destrutiva — requer confirmação"
            >
              <Trash className="h-4 w-4" />
              Limpar Produtos (Geral)
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{companies.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            onClick={() => setStatusFilter(s => s === 'active' ? 'all' : 'active')}
            className={`cursor-pointer transition hover:shadow-md ${statusFilter === 'active' ? 'ring-2 ring-green-500' : ''}`}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCount}</p>
                  <p className="text-xs text-muted-foreground">Ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            onClick={() => setStatusFilter(s => s === 'expiring' ? 'all' : 'expiring')}
            className={`cursor-pointer transition hover:shadow-md ${expiringSoonCount > 0 ? 'border-orange-500/50' : ''} ${statusFilter === 'expiring' ? 'ring-2 ring-orange-500' : ''}`}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{expiringSoonCount}</p>
                  <p className="text-xs text-muted-foreground">Vencendo</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            onClick={() => setStatusFilter(s => s === 'no_plan' ? 'all' : 'no_plan')}
            className={`cursor-pointer transition hover:shadow-md ${statusFilter === 'no_plan' ? 'ring-2 ring-muted-foreground' : ''}`}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{noSubCount}</p>
                  <p className="text-xs text-muted-foreground">Sem plano</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {companies.reduce((acc, c) => acc + (c.user_count || 0), 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Empresas Cadastradas
            </CardTitle>
            <CardDescription>
              {filteredCompanies.length} empresa(s) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ / CPF</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Renovação</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhuma empresa encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanies.map((company) => {
                      const sub = subscriptionMap.get(company.id);
                      return (
                        <TableRow
                          key={company.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => navigate(`/admin/companies/${company.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {company.logo_url ? (
                                <img 
                                  src={company.logo_url} 
                                  alt={company.name}
                                  className="w-10 h-10 rounded-lg object-cover border"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                  <Building2 className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium uppercase">{company.name}</p>
                                {(company.city || company.state) && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {[company.city, company.state].filter(Boolean).join(' - ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {formatCNPJ(company.cnpj)}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {company.email && (
                                <p className="text-xs flex items-center gap-1">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  {company.email}
                                </p>
                              )}
                              {company.phone && (
                                <p className="text-xs flex items-center gap-1">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  {formatPhone(company.phone)}
                                </p>
                              )}
                              {!company.email && !company.phone && (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {sub ? (
                              <div className="flex items-center gap-1">
                                <Crown className="h-3 w-3 text-yellow-500" />
                                <span className="text-sm font-medium">{getPlanLabel(sub.plan_name)}</span>
                                <span className="text-xs text-muted-foreground">
                                  R$ {Number(sub.plan_price).toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getSubscriptionBadge(company.id)}
                          </TableCell>
                          <TableCell>
                            {getDaysRemaining(company.id) || (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              <Users className="h-3 w-3 mr-1" />
                              {company.user_count || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(company.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/admin/companies/${company.id}`)}
                                title="Abrir perfil"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary"
                                onClick={() => openSubDialog(company)}
                                title="Gerenciar assinatura"
                              >
                                <CreditCard className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                                onClick={() => handleClearProducts(company)}
                                title="Apagar todos os produtos"
                              >
                                <Package className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setCompanyToDelete(company)}
                                title="Excluir empresa"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Company Detail Dialog */}
      <Dialog open={!!selectedCompany} onOpenChange={(open) => !open && setSelectedCompany(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedCompany?.name}
            </DialogTitle>
            <DialogDescription>Detalhes da empresa</DialogDescription>
          </DialogHeader>
          {selectedCompany && (() => {
            const sub = subscriptionMap.get(selectedCompany.id);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">CNPJ / CPF</p>
                    <p className="font-medium">{formatCNPJ(selectedCompany.cnpj)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cadastro</p>
                    <p className="font-medium">{format(new Date(selectedCompany.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedCompany.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="font-medium">{formatPhone(selectedCompany.phone)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Localização</p>
                    <p className="font-medium">
                      {[selectedCompany.address, selectedCompany.city, selectedCompany.state].filter(Boolean).join(', ') || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Usuários</p>
                    <p className="font-medium">{selectedCompany.user_count}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Assinatura
                  </h4>
                  {sub ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Plano</p>
                        <p className="font-medium">{getPlanLabel(sub.plan_name)} - R$ {Number(sub.plan_price).toFixed(2)}/mês</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <div className="mt-0.5">{getSubscriptionBadge(selectedCompany.id)}</div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Início</p>
                        <p className="font-medium">{format(new Date(sub.started_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Vencimento</p>
                        <p className="font-medium">
                          {sub.expires_at ? format(new Date(sub.expires_at), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                        </p>
                        {getDaysRemaining(selectedCompany.id)}
                      </div>
                      {sub.notes && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Observações</p>
                          <p className="text-sm">{sub.notes}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma assinatura configurada</p>
                  )}
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" className="sm:flex-1" onClick={() => { setSelectedCompany(null); openSubDialog(selectedCompany); }}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Gerenciar Assinatura
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="sm:flex-1"
                    onClick={() => { setSelectedCompany(null); handleClearProducts(selectedCompany); }}
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Apagar Produtos
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Subscription Management Dialog */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Assinatura - {subCompany?.name}
            </DialogTitle>
            <DialogDescription>Configure o plano e status da assinatura</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={subForm.plan_name} onValueChange={(v) => {
                  const prices: Record<string, number> = { basico: 149.90, fiscal: 249.90, trial: 0 };
                  setSubForm(f => ({ ...f, plan_name: v, plan_price: prices[v] ?? f.plan_price }));
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial (Gratuito)</SelectItem>
                    <SelectItem value="basico">Start - R$ 149,90</SelectItem>
                    <SelectItem value="fiscal">Fiscal - R$ 249,90</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={subForm.plan_price}
                  onChange={(e) => setSubForm(f => ({ ...f, plan_price: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={subForm.status} onValueChange={(v) => setSubForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={subForm.expires_at}
                  onChange={(e) => setSubForm(f => ({ ...f, expires_at: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Notas sobre a assinatura..."
                value={subForm.notes}
                onChange={(e) => setSubForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => subCompany && upsertSubscription.mutate({ company_id: subCompany.id, data: subForm })}
              disabled={upsertSubscription.isPending}
            >
              {upsertSubscription.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!companyToDelete} onOpenChange={(open) => !open && setCompanyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa <strong>{companyToDelete?.name}</strong>?
              <br /><br />
              Esta ação é <strong>irreversível</strong> e removerá todos os dados associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCompany}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Products Confirmation Dialog */}
      <Dialog open={clearAllDialogOpen} onOpenChange={(open) => {
        setClearAllDialogOpen(open);
        if (!open) setClearAllConfirmText('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Limpar Produtos de TODAS as empresas
            </DialogTitle>
            <DialogDescription>
              Esta ação é <strong>irreversível</strong> e apagará todos os produtos e linhas de todas as empresas cadastradas. Para prosseguir, digite <strong>CONFIRMAR</strong> abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Digite CONFIRMAR para habilitar a ação</Label>
            <Input
              value={clearAllConfirmText}
              onChange={(e) => setClearAllConfirmText(e.target.value)}
              placeholder="CONFIRMAR"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearAllDialogOpen(false)} disabled={isClearingAll}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAllCompaniesProducts}
              disabled={clearAllConfirmText !== 'CONFIRMAR' || isClearingAll}
            >
              {isClearingAll && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Apagar Tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
