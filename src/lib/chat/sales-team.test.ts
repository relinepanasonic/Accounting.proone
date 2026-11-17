import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
vi.mock('@/lib/api/supabase-admin', () => ({ createAdminClient: () => ({}) }));
import { cleanTeam } from './sales-team';

const HERLAN = { id: 'f7125e06-59f9-4d8d-8114-b54c47388454', name: 'Herlan' };
const VELLY = { id: '398ce99a-f1d7-49b4-8bff-bb9ba9d5cd57', name: 'Velly' };

describe('the sales team list', () => {
  it('keeps real ids once each, with a name, at most 20', () => {
    expect(cleanTeam([HERLAN, HERLAN, VELLY, { id: 'x', name: 'Bad' }, { id: VELLY.id.toUpperCase(), name: 'Dup' }, null])).toEqual([HERLAN, VELLY]);
    expect(cleanTeam([{ id: HERLAN.id }])).toEqual([{ id: HERLAN.id, name: 'Sales' }]);
    expect(cleanTeam('nope')).toEqual([]);
    expect(cleanTeam(Array.from({ length: 30 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: `P${i}` })))).toHaveLength(20);
  });
});

describe('the number of a salesperson', () => {
  const id = '398ce99a-f1d7-49b4-8bff-bb9ba9d5cd57';
  it('is kept as 62..., or dropped when it is not a number', () => {
    expect(cleanTeam([{ id, name: 'Velly', phone: '0812-3456-7890' }])[0].phone).toBe('6281234567890');
    expect(cleanTeam([{ id, name: 'Velly', phone: 'abc' }])[0].phone).toBeUndefined();
    expect(cleanTeam([{ id, name: 'Velly' }])[0].phone).toBeUndefined();
  });
});
