import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeQuotePricingError,
  parseAppliedQuotePrice,
  syncAppliedQuotePrice,
} from './quotePricing.ts';

test('P02: preço aplicado inicialmente acompanha a sugestão', () => {
  assert.equal(syncAppliedQuotePrice('', false, 1300), '1300.00');
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

test('LINE_BAND sem faixa usa mensagem comercial', () => {
  const issue = describeQuotePricingError({ message: 'PRICE_NOT_CONFIGURED' });
  assert.equal(issue.message, 'Esta configuração ainda não possui preço automático.');
});
