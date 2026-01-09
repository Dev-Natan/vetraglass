import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, ArrowLeft, CheckCircle, XCircle, Search } from 'lucide-react';
import { z } from 'zod';
import { validateCPFOrCNPJ, formatCPFOrCNPJ } from '@/utils/documentValidation';

interface CNPJData {
  razaoSocial: string;
  nomeFantasia: string;
  situacao: string;
  endereco: string;
  telefone: string;
  email: string;
}

const companySchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  document: z.string().refine((val) => {
    const result = validateCPFOrCNPJ(val);
    return result.valid;
  }, 'CPF ou CNPJ inválido'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
});

export default function CompanySetup() {
  const navigate = useNavigate();
  const { user, setCurrentCompany, signOut } = useAuth();
  const { toast } = useToast();

  const handleBackToLogin = async () => {
    await signOut();
    navigate('/auth');
  };
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [cnpjValidated, setCnpjValidated] = useState<boolean | null>(null);
  const [cnpjData, setCnpjData] = useState<CNPJData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const handleDocumentChange = (value: string) => {
    const formatted = formatCPFOrCNPJ(value);
    setDocument(formatted);
    setCnpjValidated(null);
    setCnpjData(null);
    setErrors(prev => ({ ...prev, document: '' }));
  };

  const validateCNPJWithReceita = async () => {
    const cleanDoc = document.replace(/\D/g, '');
    
    // Only validate CNPJ (14 digits), not CPF
    if (cleanDoc.length !== 14) {
      toast({
        title: "Consulta disponível apenas para CNPJ",
        description: "A consulta à Receita Federal é apenas para CNPJ (14 dígitos).",
        variant: "default",
      });
      return;
    }

    setIsValidating(true);
    setCnpjValidated(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-cnpj', {
        body: { cnpj: cleanDoc },
      });

      if (error) throw error;

      if (data.valid && data.active) {
        setCnpjValidated(true);
        setCnpjData(data.data);
        
        // Auto-fill fields with data from Receita Federal
        if (data.data.nomeFantasia || data.data.razaoSocial) {
          setName(data.data.nomeFantasia || data.data.razaoSocial);
        }
        if (data.data.endereco) {
          setAddress(data.data.endereco);
        }
        if (data.data.telefone) {
          setPhone(data.data.telefone);
        }
        if (data.data.email) {
          setEmail(data.data.email);
        }

        toast({
          title: "CNPJ Validado!",
          description: `Empresa: ${data.data.razaoSocial}`,
        });
      } else {
        setCnpjValidated(false);
        setErrors(prev => ({ ...prev, document: data.error || 'CNPJ inválido ou inativo' }));
        toast({
          title: "CNPJ não validado",
          description: data.error || 'CNPJ não encontrado ou empresa inativa',
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error validating CNPJ:', error);
      toast({
        title: "Erro na consulta",
        description: "Não foi possível consultar o CNPJ. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const validation = companySchema.safeParse({
      name,
      document: document.replace(/\D/g, ''),
      phone,
      email,
      address,
    });
    
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }
    
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      // Use RPC to create company and assign admin role
      const { data: companyData, error: companyError } = await supabase
        .rpc('create_company_and_assign_admin', {
          _name: name,
          _cnpj: document.replace(/\D/g, ''),
          _phone: phone || '',
          _email: email || '',
          _address: address || '',
        });
      
      if (companyError) throw companyError;
      
      setCurrentCompany(companyData);
      
      toast({
        title: "Empresa cadastrada!",
        description: "Sua empresa foi criada com sucesso.",
      });
      
      navigate('/');
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast({
        title: "Erro ao criar empresa",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar via-background to-background p-4">
      <div className="w-full max-w-lg">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={handleBackToLogin}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Login
        </Button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display font-bold text-3xl text-foreground">Cadastrar Empresa</h1>
          <p className="text-muted-foreground mt-1">Configure sua primeira empresa no sistema</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle>Dados da Empresa</CardTitle>
            <CardDescription>
              Preencha as informações básicas da sua vidraçaria
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa *</Label>
                <Input
                  id="name"
                  placeholder="Vidraçaria Central"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="document">CPF ou CNPJ *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="document"
                      placeholder="000.000.000-00 ou 00.000.000/0001-00"
                      value={document}
                      onChange={(e) => handleDocumentChange(e.target.value)}
                      disabled={isLoading || isValidating}
                      maxLength={18}
                      className={cnpjValidated === true ? 'border-green-500 pr-10' : cnpjValidated === false ? 'border-destructive pr-10' : ''}
                    />
                    {cnpjValidated === true && (
                      <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                    )}
                    {cnpjValidated === false && (
                      <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-destructive" />
                    )}
                  </div>
                  {document.replace(/\D/g, '').length === 14 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={validateCNPJWithReceita}
                      disabled={isValidating || isLoading}
                      className="shrink-0"
                    >
                      {isValidating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-1" />
                          Consultar
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {errors.document && (
                  <p className="text-sm text-destructive">{errors.document}</p>
                )}
                {cnpjData && cnpjValidated && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 text-sm">
                    <p className="font-medium text-green-800 dark:text-green-200">{cnpjData.razaoSocial}</p>
                    <p className="text-green-600 dark:text-green-400 text-xs">Situação: {cnpjData.situacao}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Digite um CPF (11 dígitos) ou CNPJ (14 dígitos) válido. Para CNPJ, clique em "Consultar" para validar na Receita Federal.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contato@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  placeholder="Rua Principal, 123 - Centro"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando empresa...
                  </>
                ) : (
                  'Criar Empresa e Continuar'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
