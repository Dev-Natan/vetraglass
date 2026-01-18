import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Circle, Square, Trash2, Plus } from 'lucide-react';

export interface Hole {
  id: string;
  x: number;
  y: number;
  diameter: number;
}

export interface Cutout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HoleCutoutEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panelLetter: string;
  panelWidth: number;
  panelHeight: number;
  holes: Hole[];
  cutouts: Cutout[];
  onHolesChange: (holes: Hole[]) => void;
  onCutoutsChange: (cutouts: Cutout[]) => void;
}

export function HoleCutoutEditor({
  open,
  onOpenChange,
  panelLetter,
  panelWidth,
  panelHeight,
  holes,
  cutouts,
  onHolesChange,
  onCutoutsChange
}: HoleCutoutEditorProps) {
  const [newHole, setNewHole] = useState<Partial<Hole>>({ x: 100, y: 100, diameter: 50 });
  const [newCutout, setNewCutout] = useState<Partial<Cutout>>({ x: 100, y: 100, width: 200, height: 200 });

  const addHole = () => {
    if (newHole.x && newHole.y && newHole.diameter) {
      onHolesChange([
        ...holes,
        {
          id: crypto.randomUUID(),
          x: newHole.x,
          y: newHole.y,
          diameter: newHole.diameter
        }
      ]);
      setNewHole({ x: 100, y: 100, diameter: 50 });
    }
  };

  const removeHole = (id: string) => {
    onHolesChange(holes.filter(h => h.id !== id));
  };

  const addCutout = () => {
    if (newCutout.x && newCutout.y && newCutout.width && newCutout.height) {
      onCutoutsChange([
        ...cutouts,
        {
          id: crypto.randomUUID(),
          x: newCutout.x,
          y: newCutout.y,
          width: newCutout.width,
          height: newCutout.height
        }
      ]);
      setNewCutout({ x: 100, y: 100, width: 200, height: 200 });
    }
  };

  const removeCutout = (id: string) => {
    onCutoutsChange(cutouts.filter(c => c.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Vidro {panelLetter} ({panelWidth} x {panelHeight} mm)</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="holes" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="holes" className="flex items-center gap-2">
              <Circle className="w-4 h-4" />
              Furos ({holes.length})
            </TabsTrigger>
            <TabsTrigger value="cutouts" className="flex items-center gap-2">
              <Square className="w-4 h-4" />
              Recortes ({cutouts.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="holes" className="space-y-4 mt-4">
            {/* Add new hole */}
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <Label className="font-semibold">Adicionar Furo Circular</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Posição X (mm)</Label>
                  <Input
                    type="number"
                    value={newHole.x || ''}
                    onChange={e => setNewHole({ ...newHole, x: parseInt(e.target.value) || 0 })}
                    placeholder="X"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Posição Y (mm)</Label>
                  <Input
                    type="number"
                    value={newHole.y || ''}
                    onChange={e => setNewHole({ ...newHole, y: parseInt(e.target.value) || 0 })}
                    placeholder="Y"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Diâmetro (mm)</Label>
                  <Input
                    type="number"
                    value={newHole.diameter || ''}
                    onChange={e => setNewHole({ ...newHole, diameter: parseInt(e.target.value) || 0 })}
                    placeholder="Ø"
                  />
                </div>
              </div>
              <Button onClick={addHole} size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Furo
              </Button>
            </div>
            
            {/* List of holes */}
            {holes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Furos adicionados:</Label>
                {holes.map((hole, index) => (
                  <div key={hole.id} className="flex items-center gap-2 p-2 border rounded bg-background">
                    <Circle className="w-4 h-4 text-primary" />
                    <span className="flex-1 text-sm">
                      Furo {index + 1}: X={hole.x}, Y={hole.y}, Ø={hole.diameter}mm
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => removeHole(hole.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="cutouts" className="space-y-4 mt-4">
            {/* Add new cutout */}
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <Label className="font-semibold">Adicionar Recorte Retangular</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Posição X (mm)</Label>
                  <Input
                    type="number"
                    value={newCutout.x || ''}
                    onChange={e => setNewCutout({ ...newCutout, x: parseInt(e.target.value) || 0 })}
                    placeholder="X"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Posição Y (mm)</Label>
                  <Input
                    type="number"
                    value={newCutout.y || ''}
                    onChange={e => setNewCutout({ ...newCutout, y: parseInt(e.target.value) || 0 })}
                    placeholder="Y"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Largura (mm)</Label>
                  <Input
                    type="number"
                    value={newCutout.width || ''}
                    onChange={e => setNewCutout({ ...newCutout, width: parseInt(e.target.value) || 0 })}
                    placeholder="L"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Altura (mm)</Label>
                  <Input
                    type="number"
                    value={newCutout.height || ''}
                    onChange={e => setNewCutout({ ...newCutout, height: parseInt(e.target.value) || 0 })}
                    placeholder="A"
                  />
                </div>
              </div>
              <Button onClick={addCutout} size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Recorte
              </Button>
            </div>
            
            {/* List of cutouts */}
            {cutouts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Recortes adicionados:</Label>
                {cutouts.map((cutout, index) => (
                  <div key={cutout.id} className="flex items-center gap-2 p-2 border rounded bg-background">
                    <Square className="w-4 h-4 text-primary" />
                    <span className="flex-1 text-sm">
                      Recorte {index + 1}: X={cutout.x}, Y={cutout.y}, {cutout.width}x{cutout.height}mm
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => removeCutout(cutout.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
