import { MainLayout } from "@/components/layout/MainLayout";
import { CuttingPlanCalculator } from "@/components/plano-corte/CuttingPlanCalculator";
import { Scissors } from "lucide-react";

export default function PlanoDeCorte() {
  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Scissors className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Plano de Corte</h1>
            <p className="text-sm text-muted-foreground">
              Simulador livre — gere planos de corte avulsos sem criar orçamento ou OS.
            </p>
          </div>
        </div>

        <CuttingPlanCalculator />
      </div>
    </MainLayout>
  );
}
