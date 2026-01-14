import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Receipt, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FiscalFieldsData {
  ncm: string;
  cfop_venda: string;
  cfop_venda_interestadual: string;
  cest: string;
  origem: string;
  codigo_servico: string;
  aliquota_iss: string;
}

interface FiscalFieldsCardProps {
  data: FiscalFieldsData;
  onChange: (data: FiscalFieldsData) => void;
  type?: 'produto' | 'item';
  itemType?: 'glass' | 'profile' | 'accessory' | 'service';
}

const origemOptions = [
  { value: '0', label: '0 - Nacional' },
  { value: '1', label: '1 - Estrangeira (importação direta)' },
  { value: '2', label: '2 - Estrangeira (adquirida no mercado interno)' },
  { value: '3', label: '3 - Nacional (conteúdo de importação > 40%)' },
  { value: '4', label: '4 - Nacional (produção conforme Dec.-Lei nº 288/67)' },
  { value: '5', label: '5 - Nacional (conteúdo de importação ≤ 40%)' },
  { value: '6', label: '6 - Estrangeira (importação direta, sem similar)' },
  { value: '7', label: '7 - Estrangeira (adquirida, sem similar nacional)' },
  { value: '8', label: '8 - Nacional (conteúdo de importação > 70%)' },
];

const cfopVendaOptions = [
  { value: '5101', label: '5101 - Venda prod. estabelecimento' },
  { value: '5102', label: '5102 - Venda merc. adquirida' },
  { value: '5103', label: '5103 - Venda prod. por conta e ordem' },
  { value: '5104', label: '5104 - Venda merc. por conta e ordem' },
  { value: '5405', label: '5405 - Venda merc. ST (varejo)' },
  { value: '5551', label: '5551 - Venda ativo imobilizado' },
  { value: '5910', label: '5910 - Bonificação/doação' },
];

const cfopInterestadualOptions = [
  { value: '6101', label: '6101 - Venda prod. estabelecimento' },
  { value: '6102', label: '6102 - Venda merc. adquirida' },
  { value: '6103', label: '6103 - Venda prod. por conta e ordem' },
  { value: '6104', label: '6104 - Venda merc. por conta e ordem' },
  { value: '6108', label: '6108 - Venda consumidor final não contribuinte' },
  { value: '6403', label: '6403 - Venda merc. ST (contribuinte)' },
];

export function FiscalFieldsCard({ data, onChange, type = 'produto', itemType }: FiscalFieldsCardProps) {
  const isService = itemType === 'service';
  
  const handleChange = (field: keyof FiscalFieldsData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const LabelWithTooltip = ({ label, tooltip }: { label: string; tooltip: string }) => (
    <div className="flex items-center gap-1">
      <Label className="text-xs">{label}</Label>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Dados Fiscais</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            Modo Fiscal
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Preencha os campos fiscais para emissão de notas fiscais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isService ? (
          <>
            {/* NCM */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <LabelWithTooltip 
                  label="NCM" 
                  tooltip="Nomenclatura Comum do Mercosul - código de 8 dígitos que classifica a mercadoria"
                />
                <Input
                  value={data.ncm}
                  onChange={(e) => handleChange('ncm', e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="00000000"
                  maxLength={8}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip 
                  label="CEST" 
                  tooltip="Código Especificador da Substituição Tributária - 7 dígitos (opcional)"
                />
                <Input
                  value={data.cest}
                  onChange={(e) => handleChange('cest', e.target.value.replace(/\D/g, '').slice(0, 7))}
                  placeholder="0000000"
                  maxLength={7}
                  className="font-mono"
                />
              </div>
            </div>

            {/* CFOP */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <LabelWithTooltip 
                  label="CFOP Venda (UF)" 
                  tooltip="Código Fiscal de Operações e Prestações para vendas dentro do estado"
                />
                <Select value={data.cfop_venda} onValueChange={(v) => handleChange('cfop_venda', v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {cfopVendaOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <LabelWithTooltip 
                  label="CFOP Interestadual" 
                  tooltip="CFOP para vendas para outros estados"
                />
                <Select value={data.cfop_venda_interestadual} onValueChange={(v) => handleChange('cfop_venda_interestadual', v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {cfopInterestadualOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Origem */}
            <div className="space-y-1">
              <LabelWithTooltip 
                label="Origem da Mercadoria" 
                tooltip="Indica a procedência do produto (nacional ou estrangeira)"
              />
              <Select value={data.origem} onValueChange={(v) => handleChange('origem', v)}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {origemOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <>
            {/* Campos para serviços */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <LabelWithTooltip 
                  label="Código do Serviço" 
                  tooltip="Código do serviço conforme tabela do município (Lei Complementar 116)"
                />
                <Input
                  value={data.codigo_servico}
                  onChange={(e) => handleChange('codigo_servico', e.target.value)}
                  placeholder="Ex: 14.01"
                />
              </div>
              <div className="space-y-1">
                <LabelWithTooltip 
                  label="Alíquota ISS (%)" 
                  tooltip="Percentual do Imposto Sobre Serviços aplicável"
                />
                <Input
                  type="number"
                  value={data.aliquota_iss}
                  onChange={(e) => handleChange('aliquota_iss', e.target.value)}
                  placeholder="5.00"
                  min={0}
                  max={100}
                  step={0.01}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export type { FiscalFieldsData };
