'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Send, Loader2, AlertTriangle, CheckCircle2, XCircle, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import type { RobotView } from '@/components/ai-office/Office3D';
import { costUsd } from '@/lib/ai/costs';

// three.js only loads in the browser, and only when this page is opened.
const Office3D = dynamic(() => import('@/components/ai-office/Office3D'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Building the office...
    </div>
  ),
});

interface Agent {
  id: string;
  name: string;
  title: string;
  floor: number;
  team_id: string | null;
  kind: 'planner' | 'qc' | 'worker' | 'researcher' | 'installer';
  provider: 'anthropic' | 'groq' | 'gemini' | 'openrouter' | 'zai' | 'deepseek';
  model: string;
}

interface Task {
  id: string;
  team_id: string | null;
  seq: number;
  title: string;
  instructions: string;
  floor: number | null;
  agent_id: string | null;
  status: 'queued' | 'planning' | 'running' | 'review' | 'reviewing' | 'done' | 'failed';
  deep_think: boolean;
  result: string | null;
  qc_feedback: string | null;
  error: string | null;
  attempts: number;
  model_used: string | null;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}

interface Goal extends Task {
  subtasks: Task[];
}

interface OfficeEvent {
  id: string;
  goal_id: string | null;
  agent_id: string | null;
  message: string;
  created_at: string;
}

interface Team {
  id: string;
  slug: string;
  name: string;
  mission: string;
  enabled: boolean;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  suited_for: string;
  instructions: string;
  created_by: string | null;
  agent_ids: string[];
}

interface OfficeState {
  setup: { tables: boolean; teams: boolean; anthropic: boolean; groq: boolean; gemini: boolean; openrouter: boolean; zai: boolean; deepseek: boolean };
  agents: Agent[];
  teams: Team[];
  skills: Skill[];
  goals: Goal[];
  events: OfficeEvent[];
  active: boolean;
}

type RobotState = 'idle' | 'working' | 'waiting';

const FLOORS: { floor: number; name: string; blurb: string; hood: string; eye: string; shoe: string }[] = [
  { floor: 3, name: 'Floor 3 · Boss Office', blurb: 'Thinkers: plan the work and check quality', hood: '#d4af37', eye: '#fff7d6', shoe: '#f5d77f' },
  { floor: 2, name: 'Floor 2 · Specialists', blurb: 'Work that needs judgment', hood: '#71717a', eye: '#fda4af', shoe: '#fecdd3' },
  { floor: 1, name: 'Floor 1 · Doers', blurb: 'Simple, repeatable work', hood: '#dc2626', eye: '#38bdf8', shoe: '#ef4444' },
];

// One price table for the whole AI Office (estimate).
const estimateUsd = (model: string | null, tin: number, tout: number) => costUsd(model, tin, tout);

function goalCost(g: { model_used: string | null; tokens_in: number; tokens_out: number; subtasks: Task[] }): number {
  return (
    estimateUsd(g.model_used, g.tokens_in, g.tokens_out) +
    g.subtasks.reduce((sum, s) => sum + estimateUsd(s.model_used, s.tokens_in, s.tokens_out), 0)
  );
}

const STATUS_LABEL: Record<Task['status'], string> = {
  queued: 'Waiting',
  planning: 'Boss planning',
  running: 'In progress',
  review: 'Waiting for QC',
  reviewing: 'QC checking',
  done: 'Done',
  failed: 'Failed',
};

function Robot({ hood, eye, shoe, state }: { hood: string; eye: string; shoe: string; state: RobotState }) {
  const lit = state === 'working';
  return (
    <svg viewBox="0 0 64 80" className={`w-14 h-[70px] ${lit ? 'animate-bounce' : ''}`} style={lit ? { animationDuration: '1.4s' } : undefined} aria-hidden>
      <path d="M32 3C18 3 8 13 8 27v11c0 3 2 5 5 5h38c3 0 5-2 5-5V27C56 13 46 3 32 3z" fill={hood} />
      <ellipse cx="32" cy="28" rx="17" ry="15" fill="#0b0c10" />
      <rect x="22" y="23" width="6" height={state === 'idle' ? 4 : 10} rx="3" fill={eye} opacity={state === 'idle' ? 0.45 : 1} className={lit ? 'animate-pulse' : ''} />
      <rect x="36" y="23" width="6" height={state === 'idle' ? 4 : 10} rx="3" fill={eye} opacity={state === 'idle' ? 0.45 : 1} className={lit ? 'animate-pulse' : ''} />
      <path d="M14 47c0-4 3-7 7-7h22c4 0 7 3 7 7v15c0 3-2 5-5 5H19c-3 0-5-2-5-5z" fill={hood} />
      <path d="M28 43v8M36 43v8" stroke={eye} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <rect x="21" y="66" width="8" height="8" rx="2" fill="#18181b" />
      <rect x="35" y="66" width="8" height="8" rx="2" fill="#18181b" />
      <rect x="18" y="72" width="13" height="6" rx="3" fill={shoe} />
      <rect x="33" y="72" width="13" height="6" rx="3" fill={shoe} />
    </svg>
  );
}

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function OfficeView() {
  const [state, setState] = useState<OfficeState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brief, setBrief] = useState('');
  const [deepThink, setDeepThink] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const ticking = useRef(false);
  const [view, setView] = useState<'3d' | '2d'>('3d');
  const [webglOk, setWebglOk] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      setWebglOk(Boolean(c.getContext('webgl2') || c.getContext('webgl')));
    } catch {
      setWebglOk(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-office/state', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 403 ? 'Only the Founder or a Superadmin can open the AI Office.' : `Could not load the office (${res.status}).`);
      const json: OfficeState = await res.json();
      setState(json);
      setLoadError(null);
      return json;
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load the office.');
      return null;
    }
  }, []);

  const activateCreator = async () => {
    setActivating(true);
    setTeamError(null);
    try {
      const res = await fetch('/api/ai-office/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'scout-team' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not activate the team.');
      const fresh = await refresh();
      const team = fresh?.teams.find((t) => t.slug === 'scout-team');
      if (team) setTeamId(team.id);
    } catch (err: any) {
      setTeamError(err?.message || 'Could not activate the team.');
    } finally {
      setActivating(false);
    }
  };

  const retryFailed = async (goalId: string) => {
    setRetryError(null);
    try {
      const res = await fetch('/api/ai-office/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not retry.');
      await refresh();
      runLoop();
    } catch (err: any) {
      setRetryError(err?.message || 'Could not retry.');
    }
  };

  // The work loop: one short step per request while any brief is open.
  const runLoop = useCallback(async () => {
    if (ticking.current) return;
    ticking.current = true;
    try {
      let active = true;
      let failures = 0;
      while (active && failures < 3) {
        try {
          const res = await fetch('/api/ai-office/tick', { method: 'POST' });
          if (!res.ok) throw new Error(String(res.status));
          active = Boolean((await res.json()).active);
          failures = 0;
        } catch {
          failures++;
        }
        await refresh();
        await new Promise((r) => setTimeout(r, 700));
      }
    } finally {
      ticking.current = false;
    }
  }, [refresh]);

  useEffect(() => {
    refresh().then((s) => {
      if (s?.active) runLoop();
    });
  }, [refresh, runLoop]);

  // Keep the robots moving while a step is running on the server.
  useEffect(() => {
    if (!state?.active) return;
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [state?.active, refresh]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSending(true);
    try {
      const res = await fetch('/api/ai-office/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, deepThink, teamId: activeTeam ? activeTeam.id : null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not send the brief.');
      setBrief('');
      setOpenGoalId(json.id);
      await refresh();
      runLoop();
    } catch (err: any) {
      setFormError(err?.message || 'Could not send the brief.');
    } finally {
      setSending(false);
    }
  };

  if (loadError) {
    return (
      <div className="bg-[#0e0f14] border border-red-500/30 rounded-xl p-5 flex items-start gap-3 text-sm text-zinc-300">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" /> {loadError}
      </div>
    );
  }
  if (!state) {
    return <div className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="w-4 h-4 animate-spin" /> Opening the office...</div>;
  }

  const { setup, teams, skills } = state;
  const ready = setup.tables && setup.anthropic;
  const activeTeam = teams.find((t) => t.id === teamId) || teams[0] || null;
  const inTeam = (x: { team_id: string | null }) => (x.team_id ?? null) === (activeTeam ? activeTeam.id : null);
  const agents = state.agents.filter(inTeam);
  const goals = state.goals.filter(inTeam);
  const goalIds = new Set(goals.map((g) => g.id));
  const events = state.events.filter((ev) => (ev.goal_id ? goalIds.has(ev.goal_id) : !activeTeam));
  const openGoals = goals.filter((g) => !['done', 'failed'].includes(g.status));
  const creatorActive = teams.some((t) => t.slug === 'scout-team');

  // Every team has its own island, so each agent reads the work of ITS team.
  const teamWork = (teamId: string | null) => {
    const tg = state.goals.filter((g) => (g.team_id ?? null) === (teamId ?? null));
    return { open: tg.filter((g) => !['done', 'failed'].includes(g.status)), subs: tg.flatMap((g) => g.subtasks) };
  };
  const robotState = (a: Agent): RobotState => {
    const { open, subs } = teamWork(a.team_id);
    const qc = state.agents.some((x) => (x.team_id ?? null) === (a.team_id ?? null) && x.kind === 'qc');
    if (a.kind === 'planner') return open.some((g) => g.status === 'planning' || (!qc && g.status === 'reviewing')) ? 'working' : 'idle';
    if (a.kind === 'qc') return open.some((g) => g.status === 'reviewing') ? 'working' : 'idle';
    const mine = subs.filter((s) => s.agent_id === a.id);
    if (mine.some((s) => s.status === 'running')) return 'working';
    if (mine.some((s) => s.status === 'queued')) return 'waiting';
    return 'idle';
  };
  const currentTask = (a: Agent) => teamWork(a.team_id).subs.find((s) => s.agent_id === a.id && (s.status === 'running' || s.status === 'queued'));
  const brainLabel = (a: Agent) => {
    if (a.provider === 'anthropic') return a.model;
    return setup[a.provider] ? a.model : 'claude-haiku-4-5 (stand-in)';
  };
  const agentName = (id: string | null) => agents.find((a) => a.id === id)?.name || 'Unassigned';

  const robotViews: RobotView[] = state.agents.map((a) => ({
    id: a.id,
    teamId: a.team_id,
    name: a.name,
    title: a.title,
    floor: a.floor,
    kind: a.kind,
    state: robotState(a),
    task: currentTask(a)?.title || null,
    brain: brainLabel(a),
  }));
  const selectedRobot = robotViews.find((r) => r.id === selectedId) || null;

  return (
    <div className="space-y-6">
      {/* Teams */}
      <div className="rounded-2xl border border-zinc-800 bg-[#0e0f14] p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTeamId(t.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${activeTeam?.id === t.id ? 'bg-[#d4af37] text-black border-[#d4af37]' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'}`}
            >
              {t.name}
            </button>
          ))}
        </div>
        {activeTeam && <p className="text-xs text-zinc-400">{activeTeam.mission}</p>}
        {!creatorActive && (
          <div className="rounded-xl border border-dashed border-[#d4af37]/40 p-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="text-xs font-bold text-zinc-100">AI Scout Team <span className="text-zinc-500 font-normal">· not activated</span></div>
              <div className="text-[11px] text-zinc-400 mt-0.5">Jax (lead) with Rex (researches AI models and APIs) and Gil (finds skills on GitHub). Tell it the job you want a team for; it recommends the team.</div>
              {!setup.teams && <div className="text-[11px] text-amber-300 mt-1">Run <span className="font-mono">supabase/migrations/20260930_ai_teams.sql</span> in Supabase first.</div>}
              {teamError && <div className="text-[11px] text-red-400 mt-1">{teamError}</div>}
            </div>
            <button
              type="button"
              disabled={!ready || !setup.teams || activating}
              onClick={activateCreator}
              className="px-4 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider text-[#111] bg-gradient-to-r from-[#d4af37] to-[#f5d77f] disabled:opacity-40 inline-flex items-center gap-2"
            >
              {activating && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Activate team
            </button>
          </div>
        )}
      </div>

      {/* Setup checklist */}
      {(!setup.tables || !setup.anthropic || !setup.groq || !setup.gemini) && (
        <div className={`rounded-xl border p-4 text-xs space-y-1.5 ${ready ? 'border-zinc-800 bg-zinc-900/30' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <div className="font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${ready ? 'text-zinc-500' : 'text-amber-400'}`} /> Office setup
          </div>
          {!setup.tables && <p className="text-amber-200">Database tables are missing. Run <span className="font-mono">supabase/migrations/20260930_ai_office.sql</span> in the Supabase SQL editor.</p>}
          {!setup.anthropic && <p className="text-amber-200">Required: set <span className="font-mono">ANTHROPIC_API_KEY</span> (the boss runs on Claude), then redeploy.</p>}
          {setup.tables && setup.anthropic && !setup.groq && <p className="text-zinc-400">Optional: <span className="font-mono">GROQ_API_KEY</span> is not set, so Floor 1 uses Claude Haiku as a stand-in.</p>}
          {setup.tables && setup.anthropic && !setup.gemini && <p className="text-zinc-400">Optional: <span className="font-mono">GEMINI_API_KEY</span> is not set, so Floor 2 uses Claude Haiku as a stand-in.</p>}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* The building */}
        <div className="xl:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {view === '3d' ? 'Scroll to zoom · drag to rotate · click an island or a robot' : 'Floors'}
            </span>
            {webglOk && (
              <div className="inline-flex rounded-lg border border-zinc-800 overflow-hidden text-[10px] font-bold uppercase tracking-wider">
                {(['3d', '2d'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`px-3 py-1 ${view === v ? 'bg-[#d4af37] text-black' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
                  >
                    {v === '3d' ? '3D office' : '2D floors'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {view === '3d' && webglOk ? (
            <>
              <div className="relative h-[62vh] min-h-[440px] rounded-2xl border border-[#d4af37]/20 bg-[#07080d] overflow-hidden shadow-lg">
                <Office3D robots={robotViews} teams={teams.map((t) => ({ id: t.id, name: t.name }))} focusTeamId={activeTeam ? activeTeam.id : null} selectedId={selectedId} onSelect={setSelectedId} onFocusTeam={setTeamId} />
              </div>
              {selectedRobot && (
                <div className="rounded-xl border border-[#d4af37]/30 bg-[#0e0f14] p-3 text-xs flex flex-wrap items-center gap-x-6 gap-y-1">
                  <span className="font-bold text-zinc-100">{selectedRobot.name}</span>
                  <span className="text-zinc-400">{selectedRobot.title} · Floor {selectedRobot.floor}</span>
                  <span className="font-mono text-zinc-500">{selectedRobot.brain}</span>
                  <span className={selectedRobot.state === 'working' ? 'text-emerald-400' : selectedRobot.state === 'waiting' ? 'text-amber-400' : 'text-zinc-500'}>
                    {selectedRobot.state === 'working' ? `Working: ${selectedRobot.task}` : selectedRobot.state === 'waiting' ? `Next up: ${selectedRobot.task}` : 'Idle, taking a break'}
                  </span>
                </div>
              )}
            </>
          ) : (
        <div className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] overflow-hidden shadow-lg">
          {FLOORS.map((f) => {
            const team = agents.filter((a) => a.floor === f.floor);
            return (
              <div key={f.floor} className="border-b border-zinc-800/80 last:border-b-0">
                <div className="px-4 pt-3 flex items-baseline justify-between gap-3">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: f.hood }}>{f.name}</h3>
                  <span className="text-[10px] text-zinc-500 text-right">{f.blurb}</span>
                </div>
                <div className="px-4 pb-4 pt-3 flex flex-wrap gap-3 min-h-[120px] bg-gradient-to-b from-transparent to-black/30">
                  {team.length === 0 && <span className="text-xs text-zinc-600 self-center">No robots on this floor yet.</span>}
                  {team.map((a) => {
                    const rs = robotState(a);
                    const task = currentTask(a);
                    return (
                      <div key={a.id} className={`w-[118px] rounded-xl border px-2 pt-2 pb-2.5 flex flex-col items-center text-center transition-colors ${rs === 'working' ? 'border-[#d4af37]/60 bg-[#d4af37]/5' : 'border-zinc-800 bg-black/20'}`}>
                        <Robot hood={f.hood} eye={f.eye} shoe={f.shoe} state={rs} />
                        <div className="text-xs font-bold text-zinc-100 mt-1">{a.name}</div>
                        <div className="text-[9px] text-zinc-500 leading-tight">{a.title}</div>
                        <div className="text-[9px] font-mono text-zinc-600 truncate w-full" title={brainLabel(a)}>{brainLabel(a)}</div>
                        <div className={`mt-1 text-[9px] font-bold uppercase tracking-wider ${rs === 'working' ? 'text-emerald-400' : rs === 'waiting' ? 'text-amber-400' : 'text-zinc-600'}`}>
                          {rs === 'working' ? 'Working' : rs === 'waiting' ? 'Next up' : 'Idle'}
                        </div>
                        {task && <div className="text-[9px] text-zinc-400 truncate w-full" title={task.title}>{task.title}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
          )}
        </div>

        {/* Brief + activity */}
        <div className="xl:col-span-2 space-y-6">
          <form onSubmit={submit} className="rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">{activeTeam ? `Brief ${activeTeam.name}` : 'Brief the boss'}</h3>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={5}
              disabled={!ready || sending}
              placeholder="Describe what you want done. Include every fact the team needs: the robots cannot read ERP data yet."
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#d4af37] disabled:opacity-50"
            />
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
              <input type="checkbox" checked={deepThink} onChange={(e) => setDeepThink(e.target.checked)} className="accent-[#d4af37]" />
              <Brain className="w-3.5 h-3.5 text-[#d4af37]" /> Deep think (boss uses Opus instead of Sonnet; slower, costs more)
            </label>
            <p className="text-[11px] text-zinc-500">
              Goes to: <span className="font-bold text-[#f5d77f]">{activeTeam ? activeTeam.name : 'no team yet'}</span>
              {!activeTeam && ' · activate the AI Scout Team above first.'}
            </p>
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <button
              type="submit"
              disabled={!ready || sending || !activeTeam || brief.trim().length < 5}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider text-[#111] bg-gradient-to-r from-[#d4af37] to-[#f5d77f] disabled:opacity-40"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send to the lead
            </button>
          </form>

          <div className="rounded-2xl border border-zinc-800 bg-[#0e0f14] overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 text-xs font-bold uppercase tracking-wider text-white">Activity</div>
            <div className="max-h-64 overflow-y-auto divide-y divide-zinc-800/60">
              {events.length === 0 && <div className="p-4 text-xs text-zinc-500">Nothing has happened yet.</div>}
              {events.map((ev) => (
                <div key={ev.id} className="px-4 py-2 text-xs flex gap-3">
                  <span className="font-mono text-zinc-600 shrink-0">{timeLabel(ev.created_at)}</span>
                  <span className="text-zinc-300">{ev.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Briefs */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">Briefs</h3>
        {goals.length === 0 && <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">No briefs yet. Send one to the boss to see the office work.</div>}
        {goals.map((g) => {
          const open = openGoalId === g.id;
          const done = g.subtasks.filter((s) => s.status === 'done' || s.status === 'review').length;
          return (
            <div key={g.id} className="rounded-xl border border-zinc-800 bg-[#0e0f14] overflow-hidden">
              <button type="button" onClick={() => setOpenGoalId(open ? null : g.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-zinc-900/40">
                {g.status === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : g.status === 'failed' ? <XCircle className="w-4 h-4 text-red-400 shrink-0" /> : <Loader2 className="w-4 h-4 text-[#d4af37] animate-spin shrink-0" />}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-zinc-100 truncate">{g.title}</span>
                  <span className="block text-[10px] text-zinc-500">
                    {STATUS_LABEL[g.status]}{g.subtasks.length > 0 ? ` · ${done}/${g.subtasks.length} subtasks` : ''}{g.deep_think ? ' · deep think' : ''}{g.tokens_in + g.subtasks.reduce((n, s) => n + s.tokens_in, 0) > 0 ? ` · ≈ $${goalCost(g).toFixed(2)} + web searches` : ''}
                  </span>
                </span>
                {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
              </button>

              {open && (
                <div className="border-t border-zinc-800 p-4 space-y-4">
                  {g.error && <p className="text-xs text-red-400">Error: {g.error}</p>}
                  {['done', 'failed'].includes(g.status) && (g.status === 'failed' || g.subtasks.some((st) => st.status === 'failed')) && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => retryFailed(g.id)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider text-[#111] bg-gradient-to-r from-[#d4af37] to-[#f5d77f]"
                      >
                        Retry failed parts
                      </button>
                      <span className="text-[11px] text-zinc-500">
                        {g.subtasks.filter((st) => st.status === 'failed').length || 'The'} part(s) failed. Only those run again, then the boss rewrites the report.
                      </span>
                      {retryError && <span className="text-[11px] text-red-400">{retryError}</span>}
                    </div>
                  )}
                  {g.result && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37] mb-1">Report from the boss</div>
                      <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{g.result}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Your brief</div>
                    <div className="text-xs text-zinc-400 whitespace-pre-wrap">{g.instructions}</div>
                  </div>
                  {g.subtasks.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Subtasks</div>
                      {g.subtasks.map((s) => {
                        const taskOpen = openTaskId === s.id;
                        return (
                          <div key={s.id} className="rounded-lg border border-zinc-800 bg-black/20">
                            <button type="button" onClick={() => setOpenTaskId(taskOpen ? null : s.id)} className="w-full px-3 py-2 flex items-center gap-3 text-left text-xs">
                              <span className="font-mono text-zinc-600">{s.seq}</span>
                              <span className="flex-1 min-w-0 truncate text-zinc-200">{s.title}</span>
                              <span className="text-zinc-500 shrink-0">{agentName(s.agent_id)} · F{s.floor}</span>
                              <span className={`shrink-0 font-bold uppercase text-[9px] tracking-wider ${s.status === 'done' ? 'text-emerald-400' : s.status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}>{STATUS_LABEL[s.status]}</span>
                            </button>
                            {taskOpen && (
                              <div className="border-t border-zinc-800 px-3 py-2 space-y-2 text-xs">
                                <div className="text-zinc-500 whitespace-pre-wrap"><span className="font-bold text-zinc-400">Instructions: </span>{s.instructions}</div>
                                {s.result && <div className="text-zinc-200 whitespace-pre-wrap"><span className="font-bold text-zinc-400">Result: </span>{s.result}</div>}
                                {s.qc_feedback && <div className="text-amber-300 whitespace-pre-wrap"><span className="font-bold">QC note: </span>{s.qc_feedback}</div>}
                                {s.error && <div className="text-red-400">Error: {s.error}</div>}
                                <div className="font-mono text-[10px] text-zinc-600">{s.model_used || 'not run yet'} · attempts {s.attempts} · tokens {s.tokens_in} in / {s.tokens_out} out</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="font-mono text-[10px] text-zinc-600">Boss tokens: {g.tokens_in} in / {g.tokens_out} out</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Skill library */}
      {(creatorActive || skills.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Skill library ({skills.length})</h3>
          {skills.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
              No skills yet. Ask the AI Team Creator to research and write skills for an agent; Forge saves and installs them here.
            </div>
          )}
          {skills.map((sk) => (
            <div key={sk.id} className="rounded-xl border border-zinc-800 bg-[#0e0f14] p-3 text-xs space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-bold text-zinc-100">{sk.name}</span>
                <span className="text-zinc-500">{sk.description}</span>
                {sk.created_by && <span className="font-mono text-[10px] text-zinc-600">by {sk.created_by}</span>}
              </div>
              {sk.suited_for && <div className="text-zinc-400">Good for: {sk.suited_for}</div>}
              <div className="text-[#f5d77f]">
                Installed in: {sk.agent_ids.length === 0 ? 'nobody yet' : sk.agent_ids.map((id) => state.agents.find((a) => a.id === id)?.name || 'unknown').join(', ')}
              </div>
              <details className="text-zinc-500">
                <summary className="cursor-pointer">Read the skill</summary>
                <div className="mt-1 whitespace-pre-wrap text-zinc-300">{sk.instructions}</div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
