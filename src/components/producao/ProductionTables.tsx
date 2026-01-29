import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, BarChart3, Layers, Ruler } from 'lucide-react';
import { ProfileCutsTable, type ProfileCutItem } from '@/components/plano-corte/ProfileCutsTable';
import { GlassCutsTable, type GlassCutItem } from '@/components/plano-corte/GlassCutsTable';
import { BarOptimizationView } from '@/components/plano-corte/BarOptimizationView';

interface ProductionTablesProps {
  profileCuts: ProfileCutItem[];
  glassCuts: GlassCutItem[];
  barOptimizationData: Array<{
    itemTemplateId: string;
    itemName: string;
    cutLength: number;
    quantity: number;
    barLengthMm: number;
  }>;
  showCheckboxes?: boolean;
  onToggleComplete?: (id: string, completed: boolean) => void;
  getStorageUrl: (path: string | null) => string | null;
}

export function ProductionTables({
  profileCuts,
  glassCuts,
  barOptimizationData,
  showCheckboxes = true,
  onToggleComplete,
  getStorageUrl
}: ProductionTablesProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'glass' | 'profiles'>('all');
  const [barOptOpen, setBarOptOpen] = useState(false);

  const hasProfiles = profileCuts.length > 0;
  const hasGlass = glassCuts.length > 0;

  if (!hasProfiles && !hasGlass) {
    return (
      <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
        Selecione um produto para visualizar as tabelas de corte
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs for filtering */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'glass' | 'profiles')}>
        <TabsList className="w-auto bg-muted/50">
          <TabsTrigger value="all" className="gap-2 text-xs">
            <Layers className="w-3.5 h-3.5" />
            Todos
          </TabsTrigger>
          {hasGlass && (
            <TabsTrigger value="glass" className="gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded bg-purple-500" />
              Vidros ({glassCuts.length})
            </TabsTrigger>
          )}
          {hasProfiles && (
            <TabsTrigger value="profiles" className="gap-2 text-xs">
              <Ruler className="w-3.5 h-3.5" />
              Perfis ({profileCuts.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {hasGlass && (
              <div>
                <GlassCutsTable 
                  glassCuts={glassCuts}
                  showCheckboxes={showCheckboxes}
                  onToggleComplete={onToggleComplete}
                />
              </div>
            )}
            {hasProfiles && (
              <div>
                <ProfileCutsTable 
                  cuts={profileCuts}
                  showCheckboxes={showCheckboxes}
                  onToggleComplete={onToggleComplete}
                  getStorageUrl={getStorageUrl}
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="glass" className="mt-4">
          <GlassCutsTable 
            glassCuts={glassCuts}
            showCheckboxes={showCheckboxes}
            onToggleComplete={onToggleComplete}
          />
        </TabsContent>

        <TabsContent value="profiles" className="mt-4">
          <ProfileCutsTable 
            cuts={profileCuts}
            showCheckboxes={showCheckboxes}
            onToggleComplete={onToggleComplete}
            getStorageUrl={getStorageUrl}
          />
        </TabsContent>
      </Tabs>

      {/* Bar Optimization Collapsible */}
      {barOptimizationData.length > 0 && (
        <Collapsible open={barOptOpen} onOpenChange={setBarOptOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between bg-muted/30 hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span>Otimização de Barras</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${barOptOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <BarOptimizationView cuts={barOptimizationData} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
