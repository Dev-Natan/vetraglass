import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Boxes, Plus, ArrowLeft, Trash2, Search, Loader2, GlassWater, Blocks, Recycle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useOffcuts, useCreateOffcut, useUpdateOffcut, useDeleteOffcut,
  type OffcutKind, type OffcutStatus, type Offcut,
} from '@/hooks/useOffcuts';

const STATUS_LABEL: Record<OffcutStatus, string> = {
  available: 'Disponível',
  reserved: 'Reservado',
  used: 'Utilizado',
  discarded: 'Descartado',
};

const STATUS_VARIANT: Record<OffcutStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  available: 'default',
  reserved: 'secondary',
  used: 'outline',
  discarded: 'destructive',
};

const SOURCE_LABEL = {
  manual: 'Cadastro manual',
  plano_corte: 'Plano de Corte',
  os: 'Ordem de Serviço',
  ajuste: 'Ajuste',
};

function formatDim(o: Offcut) {
  if (o.kind === 'vidro') {
    const w = o.width_mm ?? 0;
    const h = o.height_mm ?? 0;
    return `${w} × ${h} mm`;
  }
  return `${o.length_mm ?? 0} mm`;
}

export default function BancoRetalhos() {
  const { currentCompany } = useAuth();
  const [kindFilter, setKindFilter] = useState<'all' | OffcutKind>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | OffcutStatus>('available');
  const [search, setSearch] = useState('');
  const [openNew, setOpenNew] = useState(false);

  const { data: offcuts = [], isLoading } = useOffcuts(currentCompany?.id, {
    kind: kindFilter === 'all' ? undefined : kindFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const del = useDeleteOffcut();
  const update = useUpdateOffcut();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return offcuts;
    return offcuts.filter((o) =>
      [o.name, o.color, o.notes, o.source_reference].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [offcuts, search]);

  const summary = useMemo(() => {
    return {
      total: offcuts.length,
      vidros: offcuts.filter((o) => o.kind === 'vidro').length,
      perfis: offcuts.filter((o) => o.kind === 'perfil').length,
      disponiveis: offcuts.filter((o) => o.status === 'available').length,
    };
  }, [offcuts]);

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/estoque"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
                <Boxes className="w-6 h-6 text-primary" /> Banco de Retalhos
              </h1>
              <p className="text-sm text-muted-foreground">
                Reaproveite sobras de chapas de vidro e barras de perfil antes de gastar material novo.
              </p>
            </div>
          </div>
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="w-4 h-4 mr-1" /> Cadastrar retalho
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={<Boxes />} label="Total" value={summary.total} />
          <SummaryCard icon={<GlassWater />} label="Vidros" value={summary.vidros} />
          <SummaryCard icon={<Blocks />} label="Perfis" value={summary.perfis} />
          <SummaryCard icon={<Recycle />} label="Disponíveis" value={summary.disponiveis} highlight />
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar por nome, cor, observação..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={kindFilter} onValueChange={(v: any) => setKindFilter(v)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="vidro">Vidros</SelectItem>
                  <SelectItem value="perfil">Perfis</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="available">Disponíveis</SelectItem>
                  <SelectItem value="reserved">Reservados</SelectItem>
                  <SelectItem value="used">Utilizados</SelectItem>
                  <SelectItem value="discarded">Descartados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                Nenhum retalho encontrado. Cadastre manualmente ou gere pelo Plano de Corte.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="py-2 px-2">Retalho</th>
                      <th className="py-2 px-2">Dimensões</th>
                      <th className="py-2 px-2">Qtd</th>
                      <th className="py-2 px-2">Origem</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => (
                      <tr key={o.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {o.kind === 'vidro' ? <GlassWater className="w-4 h-4 text-primary" /> : <Blocks className="w-4 h-4 text-primary" />}
                            <div>
                              <div className="font-medium">{o.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {[o.color, o.thickness ? `${o.thickness} mm` : null].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">{formatDim(o)}</td>
                        <td className="py-2 px-2">{Number(o.quantity).toLocaleString('pt-BR')}</td>
                        <td className="py-2 px-2 text-xs">
                          <div>{SOURCE_LABEL[o.source]}</div>
                          {o.source_reference && <div className="text-muted-foreground">{o.source_reference}</div>}
                        </td>
                        <td className="py-2 px-2">
                          <Select
                            value={o.status}
                            onValueChange={(v: OffcutStatus) => update.mutate({ id: o.id, patch: { status: v } })}
                          >
                            <SelectTrigger className="h-7 w-[130px]">
                              <Badge variant={STATUS_VARIANT[o.status]} className="text-xs">{STATUS_LABEL[o.status]}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STATUS_LABEL) as OffcutStatus[]).map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-2">
                          <Button size="icon" variant="ghost" onClick={() => {
                            if (confirm(`Remover o retalho "${o.name}"?`)) del.mutate(o.id);
                          }}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <NewOffcutDialog open={openNew} onOpenChange={setOpenNew} companyId={currentCompany?.id} />
    </MainLayout>
  );
}

function SummaryCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-primary/40' : ''}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${highlight ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function NewOffcutDialog({ open, onOpenChange, companyId }: { open: boolean; onOpenChange: (v: boolean) => void; companyId?: string }) {
  const create = useCreateOffcut();
  const [kind, setKind] = useState<OffcutKind>('vidro');
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [thickness, setThickness] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [length, setLength] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setKind('vidro'); setName(''); setColor(''); setThickness('');
    setWidth(''); setHeight(''); setLength(''); setQuantity('1'); setNotes('');
  };

  const submit = async () => {
    if (!companyId || !name.trim()) return;
    await create.mutateAsync({
      company_id: companyId,
      kind,
      name: name.trim(),
      color: color.trim() || null,
      thickness: thickness ? Number(thickness) : null,
      width_mm: kind === 'vidro' && width ? Number(width) : null,
      height_mm: kind === 'vidro' && height ? Number(height) : null,
      length_mm: kind === 'perfil' && length ? Number(length) : null,
      quantity: Number(quantity) || 1,
      status: 'available',
      source: 'manual',
      notes: notes.trim() || null,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar retalho</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={kind === 'vidro' ? 'default' : 'outline'} onClick={() => setKind('vidro')}>
              <GlassWater className="w-4 h-4 mr-1" /> Vidro
            </Button>
            <Button type="button" size="sm" variant={kind === 'perfil' ? 'default' : 'outline'} onClick={() => setKind('perfil')}>
              <Blocks className="w-4 h-4 mr-1" /> Perfil
            </Button>
          </div>

          <div className="space-y-1">
            <Label>Nome / descrição *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === 'vidro' ? 'Ex: Retalho Incolor 8mm' : 'Ex: Retalho SU001 Preto Fosco'}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Cor</Label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Ex: Incolor / Preto" />
            </div>
            <div className="space-y-1">
              <Label>{kind === 'vidro' ? 'Espessura (mm)' : 'Bitola / espessura'}</Label>
              <Input type="number" step="0.1" value={thickness} onChange={(e) => setThickness(e.target.value)} />
            </div>
          </div>

          {kind === 'vidro' ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Largura (mm)</Label>
                <Input type="number" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="400" />
              </div>
              <div className="space-y-1">
                <Label>Altura (mm)</Label>
                <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="800" />
              </div>
              <div className="space-y-1">
                <Label>Qtd</Label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Comprimento (mm)</Label>
                <Input type="number" value={length} onChange={(e) => setLength(e.target.value)} placeholder="1200" />
              </div>
              <div className="space-y-1">
                <Label>Qtd</Label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Origem, localização, etc." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
