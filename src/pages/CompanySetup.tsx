import { useEffect, useState } from 'react';
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
import { validateCNPJ, formatCNPJ } from '@/utils/documentValidation';

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
  document: z
    .string()
    .refine((v) => v.replace(/\D/g, '').length === 14, 'CNPJ deve conter 14 dígitos')
    .refine((v) => validateCNPJ(v), 'CNPJ inválido'),
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
    const digits = value.replace(/\D/g, '').slice(0, 14);
    const formatted = formatCNPJ(digits);
    setDocument(formatted);
    setCnpjValidated(null);
    setCnpjData(null);
    setErrors(prev => ({ ...prev, document: '' }));
  };

  // Auto-fetch CNPJ data when 14 valid digits are present.
  // Strategy: try BrasilAPI directly from the browser, then fall back to the
  // `cnpj-lookup` edge function which proxies BrasilAPI → minhareceita → publica.cnpj.ws
  // (avoiding browser-side CORS/timeout issues).
  useEffect(() => {
    const digits = document.replace(/\D/g, '');
    if (digits.length !== 14 || !validateCNPJ(digits)) return;

    let cancelled = false;
    const controller = new AbortController();

    const applyData = (data: any) => {
      if (cancelled || !data) return;
      const razaoSocial = data.razao_social || '';
      const nomeFantasia = data.nome_fantasia || '';
      const empresa = (nomeFantasia || razaoSocial).toUpperCase();

      if (empresa && !name) setName(empresa);
      if (data.ddd_telefone_1 && !phone) setPhone(data.ddd_telefone_1);
      if (data.logradouro && !street) setStreet(String(data.logradouro).trim());
      if (data.numero && !addressNumber) setAddressNumber(String(data.numero));
      if (data.complemento && !complement) setComplement(data.complemento);
      if (data.bairro && !neighborhood) setNeighborhood(data.bairro);
      if (data.municipio && !city) setCity(data.municipio);
      if (data.uf && !state) setState(String(data.uf).toUpperCase());
      if (data.cep && !zipCode) {
        const cep = String(data.cep).replace(/\D/g, '');
        setZipCode(cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep);
      }

      setCnpjValidated(true);
      setCnpjData({
        razaoSocial,
        nomeFantasia,
        situacao: data.descricao_situacao_cadastral || '',
        endereco: [data.logradouro, data.numero, data.bairro, data.municipio, data.uf].filter(Boolean).join(', '),
        telefone: data.ddd_telefone_1 || '',
        email: data.email || '',
      });
    };

    const timer = setTimeout(async () => {
      setIsValidating(true);

      // 1) Direct BrasilAPI from browser (fast path)
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          applyData(data);
          setIsValidating(false);
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        // fall through to edge function fallback
      }

      // 2) Edge function with multi-provider fallback (bypasses browser CORS)
      try {
        const { data: payload, error } = await supabase.functions.invoke('cnpj-lookup', {
          body: { cnpj: digits },
        });
        if (cancelled) return;
        if (error || !payload?.data) throw error || new Error('not found');
        applyData(payload.data);
      } catch {
        if (!cancelled) {
          toast({
            title: 'Aviso',
            description: 'Não foi possível buscar os dados automaticamente',
          });
        }
      } finally {
        if (!cancelled) setIsValidating(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);

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
    
    // Sanitize document and phone (digits only)
    const cleanDocument = document.replace(/\D/g, '');
    const cleanPhone = phone.replace(/\D/g, '');
    const normalizedName = name.trim().toUpperCase();

    const validation = companySchema.safeParse({
      name: normalizedName,
      document: cleanDocument,
      phone: cleanPhone,
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
          _name: normalizedName,
          _cnpj: cleanDocument,
          _phone: cleanPhone || null,
          _email: email || null,
          _address: [street, addressNumber, complement, neighborhood, city, state, zipCode.replace(/\D/g, '')].filter(Boolean).join(', ') || null,
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

      // Define período de teste (14 dias) para a nova empresa
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const newCompanyId = typeof companyData === 'string' ? companyData : (companyData as any)?.id ?? (companyData as any)?.company_id;
      if (newCompanyId) {
        await supabase
          .from('companies')
          .update({
            subscription_status: 'trialing',
            trial_ends_at: trialEndsAt
          } as never)
          .eq('id', newCompanyId);

        // Registra assinatura inicial de trial para integração com painel admin
        await supabase
          .from('company_subscriptions')
          .insert({
            company_id: newCompanyId,
            plan_name: 'trial',
            plan_price: 0,
            status: 'trial',
            started_at: new Date().toISOString(),
            expires_at: trialEndsAt,
            notes: 'Teste grátis de 14 dias concedido no cadastro',
          })
          .catch(() => {});
      }

      toast({
        title: "Empresa cadastrada com sucesso!",
        description: "Seu teste grátis de 14 dias foi ativado. Bem-vindo ao Vetra!",
      });

      // Recarrega o app para sincronizar empresas no AuthContext e acessar o painel
      window.location.href = '/dashboard';
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
          <h1 className="font-display font-bold text-3xl text-foreground">Configure sua Empresa B2B</h1>
          <p className="text-muted-foreground mt-1">Etapa 2 de 2 — vincule sua empresa à conta recém-criada para liberar o acesso</p>
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
                  placeholder="VIDRAÇARIA CENTRAL"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  className="uppercase"
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="document">CNPJ *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="document"
                      placeholder="00.000.000/0001-00"
                      value={document}
                      onChange={(e) => handleDocumentChange(e.target.value)}
                      disabled={isLoading || isValidating}
                      maxLength={18}
                      inputMode="numeric"
                      className={cnpjValidated === true ? 'border-green-500 pr-10' : cnpjValidated === false ? 'border-destructive pr-10' : ''}
                    />
                    {isValidating && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
                    )}
                    {!isValidating && cnpjValidated === true && (
                      <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                    )}
                    {!isValidating && cnpjValidated === false && (
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
                  O CNPJ é obrigatório e será vinculado exclusivamente a esta empresa — não poderá ser usado em outra conta.
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
