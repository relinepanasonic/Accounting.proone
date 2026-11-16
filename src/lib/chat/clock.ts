import { resumeDueWaits, tickKeyOk } from './flows';
import { runBroadcasts, runColdBroadcast } from './broadcasts';
import { runMeetingMessages } from './meetings';
import { runNudges } from './nudges';
import { runLostSweep } from './pipeline';

/**
 * The once-a-minute clock (called by the database while something is due, with a key only the database holds):
 * flows whose Wait is over go on, the next broadcast message goes out, and leads get the meeting confirmation (an hour before) and reminder (15 minutes before), and quiet leads get their follow-up nudge.
 * Each part runs on its own: one failing never stops the others.
 */
export async function runClock(key: string | null): Promise<{ ok: true; resumed: number; broadcast: number; reminders: number; nudges: number; lost: number } | { ok: false; status: number; error: string }> {
  if (!(await tickKeyOk(key))) return { ok: false, status: 401, error: 'Not allowed.' };
  const safe = async (f: () => Promise<number>, what: string) => { try { return await f(); } catch (e) { console.error(`clock: ${what} failed`, e); return 0; } };
  const [resumed, broadcast, reminders, nudges, lost] = await Promise.all([safe(resumeDueWaits, 'waits'), safe(async () => { await runColdBroadcast(); return runBroadcasts(); }, 'broadcasts'), safe(runMeetingMessages, 'meeting messages'), safe(() => runNudges(), 'nudges'), safe(() => runLostSweep(), 'lost sweep')]);
  return { ok: true, resumed, broadcast, reminders, nudges, lost };
}
