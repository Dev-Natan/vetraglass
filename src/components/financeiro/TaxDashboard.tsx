import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  PieChart,
  Receipt,
  TrendingUp,
  Calculator,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaxDashboardProps {
  sales: {
    id: string;
    total_amount: number;
    payment_status: string;
    created_at: string;
  }[];
  taxConfig: {
    regime_tributario: string;
    faixa_simples: number;
    aliquota_efetiva: number;
    anexo_simples: string;
    receita_bruta_12_meses: number;
  } | null;
  saleTaxes: {
    sale_id: string;
    valor_simples: number;
    valor_ibs: number;
    valor_cbs: number;
    valor_total_impostos: number;
  }[];
}

const anexoLabels: Record<string, string> = {
  anexo_i: 'Anexo I - Comércio',
  anexo_ii: 'Anexo II - Indústria',
  anexo_iii: 'Anexo III - Serviços',
  anexo_iv: 'Anexo IV - Serviços',
  anexo_v: 'Anexo V - Serviços',
};

const faixasSimples = [
  { faixa: 1, limite: 180000, aliquota: 4.0 },
  { faixa: 2, limite: 360000, aliquota: 7.3 },
  { faixa: 3, limite: 720000, aliquota: 9.5 },
  { faixa: 4, limite: 1800000, aliquota: 10.7 },
  { faixa: 5, limite: 3600000, aliquota: 14.3 },
  { faixa: 6, limite: 4800000, aliquota: 19.0 },
];

export function TaxDashboard({ sales, taxConfig, saleTaxes }: TaxDashboardProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const taxSummary = useMemo(() => {
    const activeSales = sales.filter(s => s.payment_status !== 'cancelled');
    const totalFaturamento = activeSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    
    // Calcula impostos baseado no Simples Nacional
    const aliquota = taxConfig?.aliquota_efetiva || 4.0;
    const impostoCalculado = totalFaturamento * (aliquota / 100);
    
    // Valores do banco se existirem
    const totalImpostosRegistrados = saleTaxes.reduce((sum, t) => sum + (t.valor_total_impostos || 0), 0);
    
    // Usa o valor registrado se disponível, senão calcula
    const totalImpostos = totalImpostosRegistrados > 0 ? totalImpostosRegistrados : impostoCalculado;
    
    const receitaLiquida = totalFaturamento - totalImpostos;
    
    return {
      totalFaturamento,
      totalImpostos,
      receitaLiquida,
      aliquotaEfetiva: aliquota,
      countSales: activeSales.length,
    };
  }, [sales, taxConfig, saleTaxes]);

  const faixaAtual = taxConfig?.faixa_simples || 1;
  const faixaInfo = faixasSimples.find(f => f.faixa === faixaAtual) || faixasSimples[0];
  const proximaFaixa = faixasSimples.find(f => f.faixa === faixaAtual + 1);
  const receitaBruta = taxConfig?.receita_bruta_12_meses || 0;
  const margemProximaFaixa = proximaFaixa ? proximaFaixa.limite - receitaBruta : 0;

  return (
    <div className="space-y-6">
      {/* Regime Tributário Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Receipt className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Simples Nacional</h3>
                <p className="text-sm text-muted-foreground">
                  {anexoLabels[taxConfig?.anexo_simples || 'anexo_iii']}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-sm">
                Faixa {faixaAtual} de 6
              </Badge>
              <Badge variant="outline" className="text-sm">
                Alíquota: {taxConfig?.aliquota_efetiva?.toFixed(2) || '4.00'}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Faturamento Bruto</span>
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(taxSummary.totalFaturamento)}</p>
            <p className="text-xs text-muted-foreground mt-1">{taxSummary.countSales} vendas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Impostos (Simples)</span>
              <Calculator className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(taxSummary.totalImpostos)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {taxSummary.aliquotaEfetiva.toFixed(2)}% efetivo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Receita Líquida</span>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(taxSummary.receitaLiquida)}</p>
            <p className="text-xs text-muted-foreground mt-1">Após impostos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Receita 12 meses</span>
              <BarChart3 className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(receitaBruta)}</p>
            <p className="text-xs text-muted-foreground mt-1">Limite: {formatCurrency(faixaInfo.limite)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Faixa Progress */}
      {proximaFaixa && margemProximaFaixa > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              Proximidade da Próxima Faixa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Faixa {faixaAtual} ({faixaInfo.aliquota}%)</span>
                <span className="text-muted-foreground">Faixa {proximaFaixa.faixa} ({proximaFaixa.aliquota}%)</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-yellow-500 transition-all"
                  style={{ width: `${Math.min((receitaBruta / faixaInfo.limite) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{formatCurrency(receitaBruta)}</span>
                <span className="text-muted-foreground">
                  Margem: {formatCurrency(margemProximaFaixa)}
                </span>
              </div>
              {margemProximaFaixa < 50000 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-400">
                    Atenção: Você está próximo de mudar para a faixa {proximaFaixa.faixa}, 
                    com alíquota de {proximaFaixa.aliquota}%
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tax Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Composição dos Impostos (Simples Nacional)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">IRPJ/CSLL</p>
              <p className="font-semibold">{formatCurrency(taxSummary.totalImpostos * 0.20)}</p>
              <p className="text-xs text-muted-foreground">~20% do DAS</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">COFINS/PIS</p>
              <p className="font-semibold">{formatCurrency(taxSummary.totalImpostos * 0.35)}</p>
              <p className="text-xs text-muted-foreground">~35% do DAS</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">CPP</p>
              <p className="font-semibold">{formatCurrency(taxSummary.totalImpostos * 0.30)}</p>
              <p className="text-xs text-muted-foreground">~30% do DAS</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">ICMS/ISS</p>
              <p className="font-semibold">{formatCurrency(taxSummary.totalImpostos * 0.15)}</p>
              <p className="text-xs text-muted-foreground">~15% do DAS</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            * Valores aproximados baseados na distribuição típica do Anexo III
          </p>
        </CardContent>
      </Card>

      {/* Próximos Vencimentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Próximos Vencimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">DAS - Simples Nacional</p>
                  <p className="text-xs text-muted-foreground">Referente ao período atual</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">{formatCurrency(taxSummary.totalImpostos)}</p>
                <p className="text-xs text-muted-foreground">
                  Vence em {format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 20), 'dd/MM', { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
