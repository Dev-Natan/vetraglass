import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeQuotePricingError,
  parseAppliedQuotePrice,
  syncAppliedQuotePrice,
  readCompositionSuggestion,
  formatAppliedQuotePriceInput,
  getCompositionSuggestionNotice,
  calculateQuoteProductPrice,
  commercialUnitLabel,
  isCommercialPricingWarning,
} from './quotePricing.ts';

test('P02: preço aplicado inicialmente acompanha a sugestão', () => {
  assert.equal(syncAppliedQuotePrice('', false, 1300), '1.300,00');
});

test('P03/S06: preço manual sobrevive a uma nova sugestão', () => {
  assert.equal(syncAppliedQuotePrice('1450', true, 1200), '1450');
});

test('P05/P06/P09: ausência de sugestão aceita preço manual válido', () => {
  assert.equal(syncAppliedQuotePrice('', false, null), '');
  assert.equal(parseAppliedQuotePrice('1200,50'), 1200.5);
});

test('preço aplicado inválido é rejeitado', () => {
  assert.equal(parseAppliedQuotePrice(''), null);
  assert.equal(parseAppliedQuotePrice('0'), null);
  assert.equal(parseAppliedQuotePrice('-1'), null);
  assert.equal(parseAppliedQuotePrice('abc'), null);
});

test('P08/P10: erro de componente não expõe JSON bruto', () => {
  const issue = describeQuotePricingError({
    message: 'MISSING_PRICE_VARIANT',
    details: 'TRILHO INFERIOR 8MM | atributos={"color":"PRETO"}',
  });
  assert.equal(issue.message, 'Um componente ainda não possui preço configurado.');
  assert.equal(issue.detail, 'TRILHO INFERIOR 8MM — Preto');
  assert.equal(issue.detail?.includes('{'), false);
});

test('erro legado usa mensagem comercial', () => {
  const issue = describeQuotePricingError({ message: 'PRICE_NOT_CONFIGURED' });
  assert.equal(issue.message, 'Esta configuração ainda não possui preço automático.');
});

test('P01/P06/P07/P09/P21: estados preservam preço unitário conhecido e ausência como null', () => {
  assert.equal(readCompositionSuggestion({ suggestion_status: 'COMPLETE', suggested_unit_price: 590, totals: { sale_price: 850 } }).status, 'COMPLETE');
  assert.equal(readCompositionSuggestion({ suggestion_status: 'PARTIAL', totals: { suggested_unit_price: 590, sale_price: 850 } }).price, 590);
  assert.equal(readCompositionSuggestion({ suggestion_status: 'PARTIAL', totals: { suggested_unit_price: 590, sale_price: 850 } }).status, 'PARTIAL');
  assert.equal(readCompositionSuggestion({ suggestion_status: 'UNAVAILABLE', totals: { sale_price: null } }).price, null);
  assert.equal(readCompositionSuggestion().price, null);
  assert.equal(readCompositionSuggestion({ suggestion_status: 'COMPLETE', suggested_unit_price: NaN, totals: { sale_price: 850 } }).price, null);
});

test('P04/P05: recálculo acompanha sugestão somente antes do override', () => {
  assert.equal(syncAppliedQuotePrice('850,00', false, 1000), '1.000,00');
  assert.equal(syncAppliedQuotePrice('900.00', true, 1000), '900.00');
  assert.equal(syncAppliedQuotePrice('900.00', true, null), '900.00');
});

test('P08/P10: sugestão parcial ou indisponível não impede preço aplicado válido', () => {
  for (const status of ['PARTIAL', 'UNAVAILABLE'] as const) {
    const suggestion = readCompositionSuggestion({
      suggestion_status: status,
      suggested_unit_price: status === 'PARTIAL' ? 590 : null,
      totals: { sale_price: status === 'PARTIAL' ? 850 : null },
    });
    assert.equal(parseAppliedQuotePrice(syncAppliedQuotePrice('975', true, suggestion.price)), 975);
  }
});

test('preço legado sem status não é anunciado como sugestão completa', () => {
  assert.equal(readCompositionSuggestion({ totals: { sale_price: 1300 } }).status, 'UNAVAILABLE');
  assert.equal(readCompositionSuggestion({ totals: { sale_price: 1300 } }).price, null);
});

test('PUNIT01/PUNIT02: M2 usa preço por área e quantidade', () => {
  assert.deepEqual(
    calculateQuoteProductPrice({
      commercialUnit: 'M2',
      appliedUnitPrice: 600,
      areaPerItem: 1.44,
      quantity: 1,
    }),
    { measurePerItem: 1.44, commercialMeasure: 1.44, itemUnitPrice: 864, productTotal: 864 },
  );
  assert.equal(calculateQuoteProductPrice({
    commercialUnit: 'M2',
    appliedUnitPrice: 600,
    areaPerItem: 1.44,
    quantity: 2,
  }).productTotal, 1728);
});

test('PUNIT04/PUNIT05: override permanece unitário quando a área muda', () => {
  assert.equal(syncAppliedQuotePrice('600,00', true, 520), '600,00');
  assert.equal(calculateQuoteProductPrice({
    commercialUnit: 'M2',
    appliedUnitPrice: 600,
    areaPerItem: 2,
    quantity: 1,
  }).productTotal, 1200);
});

test('PUNIT07/PUNIT08: UNIT não usa área e null não vira preço', () => {
  assert.equal(calculateQuoteProductPrice({
    commercialUnit: 'UNIT',
    appliedUnitPrice: 600,
    areaPerItem: 9,
    quantity: 2,
  }).productTotal, 1200);
  assert.equal(calculateQuoteProductPrice({
    commercialUnit: 'M2',
    appliedUnitPrice: null,
    areaPerItem: 1.44,
    quantity: 1,
  }).productTotal, 0);
  assert.equal(commercialUnitLabel('M2'), 'm²');
  assert.equal(commercialUnitLabel('UNIT'), 'un');
});

test('STOCKUX01/PARTIAL: somente warnings comerciais são apresentados no orçamento', () => {
  assert.equal(isCommercialPricingWarning('MISSING_PRICE'), true);
  assert.equal(isCommercialPricingWarning('MISSING_PRICE_VARIANT'), true);
  assert.equal(isCommercialPricingWarning('INSUFFICIENT_STOCK'), false);
  assert.equal(isCommercialPricingWarning('MISSING_STOCK'), false);
});

test('UX01/UX06/UX11: campo único usa formato monetário sem transformar ausência em zero', () => {
  assert.equal(formatAppliedQuotePriceInput(1600), '1.600,00');
  assert.equal(parseAppliedQuotePrice('R$ 1.450,00'), 1450);
  assert.equal(parseAppliedQuotePrice(''), null);
  assert.equal(syncAppliedQuotePrice('1.450,00', true, 1600), '1.450,00');
  assert.equal(syncAppliedQuotePrice('', false, null), '');
});

test('UX09/UX10: somente estados que exigem atenção mostram aviso principal', () => {
  assert.equal(getCompositionSuggestionNotice('COMPLETE'), null);
  assert.equal(getCompositionSuggestionNotice('PARTIAL'), 'Alguns componentes ainda estão sem preço. Revise o valor antes de continuar.');
  assert.equal(getCompositionSuggestionNotice('UNAVAILABLE'), 'Não foi possível calcular o preço automaticamente. Informe o valor.');
});
