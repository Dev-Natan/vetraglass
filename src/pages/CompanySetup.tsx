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
  document: z.string().optional().refine((val) => {
    if (!val || val.trim() === '') return true;
    const result = validateCPFOrCNPJ(val);
    return result.valid;
  }, 'CPF ou CNPJ inválido'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  zipCode: z.string().optional(),
  street: z.string().optional(),
  addressNumber: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, 'Use a sigla do estado (ex: SP)').optional(),
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
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

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
        
        if (data.data.nomeFantasia || data.data.razaoSocial) {
          setName(data.data.nomeFantasia || data.data.razaoSocial);
        }
        if (data.data.endereco) {
          // Try to parse address into parts
          setStreet(data.data.endereco);
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
    
    // Limpar documento antes de validar
    const cleanDocument = document ? document.replace(/\D/g, '') : '';
    
    const validation = companySchema.safeParse({
      name,
      document: cleanDocument,
      phone,
      email,
      zipCode,
      street,
      addressNumber,
      complement,
      neighborhood,
      city,
      state,
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
          _cnpj: cleanDocument || null, // Envia null se vazio
          _phone: phone || null,
          _email: email || null,
          _address: [street, addressNumber, complement, neighborhood, city, state, zipCode].filter(Boolean).join(', ') || null,
        });
      
      if (companyError) {
        // Tratar erro de CNPJ duplicado
        if (companyError.message.includes('CNPJ_JA_CADASTRADO')) {
          toast({
            title: "CNPJ já em uso",
            description: "Este CNPJ já está vinculado a outra empresa no sistema.",
            variant: "destructive",
          });
          setErrors(prev => ({ ...prev, document: 'CNPJ já cadastrado' }));
          return;
        }
        throw companyError;
      }
      
      toast({
        title: "Empresa cadastrada!",
        description: "Sua empresa foi criada com sucesso. Faça login para continuar.",
      });
      
      // Sign out and redirect to login so user can login with the new company
      await supabase.auth.signOut();
      navigate('/auth');
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
                <Label htmlFor="document">CPF ou CNPJ (opcional)</Label>
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
                  O documento é opcional. Se informado, será vinculado exclusivamente a esta empresa e não poderá ser usado em outra conta.
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
                <Label htmlFor="zipCode">CEP</Label>
                <Input
                  id="zipCode"
                  placeholder="00000-000"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  disabled={isLoading}
                  maxLength={9}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="street">Rua / Logradouro</Label>
                <Input
                  id="street"
                  placeholder="Rua Principal"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="addressNumber">Número</Label>
                  <Input
                    id="addressNumber"
                    placeholder="123"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complement">Complemento</Label>
                  <Input
                    id="complement"
                    placeholder="Sala 01"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  placeholder="Centro"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    placeholder="São Paulo"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado (UF)</Label>
                  <Input
                    id="state"
                    placeholder="SP"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    disabled={isLoading}
                    maxLength={2}
                  />
                </div>
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
