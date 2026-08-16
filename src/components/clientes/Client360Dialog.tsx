import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { formatCPFOrCNPJ, validateCPFOrCNPJ } from '@/utils/documentValidation';
import { Loader2, User, History, Zap, BarChart3 } from 'lucide-react';
import { ClientKPIs } from './ClientKPIs';
import { ClientTimeline } from './ClientTimeline';
import { ClientQuickActions } from './ClientQuickActions';

interface Client {
  id?: string;
  name: string;
  client_type: 'cliente' | 'fornecedor' | 'ambos';
  document: string;
  document_type: 'CPF' | 'CNPJ' | null;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  notes: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface Client360DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSave: (client: Omit<Client, 'id'>) => Promise<void>;
  defaultType?: 'cliente' | 'fornecedor';
  isLoading?: boolean;
  /** Aba aberta ao exibir um cliente existente (ex.: 'historico'). */
  initialTab?: string;
}


const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const initialForm: Client = {
  name: '',
  client_type: 'cliente',
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

export function Client360Dialog({ open, onOpenChange, client, onSave, defaultType, isLoading, initialTab }: Client360DialogProps) {
  const [form, setForm] = useState<Client>(initialForm);
  const [documentError, setDocumentError] = useState('');
  const [activeTab, setActiveTab] = useState('visao-geral');

  useEffect(() => {
    if (client) {
      setForm(client);
      setActiveTab(initialTab || 'visao-geral');
    } else {
      setForm({ ...initialForm, client_type: defaultType || 'cliente' });
      setActiveTab('dados');
    }
    setDocumentError('');
  }, [client, open, initialTab]);


  const handleDocumentChange = (value: string) => {
    const formatted = formatCPFOrCNPJ(value);
    setForm(prev => ({ ...prev, document: formatted }));
    
    if (formatted.length === 14 || formatted.length === 18) {
      const validation = validateCPFOrCNPJ(formatted);
      if (!validation.valid) {
        setDocumentError('Documento inválido');
      } else {
        setDocumentError('');
        setForm(prev => ({ ...prev, document_type: validation.type }));
      }
    } else {
      setDocumentError('');
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
  };

  const handleZipChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 5) {
      formatted = `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    setForm(prev => ({ ...prev, zip_code: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (form.document && !validateCPFOrCNPJ(form.document).valid) {
      setDocumentError('Documento inválido');
      return;
    }
    
    await onSave(form);
  };

  const isEditing = !!client?.id;

  const formFields = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-1">
        <Label htmlFor="client_type">Tipo de Cadastro *</Label>
        <Select
          value={form.client_type}
          onValueChange={value => setForm(prev => ({ ...prev, client_type: value as Client['client_type'] }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cliente">Cliente</SelectItem>
            <SelectItem value="fornecedor">Fornecedor</SelectItem>
            <SelectItem value="ambos">Cliente e fornecedor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-1">
        <Label htmlFor="name">Nome / Razão Social *</Label>
        <Input
          id="name"
          value={form.name}
          onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Nome completo ou razão social"
          className="uppercase placeholder:normal-case"
          required
        />
      </div>

      <div>
        <Label htmlFor="document">CPF/CNPJ</Label>
        <Input
          id="document"
          value={form.document}
          onChange={e => handleDocumentChange(e.target.value)}
          placeholder="000.000.000-00"
          className={documentError ? 'border-destructive' : ''}
        />
        {documentError && (
          <p className="text-sm text-destructive mt-1">{documentError}</p>
        )}
        {form.document_type && (
          <p className="text-sm text-muted-foreground mt-1">Tipo: {form.document_type}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone">Telefone</Label>
        <Input
          id="phone"
          value={form.phone}
          onChange={e => handlePhoneChange(e.target.value)}
          placeholder="(00) 00000-0000"
        />
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
          placeholder="email@exemplo.com"
        />
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="address">Endereço</Label>
        <Input
          id="address"
          value={form.address}
          onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
          placeholder="Rua, número, bairro"
        />
      </div>

      <div>
        <Label htmlFor="city">Cidade</Label>
        <Input
          id="city"
          value={form.city}
          onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))}
          placeholder="Cidade"
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
            placeholder="00000-000"
          />
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
        />
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="client-dialog-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <span className="uppercase">{isEditing ? client.name : (defaultType === 'fornecedor' ? 'Novo Fornecedor' : 'Novo Cliente')}</span>
          </DialogTitle>
          <p id="client-dialog-description" className="text-sm text-muted-foreground">
            {isEditing ? 'Visão completa do cliente' : 'Preencha os dados para cadastrar um novo cliente'}
          </p>
        </DialogHeader>

        {isEditing ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="visao-geral" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Visão Geral</span>
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Histórico</span>
              </TabsTrigger>
              <TabsTrigger value="acoes" className="gap-2">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Ações</span>
              </TabsTrigger>
              <TabsTrigger value="dados" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Dados</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visao-geral" className="mt-4 space-y-6">
              <ClientKPIs clientId={client.id!} clientName={client.name} />
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-3">Ações Rápidas</h3>
                <ClientQuickActions 
                  client={{ ...client, id: client.id! }} 
                  onClose={() => onOpenChange(false)} 
                />
              </div>
            </TabsContent>

            <TabsContent value="historico" className="mt-4">
              <ClientTimeline clientId={client.id!} clientName={client.name} />
            </TabsContent>

            <TabsContent value="acoes" className="mt-4">
              <ClientQuickActions 
                client={{ ...client, id: client.id! }} 
                onClose={() => onOpenChange(false)} 
              />
            </TabsContent>

            <TabsContent value="dados" className="mt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {formFields}
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading || !form.name.trim()}>
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {formFields}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || !form.name.trim()}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {defaultType === 'fornecedor' ? 'Cadastrar Fornecedor' : 'Cadastrar Cliente'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
