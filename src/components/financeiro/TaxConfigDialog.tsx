import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Info } from 'lucide-react';

interface TaxConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: {
    id?: string;
    regime_tributario: string;
    faixa_simples: number;
    aliquota_efetiva: number;
    anexo_simples: string;
    receita_bruta_12_meses: number;
  } | null;
  onSave: (config: {
    regime_tributario: string;
    faixa_simples: number;
    aliquota_efetiva: number;
    anexo_simples: string;
    receita_bruta_12_meses: number;
  }) => void;
  isLoading?: boolean;
}

const anexos = [
  { value: 'anexo_i', label: 'Anexo I - Comércio' },
  { value: 'anexo_ii', label: 'Anexo II - Indústria' },
  { value: 'anexo_iii', label: 'Anexo III - Serviços (locação, etc.)' },
  { value: 'anexo_iv', label: 'Anexo IV - Serviços (construção, etc.)' },
  { value: 'anexo_v', label: 'Anexo V - Serviços (engenharia, etc.)' },
];

const faixas = [
  { faixa: 1, limite: 'Até R$ 180.000,00', aliquotas: { i: 4.0, ii: 4.5, iii: 6.0, iv: 4.5, v: 15.5 } },
  { faixa: 2, limite: 'R$ 180.000,01 a R$ 360.000,00', aliquotas: { i: 7.3, ii: 7.8, iii: 11.2, iv: 9.0, v: 18.0 } },
  { faixa: 3, limite: 'R$ 360.000,01 a R$ 720.000,00', aliquotas: { i: 9.5, ii: 10.0, iii: 13.5, iv: 10.2, v: 19.5 } },
  { faixa: 4, limite: 'R$ 720.000,01 a R$ 1.800.000,00', aliquotas: { i: 10.7, ii: 11.2, iii: 16.0, iv: 14.0, v: 20.5 } },
  { faixa: 5, limite: 'R$ 1.800.000,01 a R$ 3.600.000,00', aliquotas: { i: 14.3, ii: 14.7, iii: 21.0, iv: 22.0, v: 23.0 } },
  { faixa: 6, limite: 'R$ 3.600.000,01 a R$ 4.800.000,00', aliquotas: { i: 19.0, ii: 30.0, iii: 33.0, iv: 33.0, v: 30.5 } },
];

export function TaxConfigDialog({ open, onOpenChange, config, onSave, isLoading }: TaxConfigDialogProps) {
  const [anexo, setAnexo] = useState(config?.anexo_simples || 'anexo_iii');
  const [faixa, setFaixa] = useState(config?.faixa_simples || 1);
  const [receitaBruta, setReceitaBruta] = useState(config?.receita_bruta_12_meses?.toString() || '0');
  const [aliquotaManual, setAliquotaManual] = useState<string>('');

  useEffect(() => {
    if (config) {
      setAnexo(config.anexo_simples);
      setFaixa(config.faixa_simples);
      setReceitaBruta(config.receita_bruta_12_meses?.toString() || '0');
    }
  }, [config]);

  const getAliquotaForAnexo = (anexoValue: string, faixaNum: number): number => {
    const faixaInfo = faixas.find(f => f.faixa === faixaNum);
    if (!faixaInfo) return 4.0;
    
    const anexoKey = anexoValue.replace('anexo_', '') as keyof typeof faixaInfo.aliquotas;
    return faixaInfo.aliquotas[anexoKey] || 4.0;
  };

  const aliquotaCalculada = getAliquotaForAnexo(anexo, faixa);
  const aliquotaFinal = aliquotaManual ? parseFloat(aliquotaManual) : aliquotaCalculada;

  const handleSave = () => {
    onSave({
      regime_tributario: 'simples_nacional',
      faixa_simples: faixa,
      aliquota_efetiva: aliquotaFinal,
      anexo_simples: anexo,
      receita_bruta_12_meses: parseFloat(receitaBruta) || 0,
    });
  };

  const formatCurrencyInput = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const amount = parseInt(numbers) || 0;
    return amount.toLocaleString('pt-BR');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuração Tributária
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Regime */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-sm">Regime Tributário</span>
            </div>
            <p className="text-2xl font-bold text-primary">Simples Nacional</p>
            <p className="text-xs text-muted-foreground mt-1">
              Sistema de tributação simplificado para micro e pequenas empresas
            </p>
          </div>

          {/* Anexo */}
          <div className="space-y-2">
            <Label>Anexo do Simples Nacional</Label>
            <Select value={anexo} onValueChange={setAnexo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anexos.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Vidraçarias geralmente se enquadram no Anexo III (serviços) ou Anexo II (indústria)
            </p>
          </div>

          {/* Receita Bruta */}
          <div className="space-y-2">
            <Label>Receita Bruta dos Últimos 12 Meses</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input
                value={formatCurrencyInput(receitaBruta)}
                onChange={(e) => setReceitaBruta(e.target.value.replace(/\D/g, ''))}
                className="pl-10"
                placeholder="0"
              />
            </div>
          </div>

          {/* Faixa */}
          <div className="space-y-2">
            <Label>Faixa de Faturamento</Label>
            <Select value={faixa.toString()} onValueChange={(v) => setFaixa(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {faixas.map((f) => (
                  <SelectItem key={f.faixa} value={f.faixa.toString()}>
                    Faixa {f.faixa} - {f.limite}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Alíquota */}
          <div className="space-y-2">
            <Label>Alíquota Efetiva (%)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={aliquotaManual || aliquotaCalculada.toFixed(2)}
                onChange={(e) => setAliquotaManual(e.target.value)}
                placeholder={aliquotaCalculada.toFixed(2)}
              />
              <Button 
                variant="outline" 
                onClick={() => setAliquotaManual('')}
                disabled={!aliquotaManual}
              >
                Calcular
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Alíquota sugerida para {anexos.find(a => a.value === anexo)?.label} na Faixa {faixa}: {aliquotaCalculada.toFixed(2)}%
            </p>
          </div>

          {/* Summary */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm font-medium mb-2">Resumo da Configuração</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Anexo:</span>
              <span className="font-medium">{anexo.replace('anexo_', 'Anexo ').toUpperCase()}</span>
              <span className="text-muted-foreground">Faixa:</span>
              <span className="font-medium">{faixa}</span>
              <span className="text-muted-foreground">Alíquota:</span>
              <span className="font-medium text-primary">{aliquotaFinal.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
