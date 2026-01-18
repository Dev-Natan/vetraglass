import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Save, Loader2 } from 'lucide-react';

interface SaveProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, notes: string) => Promise<void>;
  defaultName?: string;
  isEditing?: boolean;
}

export function SaveProjectDialog({
  open,
  onOpenChange,
  onSave,
  defaultName = '',
  isEditing = false
}: SaveProjectDialogProps) {
  const [name, setName] = useState(defaultName);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      await onSave(name.trim(), notes.trim());
      onOpenChange(false);
      setName('');
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Atualizar Projeto' : 'Salvar Projeto de Vidro'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Nome do Projeto *</Label>
            <Input
              id="project-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Box Cliente João - Banheiro Suíte"
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="project-notes">Observações (opcional)</Label>
            <Textarea
              id="project-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Adicione observações sobre o projeto..."
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isEditing ? 'Atualizar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
