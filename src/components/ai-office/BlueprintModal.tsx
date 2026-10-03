'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Rocket, X } from 'lucide-react';

interface BAgent { name: string; title: string; role: string; provider: string; model: string; job_desk: string; skill_name: string }
interface BTask { title: string; brief: string; agent: string }
interface Blueprint { name: string; mission: string; workflow: string; agents: BAgent[]; tasks: BTask[] }

const MODELS: [string, string][] = [
  ['claude-opus-5-5', 'Claude Opus 5.5 (deep, $$$)'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 ($$)'],
  ['claude-haiku-4-5', 'Claude Haiku 4.5 (cheap, web search)'],
  ['gemini-3.8-flash', 'Gemini 3.8 Flash (cheap)'],
  ['openai/gpt-oss-20b', 'Groq gpt-oss-20b (very cheap)'],
  ['qwen/qwen3.8-27b:free', 'Qwen 3.8 27B (free, OpenRouter)'],
  ['glm-4.5-flash', 'GLM 4.5 Flash (free, z.ai)'],
  ['deepseek-chat', 'DeepSeek Chat (very cheap, China servers)'],
];
const ROLES: [string, string][] = [
  ['lead', 'Lead (plans the work)'],
  ['researcher', 'Researcher (web search)'],
  ['writer', 'Writer'],
  ['editor', 'Editor / quality control'],
  ['worker', 'Worker'],
];

const field = 'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-[#d4af37]/50 focus:outline-none';
const label = 'text-[10px] font-bold uppercase tracking-wider text-zinc-500';

async function request(method: string, body: unknown) {
  const res = await fetch('/api/ai-office/blueprint', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

/** Preview of a team read from a Scout Team report. Editable. Nothing exists until "Create team". */
export function BlueprintModal({ goalId, onClose, onCreated }: { goalId: string; onClose: () => void; onCreated: (name: string) => void }) {
  const [bp, setBp] = useState<Blueprint | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    request('POST', { goalId })
      .then((j) => alive && setBp(j.blueprint))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [goalId]);

  const setAgent = (i: number, patch: Partial<BAgent>) => setBp((b) => b && { ...b, agents: b.agents.map((a, k) => (k === i ? { ...a, ...patch } : a)) });
  const setTask = (i: number, patch: Partial<BTask>) => setBp((b) => b && { ...b, tasks: b.tasks.map((t, k) => (k === i ? { ...t, ...patch } : t)) });

  const create = async () => {
    if (!bp) return;
    setSaving(true);
    setError('');
    try {
      await request('PUT', { blueprint: bp });
      onCreated(bp.name);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[#d4af37]/20 bg-[#0b0c10]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-zinc-800 bg-zinc-900/90 p-4 backdrop-blur">
          <div>
            <h2 className="font-serif text-lg font-extrabold text-zinc-100">Create this team</h2>
            <p className="text-xs text-zinc-500">Check and edit. Nothing is created until you press Create team.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        {!bp && !error && (
          <div className="flex items-center justify-center gap-2 p-16 text-sm text-zinc-400"><Loader2 className="h-5 w-5 animate-spin" /> Reading the recommendation...</div>
        )}
        {error && <p className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}

        {bp && (
          <div className="space-y-5 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1"><span className={label}>Team name</span>
                <input className={field} value={bp.name} onChange={(e) => setBp({ ...bp, name: e.target.value })} />
              </label>
              <label className="space-y-1"><span className={label}>Mission</span>
                <input className={field} value={bp.mission} onChange={(e) => setBp({ ...bp, mission: e.target.value })} />
              </label>
            </div>
            <label className="block space-y-1"><span className={label}>Workflow</span>
              <textarea rows={Math.min(8, Math.max(3, bp.workflow.split('\n').length))} className={field} value={bp.workflow} onChange={(e) => setBp({ ...bp, workflow: e.target.value })} />
            </label>

            <div>
              <div className={`${label} mb-2`}>Agents ({bp.agents.length}) · each gets a hexagon pod, a job desk and one skill</div>
              <div className="space-y-3">
                {bp.agents.map((a, i) => (
                  <div key={i} className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                    <div className="grid gap-2 sm:grid-cols-4">
                      <input className={field} value={a.name} onChange={(e) => setAgent(i, { name: e.target.value })} aria-label="Name" />
                      <input className={`${field} sm:col-span-1`} value={a.title} onChange={(e) => setAgent(i, { title: e.target.value })} aria-label="Role title" />
                      <select className={field} value={a.role} onChange={(e) => setAgent(i, { role: e.target.value })} aria-label="Role">
                        {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <select className={field} value={a.model} onChange={(e) => setAgent(i, { model: e.target.value })} aria-label="Model">
                        {MODELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <textarea rows={4} className={field} value={a.job_desk} onChange={(e) => setAgent(i, { job_desk: e.target.value })} placeholder="Job desk" />
                    <div className="text-[10px] text-zinc-500">Skill: <span className="text-zinc-300">{a.skill_name}</span></div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className={`${label} mb-2`}>Starter tasks ({bp.tasks.length}) · run them from the Team Agent page</div>
              <div className="space-y-2">
                {bp.tasks.map((t, i) => (
                  <div key={i} className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                    <input className={field} value={t.title} onChange={(e) => setTask(i, { title: e.target.value })} aria-label="Task title" />
                    <textarea rows={3} className={field} value={t.brief} onChange={(e) => setTask(i, { brief: e.target.value })} aria-label="Task brief" />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={create}
              disabled={saving || !bp.name.trim() || bp.agents.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f5d77f] py-2.5 font-bold text-black disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Create team
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
