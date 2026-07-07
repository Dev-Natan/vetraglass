import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Loader2, Save } from "lucide-react";

export const PRESENTATION_TEMPLATES: Record<string, { label: string; text: string }> = {
  tradicional: {
    label: "Tradicional / Corporativo",
    text:
      "É com distinta satisfação que apresentamos a proposta comercial elaborada exclusivamente para o seu projeto. Cada especificação a seguir foi desenvolvida por nossa equipe técnica com rigoroso cumprimento das normas ABNT NBR 7199 e 14.207, assegurando desempenho estrutural, segurança e durabilidade. Trabalhamos com fornecedores certificados e processos auditados, garantindo previsibilidade de prazos, transparência de valores e a excelência que sua obra merece. Colocamo-nos à inteira disposição para os esclarecimentos que julgar necessários.",
  },
  moderno: {
    label: "Moderno / Assinatura",
    text:
      "Obrigado por nos convidar a fazer parte do seu projeto. Preparamos esta proposta com a mesma atenção que dedicamos a cada detalhe do nosso trabalho — do desenho ao acabamento final. Utilizamos vidros de alta performance, perfis premium e ferragens de engenharia europeia, combinados a uma execução impecável em obra. Mais do que fornecer produtos, entregamos ambientes com identidade, conforto e valorização real do imóvel. Convidamos você a percorrer as próximas páginas e conhecer, em detalhe, a solução desenhada especialmente para o seu espaço.",
  },
  premium: {
    label: "Premium / Alto Padrão",
    text:
      "Existe um limite tênue entre um bom projeto e um projeto memorável — e é exatamente nele que nossa empresa opera. Esta proposta reúne materiais de origem certificada, engenharia de precisão milimétrica e uma equipe de instalação treinada para entregar acabamentos dignos de arquitetura autoral. Cada vidro, cada perfil e cada componente foi selecionado para oferecer performance térmica, acústica e estética por décadas. Assumimos o compromisso integral com o resultado: da primeira medição à assinatura da entrega técnica. Seja bem-vindo a um novo padrão em vidraçaria.",
  },
};


interface Props {
  companyId?: string;
  enabled?: boolean;
  text?: string | null;
}

export function PresentationPageSection({ companyId, enabled, text }: Props) {
  const qc = useQueryClient();
  const [isEnabled, setIsEnabled] = useState<boolean>(!!enabled);
  const [presentationText, setPresentationText] = useState<string>(text ?? "");
  const [templateKey, setTemplateKey] = useState<string>("");

  useEffect(() => {
    setIsEnabled(!!enabled);
    const currentText = text ?? "";
    setPresentationText(currentText);
    const match = Object.entries(PRESENTATION_TEMPLATES).find(
      ([, tpl]) => tpl.text.trim() === currentText.trim()
    );
    setTemplateKey(match ? match[0] : "");
  }, [enabled, text]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não encontrada");
      const { error } = await supabase
        .from("companies")
        .update({
          enable_presentation_page: isEnabled,
          default_presentation_text: presentationText || null,
        } as any)
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-config"] });
      toast.success("Configurações de apresentação salvas!");
    },
    onError: (e: any) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  const handleTemplateChange = (key: string) => {
    setTemplateKey(key);
    const tpl = PRESENTATION_TEMPLATES[key];
    if (tpl) setPresentationText(tpl.text);
  };

  return (
    <div className="glass-card rounded-2xl p-6 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-semibold text-foreground">
            Apresentação do Orçamento
          </h2>
          <p className="text-sm text-muted-foreground">
            Adicione uma capa institucional antes dos valores no PDF do orçamento
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="enable-presentation" className="text-base">
              Ativar página de apresentação
            </Label>
            <p className="text-sm text-muted-foreground">
              Quando ativa, uma capa é adicionada como primeira página do orçamento.
            </p>
          </div>
          <Switch
            id="enable-presentation"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label>Modelos de Texto</Label>
          <Select value={templateKey} onValueChange={handleTemplateChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um modelo para preencher automaticamente" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRESENTATION_TEMPLATES).map(([key, tpl]) => (
                <SelectItem key={key} value={key}>
                  {tpl.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Escolha um modelo e edite livremente o texto abaixo.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="presentation-text">Texto de apresentação</Label>
          <Textarea
            id="presentation-text"
            value={presentationText}
            onChange={(e) => setPresentationText(e.target.value)}
            placeholder="Escreva ou selecione um modelo acima..."
            rows={8}
            className="resize-y"
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !companyId}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </div>
  );
}
