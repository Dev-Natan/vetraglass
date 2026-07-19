import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { AluminumColorsEditor } from "./AluminumColorsEditor";

export function AcessoriosDetail() {
  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Acessórios compartilham a mesma paleta de cores dos perfis de alumínio. Cores
          adicionadas aqui ficam disponíveis também na tela de Perfis.
        </AlertDescription>
      </Alert>
      <AluminumColorsEditor />
    </div>
  );
}
