import { useState } from 'react';
import { useBankAccounts, type BankAccount, type AccountType, ACCOUNT_TYPE_LABEL } from '@/hooks/useBankAccounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Landmark, Wallet, PiggyBank, Smartphone, TrendingUp, Star } from 'lucide-react';
import { toast } from 'sonner';

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TYPE_ICON: Record<AccountType, React.ElementType> = {
  corrente: Landmark,
  poupanca: PiggyBank,
  caixa: Wallet,
  investimento: TrendingUp,
  carteira_digital: Smartphone,
};

const PRESET_COLORS = ['#3b82f6','#16a34a','#dc2626','#ea580c','#7c3aed','#0891b2','#facc15','#64748b'];

export function BankAccountsTab() {
  const { data: accounts = [], isLoading, upsert, remove } = useBankAccounts(false);
  const [editing, setEditing] = useState<Partial<BankAccount> | null>(null);

  const totalBalance = accounts
    .filter((a) => a.active)
    .reduce((s, a) => s + Number(a.current_balance || 0), 0);

  const handleSave = () => {
    if (!editing?.name?.trim()) {
      toast.error('Informe o nome da conta');
      return;
    }
    upsert.mutate(editing, { onSuccess: () => setEditing(null) });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">Saldo total</span>
            <p className="text-2xl font-bold mt-1">{formatBRL(totalBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">{accounts.filter(a => a.active).length} contas ativas</p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 bg-muted/30">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Cadastre suas contas bancárias, caixa físico e carteiras digitais. Ao registrar pagamentos e recebimentos,
            vincule à conta correspondente para manter o saldo e a conciliação em dia.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Contas Bancárias</CardTitle>
          <Button size="sm" onClick={() => setEditing({ account_type: 'corrente', color: '#3b82f6', initial_balance: 0, current_balance: 0, active: true })}>
            <Plus className="w-4 h-4 mr-1" /> Nova conta
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhuma conta cadastrada. Comece criando sua conta principal.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts.map((acc) => {
                const Icon = TYPE_ICON[acc.account_type];
                return (
                  <div
                    key={acc.id}
                    className={`relative p-4 rounded-lg border bg-card hover:shadow-md transition-all ${
                      !acc.active ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg" style={{ backgroundColor: acc.color || '#3b82f6' }} />
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-md" style={{ backgroundColor: `${acc.color || '#3b82f6'}20`, color: acc.color || '#3b82f6' }}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{acc.name}</p>
                          <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABEL[acc.account_type]}</p>
                        </div>
                      </div>
                      {acc.is_default && (
                        <Badge variant="secondary" className="gap-1 text-[10px] h-5">
                          <Star className="w-3 h-3" /> padrão
                        </Badge>
                      )}
                    </div>
                    {acc.bank_name && (
                      <p className="text-xs text-muted-foreground mb-1">
                        {acc.bank_name}
                        {acc.agency && ` · Ag ${acc.agency}`}
                        {acc.account_number && ` · CC ${acc.account_number}`}
                      </p>
                    )}
                    <p className="text-xl font-bold mt-2">{formatBRL(Number(acc.current_balance || 0))}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo atual</p>
                    <div className="flex gap-1 mt-3 pt-3 border-t">
                      <Button variant="ghost" size="sm" className="flex-1 h-8" onClick={() => setEditing(acc)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive"
                        onClick={() => {
                          if (confirm(`Remover conta "${acc.name}"?`)) remove.mutate(acc.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar conta' : 'Nova conta bancária'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nome de exibição *</Label>
                  <Input
                    value={editing.name || ''}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Ex.: Itaú Principal"
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={editing.account_type}
                    onValueChange={(v) => setEditing({ ...editing, account_type: v as AccountType })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACCOUNT_TYPE_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Banco</Label>
                  <Input
                    value={editing.bank_name || ''}
                    onChange={(e) => setEditing({ ...editing, bank_name: e.target.value })}
                    placeholder="Ex.: Itaú, Bradesco…"
                  />
                </div>
                <div>
                  <Label>Agência</Label>
                  <Input
                    value={editing.agency || ''}
                    onChange={(e) => setEditing({ ...editing, agency: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Conta</Label>
                  <Input
                    value={editing.account_number || ''}
                    onChange={(e) => setEditing({ ...editing, account_number: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Saldo inicial</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.initial_balance ?? 0}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      setEditing({
                        ...editing,
                        initial_balance: v,
                        current_balance: editing.id ? editing.current_balance : v,
                      });
                    }}
                  />
                </div>
                {editing.id && (
                  <div className="col-span-2">
                    <Label>Saldo atual</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editing.current_balance ?? 0}
                      onChange={(e) => setEditing({ ...editing, current_balance: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
                <div className="col-span-2">
                  <Label>Chave PIX</Label>
                  <Input
                    value={editing.pix_key || ''}
                    onChange={(e) => setEditing({ ...editing, pix_key: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Cor</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditing({ ...editing, color: c })}
                        className={`w-7 h-7 rounded-full border-2 ${editing.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={editing.notes || ''}
                    onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="col-span-2 flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Conta padrão</p>
                    <p className="text-xs text-muted-foreground">Usada por padrão em novos lançamentos</p>
                  </div>
                  <Switch
                    checked={!!editing.is_default}
                    onCheckedChange={(v) => setEditing({ ...editing, is_default: v })}
                  />
                </div>
                <div className="col-span-2 flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Ativa</p>
                    <p className="text-xs text-muted-foreground">Contas inativas não aparecem em novos lançamentos</p>
                  </div>
                  <Switch
                    checked={editing.active ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
