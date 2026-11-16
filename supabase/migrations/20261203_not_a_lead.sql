-- Chats that are not leads (a verification code, a company's automatic greeting, or marked by hand): the bot stays quiet, no lead is made, and they stay out
-- of the inbox tabs, the statistics, the follow-ups and the broadcasts. They are listed under "Ignored" so they can be given back.
ALTER TABLE public.chat_state ADD COLUMN IF NOT EXISTS ignored BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.chat_state ADD COLUMN IF NOT EXISTS ignored_reason TEXT;

CREATE OR REPLACE FUNCTION public.chat_nudge_candidates(p_since TIMESTAMPTZ)
RETURNS TABLE (workspace_id UUID, group_id UUID, wa_id TEXT, name TEXT, last_in TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.workspace_id, g.id, g.wa_id, g.name, li.last_in
  FROM wa_groups g
  JOIN wa_devices d ON d.id = g.device_id AND d.role = 'sales' AND d.active AND d.phone !~ '^(ig|fb):'
  JOIN wa_bot_config c ON c.workspace_id = g.workspace_id AND c.nudge_enabled
  CROSS JOIN LATERAL (SELECT max(m.sent_at) AS last_in FROM wa_messages m WHERE m.group_id = g.id AND NOT m.is_from_me) li
  WHERE NOT g.is_group AND g.wa_id ~ '^\d{8,16}$' AND g.last_message_at >= p_since
    AND li.last_in >= p_since
    AND EXISTS (SELECT 1 FROM wa_messages m WHERE m.group_id = g.id AND m.is_from_me AND m.sent_at > li.last_in)
    AND NOT EXISTS (SELECT 1 FROM chat_meetings x WHERE x.group_id = g.id)
    AND NOT EXISTS (SELECT 1 FROM chat_optouts o WHERE o.workspace_id = g.workspace_id AND o.wa_id = g.wa_id)
    AND NOT EXISTS (SELECT 1 FROM wa_bot_chats b WHERE b.group_id = g.id AND b.status IN ('human', 'off'))
    AND NOT EXISTS (SELECT 1 FROM chat_state s WHERE s.group_id = g.id AND s.ignored)
  ORDER BY li.last_in
  LIMIT 300;
$$;
REVOKE ALL ON FUNCTION public.chat_nudge_candidates(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_nudge_candidates(TIMESTAMPTZ) TO service_role;
