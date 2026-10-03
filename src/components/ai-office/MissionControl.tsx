'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Bot, Brain, Building2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, KanbanSquare,
  LayoutDashboard, Loader2, Pin, PinOff, Play, Plus, RefreshCw, RotateCcw, Trash2, Users, Wallet, X, XCircle,
} from 'lucide-react';
import { OfficeView } from '@/components/ai-office/OfficeView';
import { fmtUsd } from '@/lib/ai/costs';
import { WEEKDAYS, describeRule, jakartaNow, runsOn, type Cadence } from '@/lib/ai/schedule-rules';

// ---------- shapes from /api/ai-office/mission ----------
interface Agent { id: string; team_id: string | null; name: string; title: string; floor: number; kind: string; provider: string; model: string; enabled: boolean }
interface Team { id: string; slug: string; name: string; mission: string; enabled: boolean }
interface Task {
  id: string; team_id: string | null; parent_id: string | null; seq: number; title: string; instructions: string; agent_id: string | null;
  status: 'queued' | 'planning' | 'running' | 'review' | 'reviewing' | 'done' | 'failed';
  result: string | null; qc_feedback: string | null; error: string | null; model_used: string | null; created_at: string; updated_at?: string;
}
interface Goal extends Task { subtasks: Task[]; cost: number; schedule_id?: string | null }
interface OfficeEvent { id: string; goal_id: string | null; agent_id: string | null; message: string; created_at: string }
interface Memory { id: string; team_id: string | null; agent_id: string | null; title: string; content: string; pinned: boolean; updated_at: string }
interface Schedule {
  id: string; team_id: string | null; title: string; brief: string; cadence: Cadence; weekday: number | null; monthday: number | null;
  run_date: string | null; run_time: string; enabled: boolean; last_run_at: string | null; last_goal_id: string | null;
}
interface Skill { id: string; name: string; agent_ids: string[] }
interface Mission {
  setup: { tables: boolean; teams: boolean; anthropic: boolean; groq: boolean; gemini: boolean; openrouter: boolean; zai: boolean };
  agents: Agent[]; teams: Team[]; skills: Skill[]; goals: Goal[]; events: OfficeEvent[];
  agentStats: Record<string, { done: number; failed: number; active: number; cost: number }>;
  memories: Memory[]; schedules: Schedule[];
  budget: { budget: number; spent: number; left: number; over: boolean; ready: boolean };
  missionReady: boolean; startedSchedules?: number;
}

type TabKey = 'dashboard' | 'office' | 'team' | 'board' | 'calendar' | 'activity' | 'memory';
const TABS: { key: TabKey; label: string; icon: typeof Activity }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'office', label: 'Virtual Office', icon: Building2 },
  { key: 'team', label: 'Team Agent', icon: Users },
  { key: 'board', label: 'Task Board', icon: KanbanSquare },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'activity', label: 'Activity', icon: Activity },
  { key: 'memory', label: 'Memory', icon: Brain },
];

const GENERAL = '__general__';
const teamKey = (id: string | null) => id ?? GENERAL;
const WORKING: Task['status'][] = ['planning', 'running', 'review', 'reviewing'];
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

// ---------- small UI pieces ----------
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#d4af37]/15 bg-[#0e0f14] p-4 ${className}`}>{children}</div>;
}
function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-zinc-400">{children}</h3>;
}
function Tile({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${tone || 'text-zinc-100'}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-zinc-500">{hint}</div>}
    </div>
  );
}
const STATUS_STYLE: Record<string, string> = {
  queued: 'border-zinc-700 bg-zinc-900 text-zinc-400',
  planning: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  running: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  review: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  reviewing: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  done: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  failed: 'border-red-500/30 bg-red-500/10 text-red-300',
};
function Status({ s }: { s: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[s] || STATUS_STYLE.queued}`}>{s}</span>;
}
const input = 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-[#d4af37] focus:outline-none [color-scheme:dark]';
const btn = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50';
const btnGold = `${btn} border-[#d4af37] bg-[#d4af37] text-black hover:bg-[#e5c158]`;
const btnGhost = `${btn} border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500`;

// ---------- main ----------
export function MissionControl() {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [data, setData] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const json = (await call('/api/ai-office/mission', 'GET')) as Mission;
      setData(json);
      setError(null);
      setLoadedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      if (json.startedSchedules) setNotice(`${json.startedSchedules} calendar job(s) started.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Runs an action, then reloads. Returns false on failure (and shows why). */
  const act = useCallback(
    async (fn: () => Promise<unknown>, done?: string) => {
      try {
        await fn();
        if (done) setNotice(done);
        await refresh();
        return true;
      } catch (e: any) {
        setNotice(e.message);
        return false;
      }
    },
    [refresh]
  );

  const teamName = useCallback((id: string | null) => (id ? data?.teams.find((t) => t.id === id)?.name || 'Team' : 'No team'), [data]);
  const agentName = useCallback((id: string | null) => (id ? data?.agents.find((a) => a.id === id)?.name || 'Agent' : null), [data]);
  const openGoal = data?.goals.find((g) => g.id === openGoalId) || null;

  return (
    <div className="space-y-5">
      {/* Tabs + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                tab === key ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#d4af37] shadow-md' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {loadedAt && <span className="text-[11px] text-zinc-500">Updated {loadedAt}</span>}
          <button onClick={refresh} disabled={loading} className={btnGhost}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-2 text-xs text-[#f5d77f]">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">{error}</div>}
      {data && !data.missionReady && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          Calendar and Memory need one database step: run <span className="font-mono">supabase/migrations/20261001_mission_control.sql</span> in Supabase.
        </div>
      )}

      {/* The office keeps its own work loop: keep it mounted, only hide it. */}
      <div className={tab === 'office' ? '' : 'hidden'}>
        <OfficeView />
      </div>

      {!data && tab !== 'office' && (
        <div className="flex justify-center p-16 text-zinc-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
      )}

      {data && tab === 'dashboard' && <DashboardTab d={data} act={act} openGoal={(id) => { setOpenGoalId(id); }} teamName={teamName} />}
      {data && tab === 'team' && <TeamTab d={data} act={act} teamName={teamName} />}
      {data && tab === 'board' && <BoardTab d={data} teamName={teamName} open={setOpenGoalId} />}
      {data && tab === 'calendar' && <CalendarTab d={data} act={act} teamName={teamName} />}
      {data && tab === 'activity' && <ActivityTab d={data} agentName={agentName} teamName={teamName} open={setOpenGoalId} />}
      {data && tab === 'memory' && <MemoryTab d={data} act={act} teamName={teamName} agentName={agentName} />}

      {openGoal && <GoalDrawer g={openGoal} teamName={teamName} agentName={agentName} act={act} onClose={() => setOpenGoalId(null)} />}
    </div>
  );
}

type Act = (fn: () => Promise<unknown>, done?: string) => Promise<boolean>;

// ---------- 1. Dashboard ----------
function DashboardTab({ d, act, openGoal, teamName }: { d: Mission; act: Act; openGoal: (id: string) => void; teamName: (id: string | null) => string }) {
  const [budgetInput, setBudgetInput] = useState(String(d.budget.budget));
  const today = jakartaNow().day;
  const working = d.goals.filter((g) => WORKING.includes(g.status) || g.status === 'queued');
  const failed = d.goals.filter((g) => g.status === 'failed' || (g.status === 'done' && g.subtasks.some((s) => s.status === 'failed')));
  const doneToday = d.goals.filter((g) => g.status === 'done' && jakartaNow(new Date(g.updated_at || g.created_at)).day === today).length;
  const busyAgents = new Set(d.goals.flatMap((g) => g.subtasks.filter((s) => s.status === 'running').map((s) => s.agent_id))).size;
  const pct = d.budget.budget > 0 ? Math.min(100, Math.round((d.budget.spent / d.budget.budget) * 100)) : 100;
  const barTone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400';

  // Cost per team this month (from the briefs loaded).
  const monthKey = today.slice(0, 7);
  const byTeam = new Map<string, number>();
  d.goals.filter((g) => jakartaNow(new Date(g.created_at)).day.startsWith(monthKey)).forEach((g) => byTeam.set(teamKey(g.team_id), (byTeam.get(teamKey(g.team_id)) || 0) + g.cost));

  // Next 7 days on the calendar.
  const upcoming: { day: string; s: Schedule }[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(Date.parse(`${today}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    d.schedules.forEach((s) => runsOn(s, day) && upcoming.push({ day, s }));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Agents on" value={`${d.agents.filter((a) => a.enabled).length}/${d.agents.length}`} />
        <Tile label="Working now" value={busyAgents} hint="agents with a running task" tone="text-sky-300" />
        <Tile label="Open briefs" value={working.length} hint="queued or in progress" />
        <Tile label="Done today" value={doneToday} tone="text-emerald-300" />
        <Tile label="Needs you" value={failed.length} hint="failed, press Retry" tone={failed.length ? 'text-red-300' : 'text-zinc-100'} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <H><Wallet className="mr-1 inline h-3.5 w-3.5" /> Budget this month</H>
          <div className="text-3xl font-extrabold text-zinc-100">{fmtUsd(d.budget.spent)} <span className="text-base text-zinc-500">/ {fmtUsd(d.budget.budget)}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800"><div className={`h-full ${barTone}`} style={{ width: `${pct}%` }} /></div>
          <p className="mt-2 text-[11px] text-zinc-500">
            {d.budget.over ? 'Limit reached: new work is paused until next month or a higher limit.' : `${fmtUsd(d.budget.left)} left. The office stops starting new work at the limit.`} Estimate from tokens used.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-zinc-500">$</span>
            <input value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} inputMode="decimal" className={`${input} w-24`} aria-label="Monthly budget in USD" />
            <button className={btnGhost} onClick={() => act(() => call('/api/ai-office/budget', 'PATCH', { monthlyBudgetUsd: Number(budgetInput) }), 'Budget saved.')}>Save</button>
          </div>
          {byTeam.size > 0 && (
            <div className="mt-4 space-y-1 border-t border-zinc-800 pt-3 text-xs">
              {Array.from(byTeam.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="flex justify-between text-zinc-400"><span>{teamName(k === GENERAL ? null : k)}</span><span className="font-mono text-zinc-200">{fmtUsd(v)}</span></div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <H>Needs your decision</H>
          {failed.length === 0 ? (
            <p className="text-xs text-emerald-300">Nothing failed. All good.</p>
          ) : (
            <div className="divide-y divide-zinc-900">
              {failed.slice(0, 6).map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 py-2">
                  <button onClick={() => openGoal(g.id)} className="min-w-0 text-left">
                    <div className="truncate text-sm font-semibold text-zinc-200 hover:text-[#f5d77f]">{g.title}</div>
                    <div className="text-[11px] text-zinc-500">{teamName(g.team_id)} · {g.error || `${g.subtasks.filter((s) => s.status === 'failed').length} part(s) failed`}</div>
                  </button>
                  <button className={btnGhost} onClick={() => act(() => call('/api/ai-office/retry', 'POST', { goalId: g.id }), 'Sent back to the queue. Open Virtual Office to let it run.')}>
                    <RotateCcw className="h-3.5 w-3.5" /> Retry
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5"><H>Coming up (next 7 days)</H></div>
          {upcoming.length === 0 ? (
            <p className="text-xs text-zinc-500">No calendar jobs this week.</p>
          ) : (
            <div className="space-y-1 text-xs">
              {upcoming.slice(0, 8).map(({ day, s }, i) => (
                <div key={i} className="flex justify-between gap-3 text-zinc-300">
                  <span className="truncate">{s.title} <span className="text-zinc-500">· {teamName(s.team_id)}</span></span>
                  <span className="shrink-0 font-mono text-zinc-500">{new Date(`${day}T12:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short' })} {s.run_time}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <H>Latest reports</H>
        {d.goals.filter((g) => g.status === 'done').length === 0 ? (
          <p className="text-xs text-zinc-500">No finished briefs yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {d.goals.filter((g) => g.status === 'done').slice(0, 3).map((g) => (
              <button key={g.id} onClick={() => openGoal(g.id)} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-left hover:border-[#d4af37]/40">
                <div className="truncate text-sm font-bold text-zinc-100">{g.title}</div>
                <div className="mb-2 text-[10px] text-zinc-500">{teamName(g.team_id)} · {when(g.updated_at || g.created_at)} · {fmtUsd(g.cost)}</div>
                <p className="line-clamp-3 text-xs text-zinc-400">{g.result}</p>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- 3. Team Agent ----------
function TeamTab({ d, act, teamName }: { d: Mission; act: Act; teamName: (id: string | null) => string }) {
  const groups = Array.from(new Set(d.agents.map((a) => teamKey(a.team_id))));
  return (
    <div className="space-y-6">
      {groups.map((k) => {
        const teamId = k === GENERAL ? null : k;
        const team = d.teams.find((t) => t.id === teamId);
        const agents = d.agents.filter((a) => teamKey(a.team_id) === k).sort((a, b) => b.floor - a.floor || a.name.localeCompare(b.name));
        return (
          <section key={k} className="space-y-3">
            <div>
              <h2 className="font-serif text-lg font-extrabold text-zinc-100">{teamName(teamId)}</h2>
              {team?.mission && <p className="text-xs text-zinc-500">{team.mission}</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {agents.map((a) => {
                const st = d.agentStats[a.id] || { done: 0, failed: 0, active: 0, cost: 0 };
                const skills = d.skills.filter((s) => s.agent_ids.includes(a.id)).length;
                const notes = d.memories.filter((m) => teamKey(m.team_id) === k && (!m.agent_id || m.agent_id === a.id)).length;
                return (
                  <Card key={a.id} className={a.enabled ? '' : 'opacity-60'}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-[#d4af37]/10 p-2 text-[#d4af37]"><Bot className="h-5 w-5" /></div>
                        <div>
                          <div className="font-bold text-zinc-100">{a.name}</div>
                          <div className="text-[11px] text-zinc-500">{a.title} · Floor {a.floor}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => act(() => call('/api/ai-office/agent', 'PATCH', { id: a.id, enabled: !a.enabled }), `${a.name} switched ${a.enabled ? 'off' : 'on'}.`)}
                        className={`${btn} ${a.enabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-500'}`}
                      >
                        {a.enabled ? 'On' : 'Off'}
                      </button>
                    </div>
                    <div className="mt-3 font-mono text-[10px] text-zinc-500">{a.kind} · {a.model}</div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      {[
                        ['Done', st.done, 'text-emerald-300'],
                        ['Failed', st.failed, st.failed ? 'text-red-300' : 'text-zinc-300'],
                        ['Skills', skills, 'text-zinc-300'],
                        ['Notes', notes, 'text-zinc-300'],
                      ].map(([l, v, c]) => (
                        <div key={String(l)} className="rounded-lg border border-zinc-800 bg-zinc-950/60 py-1.5">
                          <div className={`text-sm font-extrabold ${c}`}>{v}</div>
                          <div className="text-[9px] uppercase tracking-wider text-zinc-500">{l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-right text-[10px] text-zinc-500">This month: <span className="font-mono text-zinc-300">{fmtUsd(st.cost)}</span></div>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="text-[11px] text-zinc-600">Teams are switched on in Virtual Office. A switched-off agent gets no new work.</p>
    </div>
  );
}

// ---------- 4. Task Board ----------
function BoardTab({ d, teamName, open }: { d: Mission; teamName: (id: string | null) => string; open: (id: string) => void }) {
  const cols: { key: string; label: string; match: (g: Goal) => boolean }[] = [
    { key: 'queued', label: 'Queued', match: (g) => g.status === 'queued' },
    { key: 'working', label: 'Working', match: (g) => WORKING.includes(g.status) },
    { key: 'done', label: 'Done', match: (g) => g.status === 'done' },
    { key: 'failed', label: 'Failed', match: (g) => g.status === 'failed' },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cols.map((c) => {
        const list = d.goals.filter(c.match);
        return (
          <div key={c.key} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{c.label}</span>
              <span className="rounded-full bg-zinc-800 px-2 text-[10px] font-bold text-zinc-300">{list.length}</span>
            </div>
            <div className="space-y-2">
              {list.length === 0 && <p className="py-6 text-center text-[11px] text-zinc-600">Empty</p>}
              {list.map((g) => {
                const done = g.subtasks.filter((s) => s.status === 'done').length;
                return (
                  <button key={g.id} onClick={() => open(g.id)} className="w-full rounded-xl border border-zinc-800 bg-[#0e0f14] p-3 text-left hover:border-[#d4af37]/40">
                    <div className="line-clamp-2 text-sm font-semibold text-zinc-100">{g.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                      <span>{teamName(g.team_id)}</span>
                      {g.schedule_id && <span className="rounded border border-[#d4af37]/30 px-1 text-[#d4af37]">calendar</span>}
                    </div>
                    {g.subtasks.length > 0 && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
                        <div className="h-full bg-[#d4af37]" style={{ width: `${(done / g.subtasks.length) * 100}%` }} />
                      </div>
                    )}
                    <div className="mt-2 flex justify-between text-[10px] text-zinc-500">
                      <span>{g.subtasks.length ? `${done}/${g.subtasks.length} parts` : <Status s={g.status} />}</span>
                      <span className="font-mono">{fmtUsd(g.cost)} · {when(g.created_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GoalDrawer({ g, teamName, agentName, act, onClose }: { g: Goal; teamName: (id: string | null) => string; agentName: (id: string | null) => string | null; act: Act; onClose: () => void }) {
  const canRetry = g.status === 'failed' || (g.status === 'done' && g.subtasks.some((s) => s.status === 'failed'));
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-[#d4af37]/20 bg-[#0b0c10] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-zinc-100">{g.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              <Status s={g.status} /> <span>{teamName(g.team_id)}</span> <span>· {when(g.created_at)}</span> <span>· {fmtUsd(g.cost)}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        {canRetry && (
          <button className={`${btnGold} mb-4`} onClick={() => act(() => call('/api/ai-office/retry', 'POST', { goalId: g.id }), 'Sent back to the queue. Open Virtual Office to let it run.')}>
            <RotateCcw className="h-3.5 w-3.5" /> Retry failed parts
          </button>
        )}

        <H>Brief</H>
        <p className="mb-5 whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">{g.instructions}</p>

        {g.result && (
          <>
            <H>Report</H>
            <p className="mb-5 whitespace-pre-wrap rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-zinc-200">{g.result}</p>
          </>
        )}
        {g.error && <p className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{g.error}</p>}

        <H>Parts ({g.subtasks.length})</H>
        <div className="space-y-2">
          {g.subtasks.map((s) => (
            <details key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-zinc-200">{s.seq}. {s.title}</span>
                <span className="flex shrink-0 items-center gap-2 text-zinc-500">{agentName(s.agent_id)} <Status s={s.status} /></span>
              </summary>
              <div className="mt-2 space-y-2 text-xs">
                {s.result && <p className="whitespace-pre-wrap text-zinc-300">{s.result.slice(0, 4000)}</p>}
                {s.qc_feedback && <p className="text-amber-300">QC: {s.qc_feedback}</p>}
                {s.error && <p className="text-red-300">{s.error}</p>}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- 5. Calendar ----------
function CalendarTab({ d, act, teamName }: { d: Mission; act: Act; teamName: (id: string | null) => string }) {
  const today = jakartaNow().day;
  const [month, setMonth] = useState(today.slice(0, 7)); // "YYYY-MM"
  const [picked, setPicked] = useState(today);
  const [form, setForm] = useState({ title: '', brief: '', teamId: '', cadence: 'weekly' as Cadence, weekday: 1, monthday: 1, runDate: today, runTime: '07:00' });

  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const shift = (n: number) => {
    const dt = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(dt.toISOString().slice(0, 7));
  };
  const onDay = (day: string) => d.schedules.filter((s) => runsOn(s, day));
  const pickedList = onDay(picked);

  const save = async () => {
    const ok = await act(() => call('/api/ai-office/schedule', 'POST', { ...form, teamId: form.teamId || d.teams[0]?.id || null }), 'Recurring job saved.');
    if (ok) setForm((f) => ({ ...f, title: '', brief: '' }));
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => shift(-1)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-bold text-zinc-100">{first.toLocaleDateString('id-ID', { timeZone: 'UTC', month: 'long', year: 'numeric' })}</span>
            <button onClick={() => shift(1)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-zinc-500">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((w) => <div key={w}>{w}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const n = onDay(day).length;
              const isToday = day === today;
              const isPicked = day === picked;
              return (
                <button
                  key={day}
                  onClick={() => setPicked(day)}
                  className={`relative flex h-10 flex-col items-center justify-center rounded-lg text-xs transition-colors ${
                    isPicked ? 'bg-[#d4af37] font-bold text-black' : isToday ? 'border border-[#d4af37]/50 text-[#f5d77f]' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {Number(day.slice(8))}
                  {n > 0 && (
                    <span className="mt-0.5 flex gap-0.5">
                      {Array.from({ length: Math.min(n, 3) }).map((_, k) => (
                        <span key={k} className={`h-1 w-1 rounded-full ${isPicked ? 'bg-black' : 'bg-[#d4af37]'}`} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <H>{new Date(`${picked}T12:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })}</H>
          {pickedList.length === 0 ? (
            <p className="text-xs text-zinc-500">Nothing runs this day.</p>
          ) : (
            <div className="space-y-2">
              {pickedList.map((s) => (
                <div key={s.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs">
                  <div className="font-semibold text-zinc-200">{s.run_time} · {s.title}</div>
                  <div className="text-[10px] text-zinc-500">{teamName(s.team_id)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <H>Recurring jobs ({d.schedules.length})</H>
          {d.schedules.length === 0 ? (
            <p className="text-xs text-zinc-500">None yet. Add one below.</p>
          ) : (
            <div className="divide-y divide-zinc-900">
              {d.schedules.map((s) => (
                <div key={s.id} className={`flex flex-wrap items-center justify-between gap-3 py-2.5 ${s.enabled ? '' : 'opacity-50'}`}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-100">{s.title}</div>
                    <div className="text-[11px] text-zinc-500">
                      <Clock className="mr-1 inline h-3 w-3" />{describeRule(s)} · {teamName(s.team_id)} · last run {when(s.last_run_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button className={btnGhost} title="Run now" onClick={() => act(() => call('/api/ai-office/schedule', 'POST', { action: 'run', id: s.id }), `"${s.title}" queued. Open Virtual Office to let it run.`)}>
                      <Play className="h-3.5 w-3.5" />
                    </button>
                    <button className={btnGhost} onClick={() => act(() => call('/api/ai-office/schedule', 'PATCH', { id: s.id, enabled: !s.enabled }))}>{s.enabled ? 'Pause' : 'Resume'}</button>
                    <button className={`${btn} border-red-500/30 bg-red-500/10 text-red-300`} title="Delete" onClick={() => confirm(`Delete "${s.title}"?`) && act(() => call(`/api/ai-office/schedule?id=${s.id}`, 'DELETE'), 'Deleted.')}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <H><Plus className="mr-1 inline h-3.5 w-3.5" /> New recurring job</H>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input className={input} placeholder="Title, e.g. Weekly SEO ideas" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select className={input} value={form.teamId || d.teams[0]?.id || ''} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
              {d.teams.filter((t) => t.enabled).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <textarea className={`${input} md:col-span-2`} rows={3} placeholder="The brief: what the team must do each time" value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} />
            <select className={input} value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value as Cadence })}>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
              <option value="once">Once</option>
            </select>
            <div className="flex gap-2">
              {form.cadence === 'weekly' && (
                <select className={input} value={form.weekday} onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}>
                  {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
                </select>
              )}
              {form.cadence === 'monthly' && (
                <input className={input} type="number" min={1} max={31} value={form.monthday} onChange={(e) => setForm({ ...form, monthday: Number(e.target.value) })} aria-label="Day of month" />
              )}
              {form.cadence === 'once' && <input className={input} type="date" value={form.runDate} onChange={(e) => setForm({ ...form, runDate: e.target.value })} />}
              <input className={`${input} w-28`} type="time" value={form.runTime} onChange={(e) => setForm({ ...form, runTime: e.target.value })} aria-label="Time (Jakarta)" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">Starts at the first check after this time: the daily 07:00 run, or when you open or refresh Mission Control.</p>
            <button className={btnGold} onClick={save}><Plus className="h-3.5 w-3.5" /> Save</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- 6. Activity ----------
function ActivityTab({ d, agentName, teamName, open }: { d: Mission; agentName: (id: string | null) => string | null; teamName: (id: string | null) => string; open: (id: string) => void }) {
  const [agent, setAgent] = useState('');
  const [q, setQ] = useState('');
  const list = d.events.filter((e) => (!agent || e.agent_id === agent) && (!q || e.message.toLowerCase().includes(q.toLowerCase())));
  return (
    <Card>
      <div className="mb-4 flex flex-wrap gap-2">
        <select className={`${input} w-56`} value={agent} onChange={(e) => setAgent(e.target.value)}>
          <option value="">All agents</option>
          {d.agents.map((a) => <option key={a.id} value={a.id}>{a.name} · {teamName(a.team_id)}</option>)}
        </select>
        <input className={`${input} w-64`} placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="self-center text-[11px] text-zinc-500">{list.length} of the latest {d.events.length}</span>
      </div>
      <div className="divide-y divide-zinc-900">
        {list.length === 0 && <p className="py-6 text-center text-xs text-zinc-500">Nothing yet.</p>}
        {list.map((e) => {
          const bad = /fail|could not|error|reached/i.test(e.message);
          return (
            <div key={e.id} className="flex items-start gap-3 py-2 text-xs">
              <span className="w-28 shrink-0 font-mono text-[10px] text-zinc-500">{when(e.created_at)}</span>
              {bad ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />}
              <span className="min-w-0 flex-1 text-zinc-300">
                {agentName(e.agent_id) && <span className="font-bold text-[#f5d77f]">{agentName(e.agent_id)} · </span>}
                {e.message}
              </span>
              {e.goal_id && d.goals.some((g) => g.id === e.goal_id) && (
                <button onClick={() => open(e.goal_id!)} className="shrink-0 text-[10px] font-bold uppercase text-zinc-500 hover:text-[#f5d77f]">Open</button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- 7. Memory / Knowledge ----------
function MemoryTab({ d, act, teamName, agentName }: { d: Mission; act: Act; teamName: (id: string | null) => string; agentName: (id: string | null) => string | null }) {
  const [form, setForm] = useState({ teamId: '', agentId: '', title: '', content: '', pinned: false });
  const [editing, setEditing] = useState<{ id: string; title: string; content: string } | null>(null);
  const teamAgents = d.agents.filter((a) => (a.team_id ?? '') === (form.teamId || d.teams[0]?.id || ''));
  const groups = useMemo(() => {
    const keys = Array.from(new Set([GENERAL, ...d.teams.map((t) => t.id)]));
    return keys.map((k) => ({ k, notes: d.memories.filter((m) => teamKey(m.team_id) === k) })).filter((g) => g.notes.length > 0);
  }, [d]);

  const save = async () => {
    const ok = await act(() => call('/api/ai-office/memory', 'POST', { ...form, teamId: form.teamId || d.teams[0]?.id || null, agentId: form.agentId || null }), 'Note saved. The team reads it from the next task.');
    if (ok) setForm((f) => ({ ...f, title: '', content: '', pinned: false }));
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
      <Card className="h-fit">
        <H><Plus className="mr-1 inline h-3.5 w-3.5" /> New note</H>
        <div className="space-y-3">
          <select className={input} value={form.teamId || d.teams[0]?.id || ''} onChange={(e) => setForm({ ...form, teamId: e.target.value, agentId: '' })}>
            {d.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className={input} value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}>
            <option value="">Whole team</option>
            {teamAgents.map((a) => <option key={a.id} value={a.id}>Only {a.name} ({a.title})</option>)}
          </select>
          <input className={input} placeholder="Title, e.g. Brand voice" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className={input} rows={6} placeholder="The fact or rule the agents must remember" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Pin (always read first)
          </label>
          <button className={btnGold} onClick={save}><Plus className="h-3.5 w-3.5" /> Save note</button>
          <p className="text-[11px] text-zinc-500">Agents only read notes of their own team. A note for one agent is read only by that agent.</p>
        </div>
      </Card>

      <div className="space-y-5">
        {groups.length === 0 && <Card><p className="text-xs text-zinc-500">No notes yet.</p></Card>}
        {groups.map(({ k, notes }) => (
          <section key={k} className="space-y-2">
            <h2 className="font-serif text-base font-extrabold text-zinc-100">{teamName(k === GENERAL ? null : k)} <span className="text-xs font-normal text-zinc-500">({notes.length})</span></h2>
            {notes.map((n) => (
              <Card key={n.id} className="p-3">
                {editing?.id === n.id ? (
                  <div className="space-y-2">
                    <input className={input} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                    <textarea className={input} rows={5} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
                    <div className="flex gap-2">
                      <button className={btnGold} onClick={async () => (await act(() => call('/api/ai-office/memory', 'PATCH', editing), 'Note updated.')) && setEditing(null)}>Save</button>
                      <button className={btnGhost} onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                        {n.pinned && <Pin className="h-3.5 w-3.5 text-[#d4af37]" />} {n.title}
                        <span className="text-[10px] font-normal text-zinc-500">{n.agent_id ? `only ${agentName(n.agent_id) || 'one agent'}` : 'whole team'}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-400">{n.content}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button className={btnGhost} title={n.pinned ? 'Unpin' : 'Pin'} onClick={() => act(() => call('/api/ai-office/memory', 'PATCH', { id: n.id, pinned: !n.pinned }))}>
                        {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </button>
                      <button className={btnGhost} onClick={() => setEditing({ id: n.id, title: n.title, content: n.content })}>Edit</button>
                      <button className={`${btn} border-red-500/30 bg-red-500/10 text-red-300`} title="Delete" onClick={() => confirm(`Delete "${n.title}"?`) && act(() => call(`/api/ai-office/memory?id=${n.id}`, 'DELETE'), 'Deleted.')}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

