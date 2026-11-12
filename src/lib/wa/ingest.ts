import { createAdminClient } from '@/lib/api/supabase-admin';
import type { ParsedWaMessage } from './parse-webhook';

export interface IngestResult {
  stored: boolean;
  duplicate?: boolean;
  /** The chat this message belongs to, and whether this call saved it for the first time (a retried webhook is not new). */
  groupId?: string;
  isNew?: boolean;
  reason?: string;
}

/** Looks a webhook secret up. Returns null when it is not a known, active device (never reveal which). */
export async function deviceBySecret(secret: string) {
  if (!/^[a-f0-9]{32,64}$/i.test(secret)) return null;
  const db = createAdminClient();
  const { data } = await db
    .from('wa_devices')
    .select('id, workspace_id, phone, active, role')
    .eq('webhook_secret', secret)
    .eq('active', true)
    .maybeSingle();
  return data as { id: string; workspace_id: string; phone: string; active: boolean; role: string } | null;
}

/** Saves one parsed message: finds or creates its group and sender, then inserts it (a repeat is ignored). */
export async function ingestMessage(
  device: { id: string; workspace_id: string; phone: string },
  m: ParsedWaMessage,
  raw: Record<string, unknown>,
): Promise<IngestResult> {
  // A device may only post for itself: a payload naming another device is refused.
  if (m.device !== device.phone) return { stored: false, reason: 'device-mismatch' };

  const db = createAdminClient();
  const ws = device.workspace_id;

  // 1. Group (or private chat). Keep the name fresh, and move last_message_at forward.
  const groupRow: Record<string, unknown> = {
    workspace_id: ws,
    device_id: device.id,
    wa_id: m.chatId,
    is_group: m.isGroup,
    last_message_at: m.sentAt.toISOString(),
  };
  if (m.groupName) groupRow.name = m.groupName;
  const { data: group, error: gErr } = await db
    .from('wa_groups')
    .upsert(groupRow, { onConflict: 'workspace_id,wa_id' })
    .select('id')
    .single();
  if (gErr || !group) throw new Error(`wa_groups upsert failed: ${gErr?.message}`);

  // 2. Sender: remember each number once (staff are marked later on the dashboard).
  if (m.senderPhone) {
    await db
      .from('wa_members')
      .upsert(
        { workspace_id: ws, phone: m.senderPhone, ...(m.senderName ? { display_name: m.senderName } : {}) },
        { onConflict: 'workspace_id,phone', ignoreDuplicates: !m.senderName },
      );
  }

  // 3. The message. The unique dedupe key makes a retried webhook a no-op.
  const { data: inserted, error: mErr } = await db.from('wa_messages').upsert(
    {
      workspace_id: ws,
      group_id: group.id,
      sender_phone: m.senderPhone,
      sender_name: m.senderName,
      body: m.body,
      media_type: m.mediaType,
      media_url: m.mediaUrl,
      media_filename: m.mediaFilename,
      is_from_me: m.isFromMe,
      external_id: m.externalId,
      dedupe_key: m.dedupeKey,
      sent_at: m.sentAt.toISOString(),
      raw,
      source: 'webhook',
    },
    { onConflict: 'workspace_id,dedupe_key', ignoreDuplicates: true },
  ).select('id');
  if (mErr) throw new Error(`wa_messages insert failed: ${mErr.message}`);
  return { stored: true, groupId: group.id as string, isNew: (inserted || []).length > 0 };
}
