CREATE TABLE public.care_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  detail TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX care_alerts_user_created_idx ON public.care_alerts (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_alerts TO authenticated;
GRANT ALL ON public.care_alerts TO service_role;

ALTER TABLE public.care_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own care alerts"
ON public.care_alerts FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.care_alerts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.care_alerts;