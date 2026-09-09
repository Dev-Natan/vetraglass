import { describe, expect, it } from 'vitest';
import {
  basicProfilePurchasePlan,
  canonicalMaterialQuantity,
  consolidateOsMaterials,
  formatOperationalQuantity,
  formatPurchaseQuantity,
  getOsMaterialSituation,
  materialTypeLabel,
  normalizeGlassCutSnapshot,
  resolveCanonicalMaterialType,
  type OsMaterialOperationalState,
} from './osMaterialStatus';

const requirement = (
  overrides: Partial<OsMaterialOperationalState> = {},
): OsMaterialOperationalState => ({
  lifecycle_status: 'ACTIVE',
  status: 'PENDING',
  reserved: 0,
  missing: 2100,
  in_purchase: 0,
  received: 0,
  ...overrides,
});

describe('OS material operational status', () => {
  it('converts canonical quantities to the consumption unit', () => {
    expect(formatOperationalQuantity(2100, 'MM')).toBe('2,1 m');
    expect(formatOperationalQuantity(1_440_000, 'MM2')).toBe('1,44 m²');
    expect(formatOperationalQuantity(3, 'UNIT')).toBe('3 un');
  });

  it('shows supplied, partial and purchase states without internal codes', () => {
    expect(getOsMaterialSituation(requirement({
      status: 'SUPPLIED',
      missing: 0,
      reserved: 2100,
    }))).toBe('Atendido');
    expect(getOsMaterialSituation(requirement({
      reserved: 1200,
      missing: 900,
    }))).toBe('Parcial');
    expect(getOsMaterialSituation(requirement())).toBe('Comprar');
    expect(getOsMaterialSituation(requirement({ in_purchase: 2100 }))).toBe('Em compra');
    expect(getOsMaterialSituation(requirement({
      in_purchase: 900,
      received: 1200,
    }))).toBe('Recebimento parcial');
  });

  it('prioritizes terminal lifecycle states', () => {
    expect(getOsMaterialSituation(requirement({ lifecycle_status: 'COMPLETED' }))).toBe('Consumido');
    expect(getOsMaterialSituation(requirement({ lifecycle_status: 'CANCELLED' }))).toBe('Cancelado');
  });
});

describe('OS material presentation', () => {
  it('MAT01/MAT02 converts profile length and derives whole bars', () => {
    expect(canonicalMaterialQuantity(1.2, 'm', 'profile')).toEqual({
      quantity: 1200,
      unit: 'MM',
    });
    expect(basicProfilePurchasePlan(1200, 6000)).toEqual({
      barsNeeded: 1,
      theoreticalWasteMm: 4800,
    });
    expect(basicProfilePurchasePlan(7200, 6000)).toEqual({
      barsNeeded: 2,
      theoreticalWasteMm: 4800,
    });
  });

  it('MAT03/MAT04 consolidates canonical lengths without legacy zero fields', () => {
    const [material] = consolidateOsMaterials([
      {
        id: 'one',
        company_item_id: 'profile-a',
        item_name: 'CLICK',
        item_type: 'profile',
        unit: 'm',
        required_quantity: 1.2,
        bar_length_mm: 6000,
      },
      {
        id: 'two',
        company_item_id: 'profile-a',
        item_name: 'CLICK',
        item_type: 'profile',
        unit: 'm',
        required_quantity: 0.245,
        bar_length_mm: 6000,
      },
    ]);

    expect(material.required_canonical_quantity).toBe(1445);
    expect(material.bars_needed).toBe(1);
    expect(material.theoretical_waste_mm).toBe(4555);
    expect(formatOperationalQuantity(material.required_canonical_quantity, material.canonical_unit))
      .toBe('1,445 m');
  });

  it('MAT05/MAT06 classifies glass independently from accessories', () => {
    expect(resolveCanonicalMaterialType('glass', 'm²')).toBe('glass');
    expect(resolveCanonicalMaterialType(null, 'M2')).toBe('glass');
    expect(materialTypeLabel('glass')).toBe('Vidro');
    expect(materialTypeLabel('profile')).toBe('Perfil');
    expect(materialTypeLabel('accessory')).toBe('Acessório');
  });

  it('MAT07/MAT08 normalizes frozen snake_case glass snapshots without NaN', () => {
    const fixed = normalizeGlassCutSnapshot({
      role: 'VIDRO FIXO',
      width_mm: 600,
      height_mm: 1440,
      piece_area_m2: 0.864,
      piece_quantity: 1,
    });
    const moving = normalizeGlassCutSnapshot({
      role: 'VIDRO MOVEL',
      width_mm: 650,
      height_mm: 1480,
      piece_quantity: 1,
    });

    expect(fixed?.areaM2).toBe(0.864);
    expect(moving?.areaM2).toBe(0.962);
    expect((fixed?.areaM2 ?? 0) + (moving?.areaM2 ?? 0)).toBeCloseTo(1.826);
    expect(normalizeGlassCutSnapshot({ width_mm: null, height_mm: 100 })).toBeNull();
  });

  it('MAT09/MAT10 formats purchase quantities in commercial units', () => {
    expect(formatOperationalQuantity(1470, 'MM')).toBe('1,47 m');
    expect(formatOperationalQuantity(962000, 'MM2')).toBe('0,962 m²');
    expect(formatPurchaseQuantity(1, 'BAR')).toBe('1 barra');
    expect(formatPurchaseQuantity(2, 'BAR')).toBe('2 barras');
  });

  it('DATA01-DATA04 preserves distinct technical glass identities', () => {
    const materials = consolidateOsMaterials([
      {
        os_item_id: 'product-one',
        snapshot_key: 'fixed-panel',
        company_item_id: 'same-glass',
        variant_id: 'same-variant',
        item_name: 'VIDRO FIXO',
        item_type: 'glass',
        unit: 'm²',
        required_quantity: 0.864,
      },
      {
        os_item_id: 'product-one',
        snapshot_key: 'moving-panel',
        company_item_id: 'same-glass',
        variant_id: 'same-variant',
        item_name: 'VIDRO MÓVEL',
        item_type: 'glass',
        unit: 'm²',
        required_quantity: 0.962,
      },
    ]);

    expect(materials).toHaveLength(2);
    expect(materials.map((material) => material.required_canonical_quantity))
      .toEqual([864000, 962000]);
    expect(materials.reduce(
      (total, material) => total + material.required_canonical_quantity,
      0,
    )).toBe(1826000);
  });
});
