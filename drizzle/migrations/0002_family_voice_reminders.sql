CREATE TABLE public.family_voice_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  caregiver_id uuid NOT NULL,
  from_name text NOT NULL CHECK (char_length(from_name) BETWEEN 1 AND 60),
  medicine_id text,
  audio text NOT NULL CHECK (char_length(audio) < 2000000),
  duration_sec integer NOT NULL DEFAULT 0 CHECK (duration_sec BETWEEN 0 AND 120),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_voice_reminders TO authenticated;
GRANT ALL ON public.family_voice_reminders TO service_role;
ALTER TABLE public.family_voice_reminders ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.family_voice_reminders (patient_id);
CREATE POLICY "Patient and linked caregivers read" ON public.family_voice_reminders FOR SELECT TO authenticated
  USING (auth.uid() = patient_id OR (auth.uid() = caregiver_id AND public.is_caregiver_of(patient_id)));
CREATE POLICY "Linked caregivers record" ON public.family_voice_reminders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = caregiver_id AND public.is_caregiver_of(patient_id));
CREATE POLICY "Patient or author update" ON public.family_voice_reminders FOR UPDATE TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = caregiver_id)
  WITH CHECK (auth.uid() = patient_id OR auth.uid() = caregiver_id);
CREATE POLICY "Patient or author delete" ON public.family_voice_reminders FOR DELETE TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = caregiver_id);