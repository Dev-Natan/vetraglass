import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProfileColorIdentities } from './profileColorIdentity.ts';

test('global color keeps tenant and global identities separate', () => {
  const [resolved] = resolveProfileColorIdentities([
    {
      color_id: 'admin-white',
      color_code: 'BRANCO',
      color_name: 'Branco',
      hex_color: '#ffffff',
      sort_order: 1,
    },
  ], [
    {
      id: 'tenant-white',
      admin_color_id: 'admin-white',
      code: 'BRANCO',
      name: 'Branco',
    },
  ]);

  assert.equal(resolved.company_color_id, 'tenant-white');
  assert.equal(resolved.admin_color_id, 'admin-white');
});

test('private color uses its tenant identity without a global id', () => {
  const [resolved] = resolveProfileColorIdentities([
    {
      color_id: 'tenant-corten',
      color_code: 'CORTEN',
      color_name: 'Corten',
      hex_color: null,
      sort_order: 100,
    },
  ], [
    {
      id: 'tenant-corten',
      admin_color_id: null,
      code: 'CORTEN',
      name: 'Corten',
    },
  ]);

  assert.equal(resolved.company_color_id, 'tenant-corten');
  assert.equal(resolved.admin_color_id, null);
});

test('unknown or cross-tenant identity is rejected', () => {
  assert.throws(() => resolveProfileColorIdentities([
    {
      color_id: 'foreign-color',
      color_code: 'GRAFITE',
      color_name: 'Grafite',
      hex_color: null,
      sort_order: 1,
    },
  ], []), /PROFILE_COLOR_IDENTITY_NOT_FOUND/);
});
