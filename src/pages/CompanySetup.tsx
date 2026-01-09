import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { validateCPFOrCNPJ, formatCPFOrCNPJ } from '@/utils/documentValidation';

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const handleDocumentChange = (value: string) => {
    const formatted = formatCPFOrCNPJ(value);
    setDocument(formatted);
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
                <Input
                  id="document"
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  value={document}
                  onChange={(e) => handleDocumentChange(e.target.value)}
                  disabled={isLoading}
                  maxLength={18}
                />
                {errors.document && (
                  <p className="text-sm text-destructive">{errors.document}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Digite um CPF (11 dígitos) ou CNPJ (14 dígitos) válido
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
