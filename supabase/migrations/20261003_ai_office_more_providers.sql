-- Allow AI Office agents to use OpenRouter and z.ai (GLM).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.ai_agents'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%provider%'
  LOOP
    EXECUTE format('ALTER TABLE public.ai_agents DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE public.ai_agents
    ADD CONSTRAINT ai_agents_provider_check
    CHECK (provider IN ('anthropic', 'groq', 'gemini', 'openrouter', 'zai'));
END $$;
