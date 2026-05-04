import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Layers } from 'lucide-react';
import { AddProductPanel } from '../../AddProductPanel';
import { AddItemPanel } from '../../AddItemPanel';

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: Parameters<typeof AddProductPanel>[0]['onAdd'];
  onCancel: () => void;
}

export function AddProductDialog({ open, onOpenChange, onAdd, onCancel }: AddProductDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Adicionar Produto
          </DialogTitle>
          <DialogDescription>
            Selecione o produto e configure as dimensões.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <AddProductPanel onAdd={onAdd} onCancel={onCancel} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: Parameters<typeof AddItemPanel>[0]['onAdd'];
  onCancel: () => void;
}

export function AddItemDialog({ open, onOpenChange, onAdd, onCancel }: AddItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Adicionar Item Avulso
          </DialogTitle>
          <DialogDescription>
            Selecione o item (perfil, acessório, vidro avulso, etc).
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <AddItemPanel onAdd={onAdd} onCancel={onCancel} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
