import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Circle, Square, Trash2, Plus, Copy, Check, X, Pencil } from 'lucide-react';

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

// Mini preview component for visualizing holes and cutouts
function PanelPreview({
  panelWidth,
  panelHeight,
  holes,
  cutouts,
  selectedHoleId,
  selectedCutoutId,
  onSelectHole,
  onSelectCutout
}: {
  panelWidth: number;
  panelHeight: number;
  holes: Hole[];
  cutouts: Cutout[];
  selectedHoleId: string | null;
  selectedCutoutId: string | null;
  onSelectHole: (id: string | null) => void;
  onSelectCutout: (id: string | null) => void;
}) {
  const previewWidth = 200;
  const previewHeight = 150;
  const padding = 20;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingHoleId, setDraggingHoleId] = useState<string | null>(null);

  // Calculate scale to fit panel in preview
  const scaleX = (previewWidth - padding * 2) / panelWidth;
  const scaleY = (previewHeight - padding * 2) / panelHeight;
  const scale = Math.min(scaleX, scaleY);

  const scaledWidth = panelWidth * scale;
  const scaledHeight = panelHeight * scale;
  const offsetX = (previewWidth - scaledWidth) / 2;
  const offsetY = (previewHeight - scaledHeight) / 2;

  // Convert panel coordinates to SVG coordinates (origin at bottom-left of panel)
  const toSvgX = (x: number) => offsetX + x * scale;
  const toSvgY = (y: number) => offsetY + scaledHeight - y * scale; // Flip Y axis

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const updateHoleFromPointer = (clientX: number, clientY: number, holeId: string, snapStep: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const svgX = clientX - rect.left;
    const svgY = clientY - rect.top;

    // Convert SVG -> panel (mm)
    const xMmRaw = (svgX - offsetX) / (scale || 1);
    const yMmRaw = (scaledHeight - (svgY - offsetY)) / (scale || 1);

    const snap = (v: number) => Math.round(v / snapStep) * snapStep;

    const xMm = clamp(snap(xMmRaw), 0, panelWidth);
    const yMm = clamp(snap(yMmRaw), 0, panelHeight);

    onUpdateHole(holeId, { x: xMm, y: yMm });
  };

  const stopDragging = () => setDraggingHoleId(null);

  const handlePointerMove = (e: any) => {
    if (!draggingHoleId) return;
    e.preventDefault?.();
    const snapStep = e.shiftKey ? 10 : 1;
    updateHoleFromPointer(e.clientX, e.clientY, draggingHoleId, snapStep);
  };
  return (
    <div className="border rounded-lg bg-muted/20 p-2">
      <Label className="text-xs text-muted-foreground mb-1 block">
        Preview (arraste o furo para mover; Shift = 10mm)
      </Label>
      <svg
        ref={svgRef}
        width={previewWidth}
        height={previewHeight}
        className="bg-background rounded border"
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
      >
        {/* Panel outline */}
        <rect
          x={offsetX}
          y={offsetY}
          width={scaledWidth}
          height={scaledHeight}
          fill="hsl(var(--muted))"
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />
        
        {/* Origin indicator (0,0) at bottom-left */}
        <circle
          cx={offsetX}
          cy={offsetY + scaledHeight}
          r={3}
          fill="hsl(var(--primary))"
        />
        <text
          x={offsetX + 5}
          y={offsetY + scaledHeight - 5}
          fontSize={8}
          fill="hsl(var(--primary))"
        >
          0,0
        </text>
        
        {/* Grid lines for reference */}
        {[0.25, 0.5, 0.75].map(ratio => (
          <g key={ratio}>
            <line
              x1={offsetX + scaledWidth * ratio}
              y1={offsetY}
              x2={offsetX + scaledWidth * ratio}
              y2={offsetY + scaledHeight}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              strokeDasharray="2,2"
            />
            <line
              x1={offsetX}
              y1={offsetY + scaledHeight * ratio}
              x2={offsetX + scaledWidth}
              y2={offsetY + scaledHeight * ratio}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              strokeDasharray="2,2"
            />
          </g>
        ))}
        
        {/* Cutouts */}
        {cutouts.map(cutout => {
          const isSelected = cutout.id === selectedCutoutId;
          return (
            <g key={cutout.id} onClick={() => onSelectCutout(cutout.id)} style={{ cursor: 'pointer' }}>
              <rect
                x={toSvgX(cutout.x)}
                y={toSvgY(cutout.y + cutout.height)}
                width={cutout.width * scale}
                height={cutout.height * scale}
                fill={isSelected ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--destructive) / 0.2)'}
                stroke={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </g>
          );
        })}
        
        {/* Holes */}
        {holes.map(hole => {
          const isSelected = hole.id === selectedHoleId;
          const isDragging = hole.id === draggingHoleId;
          const radius = (hole.diameter / 2) * scale;
          return (
            <g
              key={hole.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectHole(hole.id);
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelectHole(hole.id);
                setDraggingHoleId(hole.id);
              }}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              <circle
              {isSelected && (
                <>
                  {/* Reference lines for selected hole */}
                  <line
                    x1={offsetX}
                    y1={toSvgY(hole.y)}
                    x2={toSvgX(hole.x)}
                    y2={toSvgY(hole.y)}
                    stroke="hsl(var(--primary))"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  <line
                    x1={toSvgX(hole.x)}
                    y1={offsetY + scaledHeight}
                    x2={toSvgX(hole.x)}
                    y2={toSvgY(hole.y)}
                    stroke="hsl(var(--primary))"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div className="text-[10px] text-muted-foreground text-center mt-1">
        Escala: 1mm = {scale.toFixed(3)}px
      </div>
    </div>
  );
}

// Inline editable hole row
function HoleRow({
  hole,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onDuplicate,
  onRemove
}: {
  hole: Hole;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Hole>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [editValues, setEditValues] = useState({ x: hole.x, y: hole.y, diameter: hole.diameter });
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEdit = () => {
    setEditValues({ x: hole.x, y: hole.y, diameter: hole.diameter });
    setIsEditing(true);
    onSelect();
  };

  const handleConfirm = () => {
    onUpdate(editValues);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValues({ x: hole.x, y: hole.y, diameter: hole.diameter });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={`p-3 border rounded-lg ${isSelected ? 'border-primary bg-primary/5' : 'bg-background'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Circle className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Furo {index + 1}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <Label className="text-xs text-muted-foreground">X (mm)</Label>
            <Input
              type="number"
              value={editValues.x}
              onChange={e => setEditValues({ ...editValues, x: parseInt(e.target.value) || 0 })}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Y (mm)</Label>
            <Input
              type="number"
              value={editValues.y}
              onChange={e => setEditValues({ ...editValues, y: parseInt(e.target.value) || 0 })}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Ø (mm)</Label>
            <Input
              type="number"
              value={editValues.diameter}
              onChange={e => setEditValues({ ...editValues, diameter: parseInt(e.target.value) || 0 })}
              className="h-8"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleConfirm} className="flex-1">
            <Check className="w-3 h-3 mr-1" />
            Salvar
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} className="flex-1">
            <X className="w-3 h-3 mr-1" />
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'bg-background'}`}
      onClick={onSelect}
    >
      <Circle className="w-4 h-4 text-primary shrink-0" />
      <span className="flex-1 text-sm">
        Furo {index + 1}: X={hole.x}, Y={hole.y}, Ø={hole.diameter}mm
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleStartEdit(); }} title="Editar">
        <Pencil className="w-3 h-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} title="Duplicar">
        <Copy className="w-3 h-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remover">
        <Trash2 className="w-3 h-3 text-destructive" />
      </Button>
    </div>
  );
}

// Inline editable cutout row
function CutoutRow({
  cutout,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onDuplicate,
  onRemove
}: {
  cutout: Cutout;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Cutout>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [editValues, setEditValues] = useState({ x: cutout.x, y: cutout.y, width: cutout.width, height: cutout.height });
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEdit = () => {
    setEditValues({ x: cutout.x, y: cutout.y, width: cutout.width, height: cutout.height });
    setIsEditing(true);
    onSelect();
  };

  const handleConfirm = () => {
    onUpdate(editValues);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValues({ x: cutout.x, y: cutout.y, width: cutout.width, height: cutout.height });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={`p-3 border rounded-lg ${isSelected ? 'border-primary bg-primary/5' : 'bg-background'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Square className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Recorte {index + 1}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <Label className="text-xs text-muted-foreground">X (mm)</Label>
            <Input
              type="number"
              value={editValues.x}
              onChange={e => setEditValues({ ...editValues, x: parseInt(e.target.value) || 0 })}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Y (mm)</Label>
            <Input
              type="number"
              value={editValues.y}
              onChange={e => setEditValues({ ...editValues, y: parseInt(e.target.value) || 0 })}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Largura (mm)</Label>
            <Input
              type="number"
              value={editValues.width}
              onChange={e => setEditValues({ ...editValues, width: parseInt(e.target.value) || 0 })}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Altura (mm)</Label>
            <Input
              type="number"
              value={editValues.height}
              onChange={e => setEditValues({ ...editValues, height: parseInt(e.target.value) || 0 })}
              className="h-8"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleConfirm} className="flex-1">
            <Check className="w-3 h-3 mr-1" />
            Salvar
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} className="flex-1">
            <X className="w-3 h-3 mr-1" />
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'bg-background'}`}
      onClick={onSelect}
    >
      <Square className="w-4 h-4 text-primary shrink-0" />
      <span className="flex-1 text-sm">
        Recorte {index + 1}: X={cutout.x}, Y={cutout.y}, {cutout.width}x{cutout.height}mm
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleStartEdit(); }} title="Editar">
        <Pencil className="w-3 h-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} title="Duplicar">
        <Copy className="w-3 h-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remover">
        <Trash2 className="w-3 h-3 text-destructive" />
      </Button>
    </div>
  );
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
  const [selectedHoleId, setSelectedHoleId] = useState<string | null>(null);
  const [selectedCutoutId, setSelectedCutoutId] = useState<string | null>(null);

  const addHole = () => {
    if (newHole.x !== undefined && newHole.y !== undefined && newHole.diameter) {
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

  const updateHole = (id: string, updates: Partial<Hole>) => {
    onHolesChange(holes.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const duplicateHole = (id: string) => {
    const hole = holes.find(h => h.id === id);
    if (hole) {
      const newHole = {
        ...hole,
        id: crypto.randomUUID(),
        x: hole.x + 50, // Offset slightly
        y: hole.y + 50
      };
      onHolesChange([...holes, newHole]);
    }
  };

  const removeHole = (id: string) => {
    onHolesChange(holes.filter(h => h.id !== id));
    if (selectedHoleId === id) setSelectedHoleId(null);
  };

  const addCutout = () => {
    if (newCutout.x !== undefined && newCutout.y !== undefined && newCutout.width && newCutout.height) {
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

  const updateCutout = (id: string, updates: Partial<Cutout>) => {
    onCutoutsChange(cutouts.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const duplicateCutout = (id: string) => {
    const cutout = cutouts.find(c => c.id === id);
    if (cutout) {
      const newCutout = {
        ...cutout,
        id: crypto.randomUUID(),
        x: cutout.x + 50,
        y: cutout.y + 50
      };
      onCutoutsChange([...cutouts, newCutout]);
    }
  };

  const removeCutout = (id: string) => {
    onCutoutsChange(cutouts.filter(c => c.id !== id));
    if (selectedCutoutId === id) setSelectedCutoutId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Vidro {panelLetter} ({panelWidth} x {panelHeight} mm)</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-4">
          {/* Preview panel */}
          <div className="shrink-0">
            <PanelPreview
              panelWidth={panelWidth}
              panelHeight={panelHeight}
              holes={holes}
              cutouts={cutouts}
              selectedHoleId={selectedHoleId}
              selectedCutoutId={selectedCutoutId}
              onSelectHole={(id) => { setSelectedHoleId(id); setSelectedCutoutId(null); }}
              onSelectCutout={(id) => { setSelectedCutoutId(id); setSelectedHoleId(null); }}
              onUpdateHole={(id, updates) => {
                setSelectedHoleId(id);
                setSelectedCutoutId(null);
                updateHole(id, updates);
              }}
            />
          </div>
          
          {/* Editor tabs */}
          <div className="flex-1 min-w-0">
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
              
              <TabsContent value="holes" className="space-y-3 mt-4">
                {/* List of holes */}
                {holes.length > 0 && (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {holes.map((hole, index) => (
                      <HoleRow
                        key={hole.id}
                        hole={hole}
                        index={index}
                        isSelected={hole.id === selectedHoleId}
                        onSelect={() => { setSelectedHoleId(hole.id); setSelectedCutoutId(null); }}
                        onUpdate={(updates) => updateHole(hole.id, updates)}
                        onDuplicate={() => duplicateHole(hole.id)}
                        onRemove={() => removeHole(hole.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Add new hole */}
                <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar Novo Furo
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">X (mm)</Label>
                      <Input
                        type="number"
                        value={newHole.x || ''}
                        onChange={e => setNewHole({ ...newHole, x: parseInt(e.target.value) || 0 })}
                        placeholder="X"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Y (mm)</Label>
                      <Input
                        type="number"
                        value={newHole.y || ''}
                        onChange={e => setNewHole({ ...newHole, y: parseInt(e.target.value) || 0 })}
                        placeholder="Y"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Ø (mm)</Label>
                      <Input
                        type="number"
                        value={newHole.diameter || ''}
                        onChange={e => setNewHole({ ...newHole, diameter: parseInt(e.target.value) || 0 })}
                        placeholder="Ø"
                        className="h-8"
                      />
                    </div>
                  </div>
                  <Button onClick={addHole} size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="cutouts" className="space-y-3 mt-4">
                {/* List of cutouts */}
                {cutouts.length > 0 && (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {cutouts.map((cutout, index) => (
                      <CutoutRow
                        key={cutout.id}
                        cutout={cutout}
                        index={index}
                        isSelected={cutout.id === selectedCutoutId}
                        onSelect={() => { setSelectedCutoutId(cutout.id); setSelectedHoleId(null); }}
                        onUpdate={(updates) => updateCutout(cutout.id, updates)}
                        onDuplicate={() => duplicateCutout(cutout.id)}
                        onRemove={() => removeCutout(cutout.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Add new cutout */}
                <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar Novo Recorte
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">X (mm)</Label>
                      <Input
                        type="number"
                        value={newCutout.x || ''}
                        onChange={e => setNewCutout({ ...newCutout, x: parseInt(e.target.value) || 0 })}
                        placeholder="X"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Y (mm)</Label>
                      <Input
                        type="number"
                        value={newCutout.y || ''}
                        onChange={e => setNewCutout({ ...newCutout, y: parseInt(e.target.value) || 0 })}
                        placeholder="Y"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Largura (mm)</Label>
                      <Input
                        type="number"
                        value={newCutout.width || ''}
                        onChange={e => setNewCutout({ ...newCutout, width: parseInt(e.target.value) || 0 })}
                        placeholder="L"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Altura (mm)</Label>
                      <Input
                        type="number"
                        value={newCutout.height || ''}
                        onChange={e => setNewCutout({ ...newCutout, height: parseInt(e.target.value) || 0 })}
                        placeholder="A"
                        className="h-8"
                      />
                    </div>
                  </div>
                  <Button onClick={addCutout} size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
