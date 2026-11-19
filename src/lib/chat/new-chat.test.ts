import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/api/supabase-admin', () => ({ createAdminClient: () => ({}) }));
import { cleanNewChat, NEW_CHAT_MAX_CHARS } from './new-chat';

describe('a new chat from the dashboard', () => {
  it('reads the number the usual ways', () => {
    expect(cleanNewChat({ phone: '0812-3456-7890', text: 'Halo kak' })).toEqual({ ok: true, phone: '6281234567890', text: 'Halo kak' });
    expect(cleanNewChat({ phone: '+62 812 3456 7890', text: ' Halo ' })).toMatchObject({ ok: true, phone: '6281234567890', text: 'Halo' });
    expect(cleanNewChat({ phone: '81234567890', text: 'Halo' })).toMatchObject({ ok: true, phone: '6281234567890' });
  });
  it('refuses a missing or odd number, and an empty or too long message', () => {
    expect(cleanNewChat({ phone: '', text: 'Halo' })).toMatchObject({ ok: false });
    expect(cleanNewChat({ phone: 'abc', text: 'Halo' })).toMatchObject({ ok: false });
    expect(cleanNewChat({ phone: '0812', text: 'Halo' })).toMatchObject({ ok: false });
    expect(cleanNewChat({ phone: '081234567890', text: '  ' })).toMatchObject({ ok: false });
    expect(cleanNewChat({ phone: '081234567890', text: 'x'.repeat(NEW_CHAT_MAX_CHARS + 1) })).toMatchObject({ ok: false });
  });
});
