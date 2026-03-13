import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Search, Building2, Users, Phone, Mail, MapPin, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  created_at: string;
  user_count: number;
}

export default function AdminCompanies() {
  const { isSaasAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Optimized query with JOIN to get user counts in a single request
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: async (): Promise<Company[]> => {
      const { data, error } = await supabase
        .from('companies')
        .select(`
          id, name, cnpj, email, phone, address, logo_url, created_at,
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
        logo_url: company.logo_url,
        created_at: company.created_at,
        user_count: (company.user_companies as any)?.[0]?.count || 0,
      })) || [];
    },
    enabled: isSaasAdmin,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });

  const filteredCompanies = companies.filter(company => {
    const searchLower = searchTerm.toLowerCase();
    return (
      company.name.toLowerCase().includes(searchLower) ||
      company.cnpj?.includes(searchTerm) ||
      company.email?.toLowerCase().includes(searchLower) ||
      company.phone?.includes(searchTerm)
    );
  });

  const formatCNPJ = (cnpj: string | null) => {
    if (!cnpj) return '-';
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
  };

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
            <p className="text-muted-foreground">Visualize todas as empresas cadastradas na plataforma</p>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            SaaS Admin
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{companies.length}</p>
                  <p className="text-sm text-muted-foreground">Total de Empresas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <Users className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {companies.reduce((acc, c) => acc + (c.user_count || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total de Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Building2 className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {companies.filter(c => {
                      const date = new Date(c.created_at);
                      const now = new Date();
                      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                    }).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Novos este Mês</p>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Usuários</TableHead>
                  <TableHead>Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma empresa encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company) => (
                    <TableRow key={company.id}>
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
                            <p className="font-medium">{company.name}</p>
                            {company.address && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {company.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {formatCNPJ(company.cnpj)}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {company.email && (
                            <p className="text-sm flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {company.email}
                            </p>
                          )}
                          {company.phone && (
                            <p className="text-sm flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {company.phone}
                            </p>
                          )}
                          {!company.email && !company.phone && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <Users className="h-3 w-3 mr-1" />
                          {company.user_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(company.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
