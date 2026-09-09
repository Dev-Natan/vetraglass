import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const readSource = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const page = readSource('src/pages/OrdemServicoDetalhes.tsx');
const products = readSource('src/components/ordens-servico/OSProductsList.tsx');
const materials = readSource('src/components/ordens-servico/OSMaterialsList.tsx');
const cutting = readSource('src/components/ordens-servico/OSCuttingPlan.tsx');
const purchases = readSource('src/components/ordens-servico/OSPurchasesList.tsx');
const adjustments = readSource('src/components/ordens-servico/OSDimensionHistoryList.tsx');

test('TAB01 existem somente cinco abas principais', () => {
  assert.equal((page.match(/<TabsTrigger value=/g) ?? []).length, 5);
  for (const tab of ['products', 'materials', 'cutting', 'purchases', 'history']) {
    assert.match(page, new RegExp(`TabsTrigger value="${tab}"`));
  }
});

test('TAB02 Produtos usa os itens congelados da OS', () => {
  assert.match(products, /osService\.getOSItems/);
  assert.match(products, /engineering_snapshot/);
});

test('TAB03 Materiais inclui perfis', () => {
  assert.match(materials, /totals\.profile/);
});

test('TAB04 Materiais inclui vidros', () => {
  assert.match(materials, /totals\.glass/);
});

test('TAB05 Materiais inclui acessórios quando existentes', () => {
  assert.match(materials, /totals\.accessory/);
});

test('TAB06 não existe aba independente de Vidros', () => {
  assert.doesNotMatch(page, /TabsTrigger value="glass"/);
});

test('TAB07 não existe aba independente de Acessórios', () => {
  assert.doesNotMatch(page, /TabsTrigger value="accessories"/);
});

test('TAB08 Cortes contém preparação de perfis', () => {
  assert.match(cutting, /OSProfilePreparationList/);
});

test('TAB09 Cortes contém os detalhes de vidros', () => {
  assert.match(cutting, /OSGlassUnifiedView/);
});

test('TAB10 Compras usa todas as necessidades retornadas pela Phase 3G', () => {
  assert.match(purchases, /get_os_material_availability/);
  assert.match(purchases, /availability\.items\.map/);
});

test('TAB11 Compras mostra necessário, reservado e falta', () => {
  for (const label of ['Necessário', 'Reservado', 'Falta']) assert.match(purchases, new RegExp(label));
});

test('TAB12 material atendido não é classificado como faltante pela apresentação', () => {
  assert.match(purchases, /getOsMaterialSituation/);
  assert.match(purchases, /availability\.sufficient/);
});

test('TAB13 material parcial mantém situação própria', () => {
  assert.match(purchases, /Parcial/);
});

test('TAB14 material sem estoque expõe situação Comprar', () => {
  assert.match(purchases, /Comprar/);
});

test('TAB15 ação de compra reutiliza o fluxo canônico existente', () => {
  assert.match(purchases, /to="\/pedidos-compra"/);
  assert.doesNotMatch(purchases, /\.insert\(|\.update\(|\.delete\(/);
});

test('TAB16 Ajustes permanece ligado ao histórico técnico', () => {
  assert.match(page, /OSDimensionHistoryList/);
  assert.match(adjustments, /os_dimension_history/);
});
