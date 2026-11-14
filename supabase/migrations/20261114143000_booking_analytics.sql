-- JVerse booking, rescheduling, and privacy-conscious analytics migration.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS preferred_date DATE,
  ADD COLUMN IF NOT EXISTS preferred_time TIME,
  ADD COLUMN IF NOT EXISTS calendar_uid TEXT,
  ADD COLUMN IF NOT EXISTS reschedule_token_hash TEXT;

CREATE INDEX IF NOT EXISTS contacts_reschedule_token_hash_idx
  ON public.contacts (reschedule_token_hash)
  WHERE reschedule_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL CHECK (char_length(event_name) BETWEEN 1 AND 80),
  path TEXT NOT NULL CHECK (char_length(path) BETWEEN 1 AND 240),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON public.analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_name_created_at_idx
  ON public.analytics_events (event_name, created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.analytics_events FROM anon, authenticated;
GRANT ALL ON TABLE public.analytics_events TO service_role;
