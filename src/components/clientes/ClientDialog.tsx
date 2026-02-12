import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCPFOrCNPJ, validateCPFOrCNPJ } from '@/utils/documentValidation';
import { Loader2, User, History } from 'lucide-react';
import { ClientPurchaseHistory } from './ClientPurchaseHistory';

interface Client {
  id?: string;
  name: string;
  document: string;
  document_type: 'CPF' | 'CNPJ' | null;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  notes: string;
}

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSave: (client: Omit<Client, 'id'>) => Promise<void>;
  isLoading?: boolean;
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const initialForm: Client = {
  name: '',
  document: '',
  document_type: null,
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  notes: '',
};

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
  zip_code?: string;
}

function validateEmail(email: string): boolean {
  if (!email) return true; // optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone: string): boolean {
  if (!phone) return true; // optional field
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

function validateZipCode(zip: string): boolean {
  if (!zip) return true; // optional field
  const digits = zip.replace(/\D/g, '');
  return digits.length === 8;
}

export function ClientDialog({ open, onOpenChange, client, onSave, isLoading }: ClientDialogProps) {
  const [form, setForm] = useState<Client>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (client) {
      setForm(client);
    } else {
      setForm(initialForm);
    }
    setErrors({});
    setTouched({});
  }, [client, open]);

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Nome é obrigatório';
        if (value.trim().length < 2) return 'Nome deve ter pelo menos 2 caracteres';
        if (value.trim().length > 100) return 'Nome deve ter no máximo 100 caracteres';
        return undefined;
      case 'email':
        if (value && !validateEmail(value)) return 'Formato de e-mail inválido (ex: nome@email.com)';
        return undefined;
      case 'phone':
        if (value && !validatePhone(value)) return 'Telefone deve ter 10 ou 11 dígitos';
        return undefined;
      case 'document':
        if (value) {
          const validation = validateCPFOrCNPJ(value);
          if (!validation.valid && (value.replace(/\D/g, '').length === 11 || value.replace(/\D/g, '').length === 14)) {
            return validation.type === 'CPF' ? 'CPF inválido' : validation.type === 'CNPJ' ? 'CNPJ inválido' : 'Documento inválido';
          }
        }
        return undefined;
      case 'zip_code':
        if (value && !validateZipCode(value)) return 'CEP deve ter 8 dígitos (ex: 00000-000)';
        return undefined;
      default:
        return undefined;
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = form[field as keyof Client] as string;
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleDocumentChange = (value: string) => {
    const formatted = formatCPFOrCNPJ(value);
    setForm(prev => ({ ...prev, document: formatted }));
    
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 11 || digits.length === 14) {
      const validation = validateCPFOrCNPJ(formatted);
      if (!validation.valid) {
        setErrors(prev => ({ ...prev, document: 'Documento inválido' }));
      } else {
        setErrors(prev => ({ ...prev, document: undefined }));
        setForm(prev => ({ ...prev, document_type: validation.type }));
      }
    } else {
      setErrors(prev => ({ ...prev, document: undefined }));
      setForm(prev => ({ ...prev, document_type: null }));
    }
  };

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 0) {
      formatted = `(${digits.slice(0, 2)}`;
      if (digits.length > 2) {
        formatted += `) ${digits.slice(2, 7)}`;
        if (digits.length > 7) {
          formatted += `-${digits.slice(7, 11)}`;
        }
      }
    }
    setForm(prev => ({ ...prev, phone: formatted }));
    if (touched.phone) {
      setErrors(prev => ({ ...prev, phone: validateField('phone', formatted) }));
    }
  };

  const handleZipChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 5) {
      formatted = `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    setForm(prev => ({ ...prev, zip_code: formatted }));
    if (touched.zip_code) {
      setErrors(prev => ({ ...prev, zip_code: validateField('zip_code', formatted) }));
    }
  };

  const validateAll = (): boolean => {
    const newErrors: FormErrors = {
      name: validateField('name', form.name),
      email: validateField('email', form.email),
      phone: validateField('phone', form.phone),
      document: validateField('document', form.document),
      zip_code: validateField('zip_code', form.zip_code),
    };
    setErrors(newErrors);
    setTouched({ name: true, email: true, phone: true, document: true, zip_code: true });
    return !Object.values(newErrors).some(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;
    await onSave(form);
  };

  const isEditing = !!client?.id;

  const FieldError = ({ error }: { error?: string }) => 
    error ? <p className="text-sm text-destructive mt-1">{error}</p> : null;

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            onBlur={() => handleBlur('name')}
            placeholder="Nome completo ou razão social"
            className={errors.name && touched.name ? 'border-destructive' : ''}
            maxLength={100}
          />
          <FieldError error={touched.name ? errors.name : undefined} />
        </div>

        <div>
          <Label htmlFor="document">CPF/CNPJ</Label>
          <Input
            id="document"
            value={form.document}
            onChange={e => handleDocumentChange(e.target.value)}
            onBlur={() => handleBlur('document')}
            placeholder="000.000.000-00"
            className={errors.document ? 'border-destructive' : ''}
          />
          <FieldError error={errors.document} />
          {!errors.document && form.document_type && (
            <p className="text-sm text-muted-foreground mt-1">Tipo: {form.document_type}</p>
          )}
        </div>

        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={e => handlePhoneChange(e.target.value)}
            onBlur={() => handleBlur('phone')}
            placeholder="(00) 00000-0000"
            className={errors.phone && touched.phone ? 'border-destructive' : ''}
          />
          <FieldError error={touched.phone ? errors.phone : undefined} />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={e => {
              setForm(prev => ({ ...prev, email: e.target.value }));
              if (touched.email) {
                setErrors(prev => ({ ...prev, email: validateField('email', e.target.value) }));
              }
            }}
            onBlur={() => handleBlur('email')}
            placeholder="email@exemplo.com"
            className={errors.email && touched.email ? 'border-destructive' : ''}
          />
          <FieldError error={touched.email ? errors.email : undefined} />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="address">Endereço</Label>
          <Input
            id="address"
            value={form.address}
            onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
            placeholder="Rua, número, bairro"
            maxLength={200}
          />
        </div>

        <div>
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            value={form.city}
            onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))}
            placeholder="Cidade"
            maxLength={100}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="state">Estado</Label>
            <Select
              value={form.state}
              onValueChange={value => setForm(prev => ({ ...prev, state: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {BRAZILIAN_STATES.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="zip_code">CEP</Label>
            <Input
              id="zip_code"
              value={form.zip_code}
              onChange={e => handleZipChange(e.target.value)}
              onBlur={() => handleBlur('zip_code')}
              placeholder="00000-000"
              className={errors.zip_code && touched.zip_code ? 'border-destructive' : ''}
            />
            <FieldError error={touched.zip_code ? errors.zip_code : undefined} />
          </div>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Anotações sobre o cliente..."
            rows={3}
            maxLength={500}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? 'Salvar' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="client-dialog-description">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          <p id="client-dialog-description" className="text-sm text-muted-foreground">
            {isEditing ? 'Atualize os dados do cliente.' : 'Preencha os dados para cadastrar um novo cliente.'}
          </p>
        </DialogHeader>

        {isEditing ? (
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados" className="gap-2">
                <User className="h-4 w-4" />
                Dados
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-2">
                <History className="h-4 w-4" />
                Histórico
              </TabsTrigger>
            </TabsList>
            <TabsContent value="dados" className="mt-4">
              {renderForm()}
            </TabsContent>
            <TabsContent value="historico" className="mt-4">
              <ClientPurchaseHistory clientId={client!.id!} />
            </TabsContent>
          </Tabs>
        ) : (
          renderForm()
        )}
      </DialogContent>
    </Dialog>
  );
}
