import { describe, expect, it } from 'vitest';
import {
  formatOperationalQuantity,
  getOsMaterialSituation,
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
