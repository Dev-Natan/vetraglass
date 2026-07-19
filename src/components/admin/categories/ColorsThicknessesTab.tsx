import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Palette, Layers, Square } from "lucide-react";
import { AluminumColorsEditor } from "./detail/AluminumColorsEditor";
import { GlassColorsEditor } from "./detail/GlassColorsEditor";
import { GlassThicknessesEditor } from "./detail/GlassThicknessesEditor";

export function ColorsThicknessesTab() {
  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Gerencie aqui todas as paletas mestres do sistema. As cores cadastradas ficam disponíveis
          para uso nos itens (perfis, acessórios) e vidros de todas as empresas.
        </AlertDescription>
      </Alert>

      <Accordion type="multiple" defaultValue={["perfis", "acessorios", "vidros", "espessuras"]} className="space-y-3">
        <AccordionItem value="perfis" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Palette className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Cores de Perfis (Alumínio)</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Paleta usada em perfis de alumínio
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <AluminumColorsEditor />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="acessorios" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Palette className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Cores de Acessórios</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Compartilha a mesma paleta de perfis (alumínio) — edite acima para refletir aqui
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Acessórios usam a mesma paleta cadastrada em <strong>Cores de Perfis (Alumínio)</strong>.
                Qualquer nova cor adicionada acima ficará automaticamente disponível para acessórios.
              </AlertDescription>
            </Alert>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="vidros" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Square className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Cores de Vidros</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Paleta de cores disponíveis para vidros
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <GlassColorsEditor />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="espessuras" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Layers className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Espessuras de Vidro</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Catálogo global de espessuras (mm)
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <GlassThicknessesEditor />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
