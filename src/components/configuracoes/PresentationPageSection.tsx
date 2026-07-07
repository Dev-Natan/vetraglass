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
    label: "Tradicional / Formal",
    text:
      "Prezado(a) cliente, é com grande satisfação que apresentamos nossa proposta comercial para o fornecimento e instalação de vidros e esquadrias. Nossa empresa preza pela máxima segurança, cumprimento rigoroso de prazos e alinhamento com as normas técnicas da ABNT. Abaixo, detalhamos as especificações técnicas e valores para o seu projeto.",
  },
  moderno: {
    label: "Moderno / Residencial",
    text:
      "Olá! Agradecemos a oportunidade de fazer parte do seu projeto. Aqui na nossa vidraçaria, transformamos seu ambiente com o que há de melhor em vidros temperados, laminados e acabamentos de alto padrão. Preparamos um orçamento detalhado com as melhores opções para sua casa. Dê uma olhada nos detalhes abaixo!",
  },
  premium: {
    label: "Premium / Alto Padrão",
    text:
      "Sua obra merece sofisticação e durabilidade. Apresentamos nossa proposta comercial utilizando exclusivamente materiais de primeira linha e mão de obra altamente qualificada. Mais do que vidros, entregamos conforto térmico, acústico e valorização para o seu imóvel. Confira a seguir os detalhes do seu investimento.",
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
