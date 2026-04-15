import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, Info, CheckCircle2, XCircle, Loader2, Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

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

interface NCMValidationResult {
  valid: boolean;
  ncm: string;
  description?: string;
  category?: string;
  source: 'local' | 'api';
  message: string;
}

interface NCMSuggestion {
  ncm: string;
  description: string;
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
  const [ncmValidation, setNcmValidation] = useState<NCMValidationResult | null>(null);
  const [ncmLoading, setNcmLoading] = useState(false);
  const [ncmSuggestions, setNcmSuggestions] = useState<NCMSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const debouncedNCM = useDebounce(data.ncm, 500);
  
  const validateNCM = useCallback(async (ncm: string) => {
    if (!ncm || ncm.length < 8) {
      setNcmValidation(null);
      return;
    }
    
    setNcmLoading(true);
    try {
      const { data: responseData, error } = await supabase.functions.invoke('validate-ncm', {
        body: { ncm, itemType }
      });
      
      if (error) throw error;
      
      if (responseData?.success && responseData.result) {
        setNcmValidation(responseData.result);
        if (responseData.suggestions) {
          setNcmSuggestions(responseData.suggestions);
        }
      }
    } catch (error) {
      console.error('Error validating NCM:', error);
      setNcmValidation({
        valid: false,
        ncm,
        source: 'local',
        message: 'Erro ao validar NCM'
      });
    } finally {
      setNcmLoading(false);
    }
  }, [itemType]);
  
  const fetchSuggestions = useCallback(async () => {
    try {
      const { data: responseData, error } = await supabase.functions.invoke('validate-ncm', {
        body: { getSuggestions: true, itemType }
      });
      
      if (error) throw error;
      
      if (responseData?.success && responseData.suggestions) {
        setNcmSuggestions(responseData.suggestions);
      }
    } catch (error) {
      console.error('Error fetching NCM suggestions:', error);
    }
  }, [itemType]);
  
  useEffect(() => {
    if (debouncedNCM && debouncedNCM.length === 8) {
      validateNCM(debouncedNCM);
    } else {
      setNcmValidation(null);
    }
  }, [debouncedNCM, validateNCM]);
  
  useEffect(() => {
    if (!isService) {
      fetchSuggestions();
    }
  }, [isService, fetchSuggestions]);
  
  const handleChange = (field: keyof FiscalFieldsData, value: string) => {
    onChange({ ...data, [field]: value });
  };
  
  const selectSuggestion = (ncm: string) => {
    handleChange('ncm', ncm);
    setShowSuggestions(false);
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
  
  const NCMValidationBadge = () => {
    if (ncmLoading) {
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Validando...
        </Badge>
      );
    }
    
    if (!ncmValidation) return null;
    
    if (ncmValidation.valid) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs gap-1 bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3" />
                Válido
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div className="space-y-1">
                <p className="text-xs font-medium">{ncmValidation.message}</p>
                {ncmValidation.description && (
                  <p className="text-xs text-muted-foreground">{ncmValidation.description}</p>
                )}
                {ncmValidation.category && (
                  <Badge variant="secondary" className="text-xs mt-1">{ncmValidation.category}</Badge>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs gap-1 bg-red-50 text-red-700 border-red-200">
              <XCircle className="h-3 w-3" />
              Inválido
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <p className="text-xs">{ncmValidation.message}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

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
                <div className="flex items-center justify-between">
                  <LabelWithTooltip 
                    label="NCM" 
                    tooltip="Nomenclatura Comum do Mercosul - código de 8 dígitos que classifica a mercadoria"
                  />
                  <div className="flex items-center gap-1">
                    <NCMValidationBadge />
                    <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0"
                          type="button"
                        >
                          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-2" align="start">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            NCMs comuns para {itemType === 'glass' ? 'vidros' : itemType === 'profile' ? 'perfis' : itemType === 'accessory' ? 'acessórios' : 'o segmento'}:
                          </p>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {ncmSuggestions.map((suggestion) => (
                              <Button
                                key={suggestion.ncm}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-left h-auto py-2 px-2"
                                onClick={() => selectSuggestion(suggestion.ncm)}
                                type="button"
                              >
                                <div className="flex flex-col items-start">
                                  <span className="font-mono text-xs font-medium">{suggestion.ncm}</span>
                                  <span className="text-xs text-muted-foreground line-clamp-1">{suggestion.description}</span>
                                </div>
                              </Button>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Input
                  value={data.ncm}
                  onChange={(e) => handleChange('ncm', e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="00000000"
                  maxLength={8}
                  className={`font-mono ${ncmValidation?.valid === false ? 'border-red-300 focus-visible:ring-red-300' : ncmValidation?.valid ? 'border-green-300 focus-visible:ring-green-300' : ''}`}
                />
                {ncmValidation?.valid && ncmValidation.description && (
                  <p className="text-xs text-muted-foreground truncate" title={ncmValidation.description}>
                    {ncmValidation.description}
                  </p>
                )}
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
