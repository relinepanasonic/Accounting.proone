import React from 'react';
import { Image as ImageIcon, MessageSquare, Users, Clock, Radio } from 'lucide-react';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { loadGroups, loadMessages, loadPeople, sinceDays, type TeamRole } from '@/lib/wa/queries';
import { fmtMinutes, memberStats, median, responseTimes, type WaMsg } from '@/lib/wa/stats';
import { WaFilters, LinkNumber, TrackToggle, RenameGroup, GenerateReport, ActionRow } from './WaClient';

const WEBHOOK_ORIGIN = 'https://erp.profesoronline.id';
const ROLE_LABEL: Record<string, string> = { admin: 'Admin', advertiser: 'Advertiser', sales: 'Sales', superadmin: 'Superadmin', accounting: 'Accounting', founder: 'Founder' };

const jakarta = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

const card = 'rounded-xl border border-[#d4af37]/15 bg-[#0e0f14]/70 p-4';
const th = 'px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500';

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className={card}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{icon}{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

/** One board for the Dashboard (role = null: everyone) and for the Admin / Advertiser / Sales pages. */
export async function WaBoard({ workspaceId, role, days, groupId, q }: { workspaceId: string; role: TeamRole | null; days: 1 | 7 | 30; groupId: string; q: string }) {
  const db = createAdminClient();
  const [groups, { roster, byPhone }, msgs] = await Promise.all([
    loadGroups(workspaceId),
    loadPeople(workspaceId),
    loadMessages(workspaceId, sinceDays(days), groupId || null),
  ]);
  const groupName = new Map(groups.map((g) => [g.id, g.name || (g.is_group ? 'Unnamed group' : 'Private chat')]));
  const isTeam = (phone: string | null, m: WaMsg) => m.is_from_me || (!!phone && !!byPhone.get(phone)?.isTeam);

  const scopeRoster = role ? roster.filter((p) => p.role === role) : roster.filter((p) => ['admin', 'advertiser', 'sales'].includes(p.role || ''));
  const scopePhones = new Set(scopeRoster.map((p) => p.phone).filter(Boolean));
  const scopeMsgs = role ? msgs.filter((m) => m.sender_phone && scopePhones.has(m.sender_phone)) : msgs;

  const replies = responseTimes(msgs, isTeam);
  const scopeReplies = role ? scopeRoster.flatMap((p) => replies.get(p.phone) || []) : [...replies.values()].flat();
  const stats = memberStats(role ? scopeMsgs : msgs, scopeRoster, byPhone, replies).filter((s) => (role ? true : !!s.role || byPhone.get(s.phone)?.isTeam));
  const teamMsgs = msgs.filter((m) => isTeam(m.sender_phone, m)).length;
  const activeChats = new Set(scopeMsgs.map((m) => m.group_id)).size;
  const silent = scopeRoster.filter((p) => !p.phone || !scopeMsgs.some((m) => m.sender_phone === p.phone));

  // Messages per group in this period, for the chat table.
  const perGroup = new Map<string, number>();
  for (const m of msgs) perGroup.set(m.group_id, (perGroup.get(m.group_id) || 0) + 1);

  // Feed: newest first, filtered by the search box.
  const needle = q.toLowerCase();
  const feed = [...scopeMsgs].reverse().filter((m) => !needle || (m.body || '').toLowerCase().includes(needle) || (m.sender_name || '').toLowerCase().includes(needle)).slice(0, 60);

  // Dashboard only: numbers that wrote in a chat but are not linked to anybody yet.
  let unlinked: { phone: string; name: string; count: number }[] = [];
  let devices: { phone: string; label: string | null; webhook_secret: string }[] = [];
  let reports: any[] = [];
  let actions: any[] = [];
  if (!role) {
    const seen = new Map<string, { name: string; count: number }>();
    for (const m of msgs) {
      if (!m.sender_phone || m.is_from_me || byPhone.has(m.sender_phone)) continue;
      const s = seen.get(m.sender_phone) || { name: m.sender_name || '', count: 0 };
      s.count++;
      if (m.sender_name) s.name = m.sender_name;
      seen.set(m.sender_phone, s);
    }
    unlinked = [...seen.entries()].map(([phone, v]) => ({ phone, ...v })).sort((a, b) => b.count - a.count).slice(0, 12);
    const [d, r, a] = await Promise.all([
      db.from('wa_devices').select('phone, label, webhook_secret').eq('workspace_id', workspaceId),
      db.from('wa_reports').select('id, report_date, group_id, summary, message_count, created_at').eq('workspace_id', workspaceId).order('report_date', { ascending: false }).order('created_at', { ascending: false }).limit(60),
      db.from('wa_action_items').select('id, title, detail, owner_phone, due_date, group_id, staff_task_id').eq('workspace_id', workspaceId).eq('status', 'open').order('created_at', { ascending: false }).limit(30),
    ]);
    devices = (d.data || []) as any;
    reports = r.data || [];
    actions = a.data || [];
  }

  // Latest report day: the digest (all chats) first, then one report per chat.
  const latestDate: string | null = reports[0]?.report_date || null;
  const dayReports = reports.filter((r) => r.report_date === latestDate);
  const digest = dayReports.find((r) => !r.group_id) || null;
  const chatReports = dayReports.filter((r) => r.group_id);
  const nameOfGroup = (id: string | null) => (id ? groupName.get(id) || 'Chat' : null);
  const personOfPhone = (p: string | null) => (p ? byPhone.get(p)?.name || `+${p}` : null);

  const periodLabel = days === 1 ? 'last 24h' : `last ${days} days`;
  const nameOf = (m: WaMsg) => byPhone.get(m.sender_phone || '')?.name || m.sender_name || m.sender_phone || '-';
  const roleOf = (m: WaMsg) => (m.is_from_me ? 'device' : byPhone.get(m.sender_phone || '')?.role || null);

  return (
    <div className="space-y-6">
      <WaFilters groups={groups.map((g) => ({ id: g.id, name: g.name || (g.is_group ? 'Unnamed group' : 'Private chat') }))} days={days} groupId={groupId} q={q} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<MessageSquare className="h-3.5 w-3.5" />} label={role ? `${ROLE_LABEL[role]} messages` : 'Messages'} value={String(scopeMsgs.length)} sub={role ? `${msgs.length} in all chats, ${periodLabel}` : `${teamMsgs} from team, ${periodLabel}`} />
        <Stat icon={<Radio className="h-3.5 w-3.5" />} label="Active chats" value={String(activeChats)} sub={`${groups.filter((g) => g.tracked).length} of ${groups.length} reporting`} />
        <Stat icon={<Users className="h-3.5 w-3.5" />} label={role ? `${ROLE_LABEL[role]} people` : 'Team people'} value={`${scopeRoster.length - silent.length}/${scopeRoster.length}`} sub="wrote in this period" />
        <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Median reply" value={fmtMinutes(median(scopeReplies))} sub={`${scopeReplies.length} answered`} />
      </div>

      {!role && groups.length === 0 && (
        <div className={`${card} text-sm text-zinc-300`}>
          No chats captured yet. Point the Fonnte webhook of your device to the address under <b>Connect a device</b> below, then send a message in a group.
        </div>
      )}

      {!role && (
        <section className={card}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">Daily AI report{latestDate ? ` · ${latestDate}` : ''}</h2>
            <GenerateReport />
          </div>
          {!latestDate ? (
            <p className="py-4 text-center text-xs text-zinc-500">No report yet. It is written automatically every day at 18:00 (Jakarta) once chats have messages, or press Generate now.</p>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              <div className="space-y-3">
                {digest && <div className="rounded-lg border border-[#d4af37]/25 bg-[#d4af37]/5 p-3"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#f5d77f]">All chats · {digest.message_count} messages</div><p className="whitespace-pre-wrap text-sm text-zinc-200">{digest.summary}</p></div>}
                {chatReports.map((r) => (
                  <details key={r.id} className="rounded-lg border border-zinc-800 p-3">
                    <summary className="cursor-pointer text-xs font-bold text-zinc-200">{nameOfGroup(r.group_id)} <span className="font-normal text-zinc-500">· {r.message_count} messages</span></summary>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-300">{r.summary}</p>
                  </details>
                ))}
              </div>
              <div>
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Follow-ups ({actions.length})</h3>
                {actions.length === 0 ? <p className="text-xs text-zinc-500">Nothing open.</p> : (
                  <ul className="max-h-[28rem] divide-y divide-zinc-800/70 overflow-y-auto">
                    {actions.map((a) => (
                      <li key={a.id} className="space-y-1.5 py-2.5">
                        <div className="text-sm text-zinc-200">{a.title}</div>
                        {a.detail && <div className="text-[11px] text-zinc-500">{a.detail}</div>}
                        <div className="text-[10px] text-zinc-500">{[nameOfGroup(a.group_id), personOfPhone(a.owner_phone) && `owner: ${personOfPhone(a.owner_phone)}`, a.due_date && `due ${a.due_date}`].filter(Boolean).join(' · ')}</div>
                        <ActionRow id={a.id} hasTask={!!a.staff_task_id} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className={card}>
          <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">Live feed{q ? ` · "${q}"` : ''}</h2>
          {feed.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-500">No messages in this view.</p>
          ) : (
            <ul className="max-h-[34rem] divide-y divide-zinc-800/70 overflow-y-auto">
              {feed.map((m, i) => {
                const r = roleOf(m);
                return (
                  <li key={i} className="py-2.5">
                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500">
                      <span className="font-semibold text-zinc-200">{nameOf(m)}</span>
                      {r && <span className="rounded bg-[#d4af37]/15 px-1.5 py-px text-[10px] font-bold uppercase text-[#f5d77f]">{r === 'device' ? 'our device' : ROLE_LABEL[r] || r}</span>}
                      <span>in {groupName.get(m.group_id) || '-'}</span>
                      <span className="ml-auto">{jakarta(m.sent_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-300">
                      {m.media_type && <span className="mr-1.5 inline-flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-px align-middle text-[10px] uppercase text-zinc-400"><ImageIcon className="h-3 w-3" />{m.media_type}</span>}
                      {m.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className={card}>
            <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">{role ? `${ROLE_LABEL[role]} team` : 'Team activity'}</h2>
            {stats.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-500">{role ? `No ${ROLE_LABEL[role]} people in this company yet.` : 'No team activity yet.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr><th className={th}>Person</th><th className={th}>Msgs</th><th className={th}>Chats</th><th className={th}>Reply</th><th className={th}>Last</th></tr></thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {stats.map((s) => (
                      <tr key={s.key}>
                        <td className="px-3 py-2 text-zinc-200">{s.name}{s.role && !role && <span className="ml-1.5 text-[10px] uppercase text-zinc-500">{ROLE_LABEL[s.role] || s.role}</span>}{!s.phone && <span className="ml-1.5 text-[10px] text-amber-400">no number</span>}</td>
                        <td className="px-3 py-2 text-zinc-300">{s.messages}</td>
                        <td className="px-3 py-2 text-zinc-300">{s.groups}</td>
                        <td className="px-3 py-2 text-zinc-300">{fmtMinutes(s.medianReplyMin)}</td>
                        <td className="px-3 py-2 text-zinc-500">{s.lastAt ? jakarta(s.lastAt) : 'silent'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {role && silent.length > 0 && <p className="mt-3 text-[11px] text-amber-400/90">Not heard from in this period: {silent.map((p) => p.name).join(', ')}.</p>}
          </section>

          {!role && (
            <section className={card}>
              <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">Chats</h2>
              {groups.length === 0 ? <p className="py-4 text-center text-xs text-zinc-500">None yet.</p> : (
                <ul className="max-h-72 divide-y divide-zinc-800/70 overflow-y-auto">
                  {groups.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <RenameGroup groupId={g.id} name={g.name} fallback={g.is_group ? `Group ${g.wa_id.slice(-6)}` : `+${g.wa_id}`} />
                        <div className="text-[10px] text-zinc-500">{g.is_group ? 'Group' : 'Private'} · {perGroup.get(g.id) || 0} msgs · {g.last_message_at ? jakarta(g.last_message_at) : 'no messages'}</div>
                      </div>
                      <TrackToggle groupId={g.id} tracked={g.tracked} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>

      {!role && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className={card}>
            <h2 className="mb-1 text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">Link numbers to people</h2>
            <p className="mb-3 text-[11px] text-zinc-500">Numbers that match a phone in the ERP profile link themselves. Link the rest here so their chats count for Admin, Advertiser or Sales.</p>
            {unlinked.length === 0 ? <p className="py-3 text-center text-xs text-zinc-500">Every number that wrote is linked or ours.</p> : (
              <ul className="divide-y divide-zinc-800/70">
                {unlinked.map((u) => (
                  <li key={u.phone} className="flex flex-wrap items-center gap-3 py-2 text-xs">
                    <div className="min-w-0 flex-1"><div className="truncate text-zinc-200">{u.name || 'Unknown'}</div><div className="text-[10px] text-zinc-500">+{u.phone} · {u.count} msgs</div></div>
                    <LinkNumber phone={u.phone} name={u.name} people={roster.map((p) => ({ userId: p.userId as string, name: p.name, role: ROLE_LABEL[p.role || ''] || p.role || '' }))} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={card}>
            <h2 className="mb-1 text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">Reports</h2>
            <p className="text-[11px] text-zinc-500">Written every day at 18:00 (Jakarta). Press Generate now to write today&apos;s report right away. Make.com can fetch it from <code className="text-zinc-400">/api/v1/erp/wa-report</code>.</p>
          </section>
        </div>
      )}

      {!role && (
        <details className={card}>
          <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">Connect a device</summary>
          <p className="mt-3 text-[11px] text-zinc-500">In Fonnte, open the device and set its Webhook (incoming message) to the address below. Keep it private: anyone who has it can post messages into this company.</p>
          <ul className="mt-2 space-y-2">
            {devices.map((d) => (
              <li key={d.phone} className="text-xs"><span className="text-zinc-300">{d.label || d.phone} (+{d.phone})</span><code className="mt-1 block break-all rounded bg-black/40 p-2 text-[11px] text-emerald-300">{`${WEBHOOK_ORIGIN}/api/wa/webhook/${d.webhook_secret}`}</code></li>
            ))}
            {devices.length === 0 && <li className="text-xs text-zinc-500">No device added yet.</li>}
          </ul>
        </details>
      )}
    </div>
  );
}
