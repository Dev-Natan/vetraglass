import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Sparkles, Plus } from 'lucide-react';
import { AddStockDialogContent } from './AddStockDialogContent';
import { CreateCustomItemContent } from './CreateCustomItemContent';

interface UnifiedAddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnifiedAddItemDialog({ open, onOpenChange }: UnifiedAddItemDialogProps) {
  const [activeTab, setActiveTab] = useState('system');

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setActiveTab('system');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <DialogTitle>Adicionar Item ao Estoque</DialogTitle>
          </div>
          <DialogDescription>
            Selecione um item existente do catálogo ou crie um novo item personalizado.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 pt-3 border-b bg-muted/20">
            <TabsList className="w-full grid grid-cols-2 h-10">
              <TabsTrigger value="system" className="gap-2 text-sm">
                <Package className="h-4 w-4" />
                Item do Sistema
              </TabsTrigger>
              <TabsTrigger value="custom" className="gap-2 text-sm">
                <Sparkles className="h-4 w-4" />
                Novo Item
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="system" className="flex-1 flex flex-col min-h-0 m-0 mt-0 data-[state=inactive]:hidden">
            <AddStockDialogContent onClose={() => handleClose(false)} />
          </TabsContent>

          <TabsContent value="custom" className="flex-1 flex flex-col min-h-0 m-0 mt-0 data-[state=inactive]:hidden">
            <CreateCustomItemContent onClose={() => handleClose(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
