import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { User, FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuoteFormData } from '../types';
import { formatPhoneBR } from '@/utils/phoneMask';

interface Client {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  document: string | null;
  document_type: string | null;
}

interface Props {
  form: UseFormReturn<QuoteFormData>;
  isEditing: boolean;
  clients: Client[] | undefined;
  selectedClientId: string;
  onClientSelect: (clientId: string) => void;
}

export function ClientStep({ form, isEditing, clients, selectedClientId, onClientSelect }: Props) {
  const [showContractFields, setShowContractFields] = useState(false);

  if (isEditing) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Cliente</span>
          <Badge variant="secondary">Dados preservados</Badge>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{form.watch('customer_name')}</span>
          </div>
          {form.watch('customer_phone') && (
            <p className="text-sm text-muted-foreground pl-6">{formatPhoneBR(form.watch('customer_phone'))}</p>
          )}
          {form.watch('customer_email') && (
            <p className="text-sm text-muted-foreground pl-6">{form.watch('customer_email')}</p>
          )}
          {form.watch('customer_address') && (
            <p className="text-sm text-muted-foreground pl-6">{form.watch('customer_address')}</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Para alterar dados do cliente, acesse o cadastro de clientes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(clients?.length || 0) > 0 && (
        <div className="space-y-2">
          <FormLabel>Cliente Cadastrado</FormLabel>
          <Select value={selectedClientId} onValueChange={onClientSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione ou digite novo cliente..." />
            </SelectTrigger>
            <SelectContent className="bg-popover border shadow-lg z-50">
              <SelectItem value="new">
                <span className="text-primary">+ Novo Cliente</span>
              </SelectItem>
              {clients?.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <FormField
        control={form.control}
        name="customer_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome do Cliente *</FormLabel>
            <FormControl>
              <Input placeholder="Nome completo" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="customer_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input placeholder="(00) 00000-0000" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="customer_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="email@exemplo.com" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="customer_address"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Endereço</FormLabel>
            <FormControl>
              <Input placeholder="Endereço completo" {...field} />
            </FormControl>
          </FormItem>
        )}
      />

      <Collapsible open={showContractFields} onOpenChange={setShowContractFields}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <FileText className="w-4 h-4" />
            Dados para contrato (opcional)
            <ChevronRight className={cn(
              "w-4 h-4 ml-auto transition-transform",
              showContractFields && "rotate-90"
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="customer_document"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF/CNPJ</FormLabel>
                  <FormControl>
                    <Input placeholder="000.000.000-00" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_document_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Pessoa</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="fisica">Pessoa Física</option>
                      <option value="juridica">Pessoa Jurídica</option>
                    </select>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_profession"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissão</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Empresário" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_marital_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado Civil</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Selecione...</option>
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                    </select>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
