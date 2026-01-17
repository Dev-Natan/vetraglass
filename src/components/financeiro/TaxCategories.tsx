import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tags,
  Plus,
  Edit,
  Trash2,
  Search,
  Info,
  Power
} from 'lucide-react';
import { toast } from 'sonner';

interface TaxCategory {
  id: string;
  name: string;
  ncm_code: string | null;
  description: string | null;
  aliquota_ibs: number;
  aliquota_cbs: number;
  aliquota_is: number;
  is_active: boolean;
}

interface TaxCategoriesProps {
  categories: TaxCategory[];
  onAdd: (category: Omit<TaxCategory, 'id' | 'is_active'>) => Promise<void>;
  onUpdate: (id: string, category: Partial<TaxCategory>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

// Dados padrão por categoria com alíquotas típicas para o setor de vidraçaria
const defaultCategoryData: Record<string, { ncm: string; ibs: number; cbs: number; is: number }> = {
  'Vidros Temperados': { ncm: '7007.19.00', ibs: 17.7, cbs: 8.8, is: 0 },
  'Vidros Laminados': { ncm: '7007.29.00', ibs: 17.7, cbs: 8.8, is: 0 },
  'Espelhos': { ncm: '7009.91.00', ibs: 17.7, cbs: 8.8, is: 0 },
  'Perfis de Alumínio': { ncm: '7604.29.19', ibs: 17.7, cbs: 8.8, is: 0 },
  'Serviços de Instalação': { ncm: '', ibs: 17.7, cbs: 8.8, is: 0 },
};

const defaultCategories = [
  { name: 'Vidros Temperados', ncm: '7007.19.00', desc: 'Vidros de segurança temperados' },
  { name: 'Vidros Laminados', ncm: '7007.29.00', desc: 'Vidros de segurança laminados' },
  { name: 'Espelhos', ncm: '7009.91.00', desc: 'Espelhos de vidro' },
  { name: 'Perfis de Alumínio', ncm: '7604.29.19', desc: 'Perfis ocos de alumínio' },
  { name: 'Serviços de Instalação', ncm: '', desc: 'Mão de obra de instalação' },
];

export function TaxCategories({ categories, onAdd, onUpdate, onDelete, isLoading }: TaxCategoriesProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TaxCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    ncm_code: '',
    description: '',
    aliquota_ibs: 0,
    aliquota_cbs: 0,
    aliquota_is: 0,
  });

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.ncm_code?.includes(searchTerm)
  );

  const handleOpenDialog = (category?: TaxCategory) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        ncm_code: category.ncm_code || '',
        description: category.description || '',
        aliquota_ibs: category.aliquota_ibs,
        aliquota_cbs: category.aliquota_cbs,
        aliquota_is: category.aliquota_is,
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        ncm_code: '',
        description: '',
        aliquota_ibs: 0,
        aliquota_cbs: 0,
        aliquota_is: 0,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome da categoria é obrigatório');
      return;
    }

    try {
      if (editingCategory) {
        await onUpdate(editingCategory.id, formData);
        toast.success('Categoria atualizada!');
      } else {
        await onAdd(formData);
        toast.success('Categoria criada!');
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error('Erro ao salvar categoria');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta categoria?')) {
      try {
        await onDelete(id);
        toast.success('Categoria excluída!');
      } catch (error) {
        toast.error('Erro ao excluir categoria');
      }
    }
  };

  const handleToggleActive = async (category: TaxCategory) => {
    try {
      // Se estiver ativando e as alíquotas estiverem zeradas, preencher com dados padrão
      if (!category.is_active) {
        const defaultData = defaultCategoryData[category.name];
        const needsDefaults = category.aliquota_ibs === 0 && category.aliquota_cbs === 0;
        
        if (defaultData && needsDefaults) {
          await onUpdate(category.id, { 
            is_active: true,
            ncm_code: category.ncm_code || defaultData.ncm,
            aliquota_ibs: defaultData.ibs,
            aliquota_cbs: defaultData.cbs,
            aliquota_is: defaultData.is,
          });
          toast.success('Categoria ativada com dados padrão!');
          return;
        }
      }
      
      await onUpdate(category.id, { is_active: !category.is_active });
      toast.success(category.is_active ? 'Categoria desativada!' : 'Categoria ativada!');
    } catch (error) {
      toast.error('Erro ao alterar status da categoria');
    }
  };

  const handleAddDefaults = async () => {
    for (const cat of defaultCategories) {
      const exists = categories.some(c => c.name === cat.name);
      if (!exists) {
        await onAdd({
          name: cat.name,
          ncm_code: cat.ncm || null,
          description: cat.desc,
          aliquota_ibs: 0,
          aliquota_cbs: 0,
          aliquota_is: 0,
        });
      }
    }
    toast.success('Categorias padrão adicionadas!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Tags className="w-5 h-5" />
            Categorias Tributárias
          </h3>
          <p className="text-sm text-muted-foreground">
            Classificação NCM e alíquotas para produtos e serviços
          </p>
        </div>
        <div className="flex gap-2">
          {categories.length === 0 && (
            <Button variant="outline" onClick={handleAddDefaults} disabled={isLoading}>
              Adicionar Padrões
            </Button>
          )}
          <Button onClick={() => handleOpenDialog()} disabled={isLoading}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Categoria
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">
                Sobre a Reforma Tributária
              </p>
              <p className="text-amber-700 dark:text-amber-400">
                Com a reforma tributária, o IBS (Imposto sobre Bens e Serviços) e CBS (Contribuição sobre Bens e Serviços)
                substituirão gradualmente ICMS, ISS, PIS, COFINS e IPI. Para empresas do Simples Nacional, 
                a transição será gradual e a forma de apuração continuará simplificada através do DAS.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou NCM..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorias Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12">
              <Tags className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'Nenhuma categoria encontrada.' : 'Nenhuma categoria cadastrada ainda.'}
              </p>
              {!searchTerm && (
                <Button variant="outline" className="mt-4" onClick={handleAddDefaults}>
                  Adicionar Categorias Padrão
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>NCM</TableHead>
                    <TableHead className="text-right">IBS (%)</TableHead>
                    <TableHead className="text-right">CBS (%)</TableHead>
                    <TableHead className="text-right">IS (%)</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{category.name}</p>
                          {category.description && (
                            <p className="text-xs text-muted-foreground">{category.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {category.ncm_code ? (
                          <Badge variant="outline" className="font-mono">
                            {category.ncm_code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{category.aliquota_ibs.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{category.aliquota_cbs.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{category.aliquota_is.toFixed(2)}%</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant={category.is_active ? 'default' : 'secondary'}
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleToggleActive(category)}
                        >
                          <Power className="h-3 w-3" />
                          {category.is_active ? 'Ativo' : 'Inativo'}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenDialog(category)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(category.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria Tributária'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Categoria *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Vidros Temperados"
              />
            </div>

            <div className="space-y-2">
              <Label>Código NCM</Label>
              <Input
                value={formData.ncm_code}
                onChange={(e) => setFormData({ ...formData, ncm_code: e.target.value })}
                placeholder="Ex: 7007.19.00"
              />
              <p className="text-xs text-muted-foreground">
                Nomenclatura Comum do Mercosul para classificação fiscal
              </p>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da categoria..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>IBS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.aliquota_ibs}
                  onChange={(e) => setFormData({ ...formData, aliquota_ibs: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>CBS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.aliquota_cbs}
                  onChange={(e) => setFormData({ ...formData, aliquota_cbs: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>IS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.aliquota_is}
                  onChange={(e) => setFormData({ ...formData, aliquota_is: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              * Para empresas do Simples Nacional, essas alíquotas são informativas. 
              A tributação efetiva é calculada pelo DAS.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
