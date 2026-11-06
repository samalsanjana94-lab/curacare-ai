-- ==============================================================================
-- CuraCare Production Schema Migration (Safe & Non-Destructive)
-- Adds Caregiver Links, Invites, Family Voice Reminders, and Normalized Tables
-- ==============================================================================

-- 1. Patient-Caregiver Links Table
CREATE TABLE IF NOT EXISTS public.care_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_patient_caregiver UNIQUE (patient_id, caregiver_id)
);

ALTER TABLE public.care_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients and caregivers view their links"
ON public.care_links FOR SELECT TO authenticated
USING (auth.uid() = patient_id OR auth.uid() = caregiver_id);

CREATE POLICY "Patients manage caregiver links"
ON public.care_links FOR ALL TO authenticated
USING (auth.uid() = patient_id)
WITH CHECK (auth.uid() = patient_id);

-- 2. Caregiver Invitation Codes
CREATE TABLE IF NOT EXISTS public.care_invites (
  code TEXT NOT NULL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.care_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients manage their invites"
ON public.care_invites FOR ALL TO authenticated
USING (auth.uid() = patient_id)
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Anyone authenticated can view valid invite by code"
ON public.care_invites FOR SELECT TO authenticated
USING (expires_at > now());

-- 3. Caregiver Lookup Helper Function
CREATE OR REPLACE FUNCTION public.is_caregiver_of(_patient UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.care_links
    WHERE patient_id = _patient AND caregiver_id = auth.uid()
  );
$$;

-- 4. Redeem Caregiver Invite Function
CREATE OR REPLACE FUNCTION public.redeem_care_invite(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient UUID;
BEGIN
  SELECT patient_id INTO v_patient
  FROM public.care_invites
  WHERE code = _code AND expires_at > now();

  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;

  IF v_patient = auth.uid() THEN
    RAISE EXCEPTION 'You cannot be a caregiver for yourself';
  END IF;

  INSERT INTO public.care_links (patient_id, caregiver_id)
  VALUES (v_patient, auth.uid())
  ON CONFLICT (patient_id, caregiver_id) DO NOTHING;

  DELETE FROM public.care_invites WHERE code = _code;

  RETURN v_patient;
END;
$$;

-- 5. Family Voice Reminders Table
CREATE TABLE IF NOT EXISTS public.family_voice_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_name TEXT NOT NULL,
  audio TEXT NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 5,
  medicine_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.family_voice_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients and caregivers view voice reminders"
ON public.family_voice_reminders FOR SELECT TO authenticated
USING (auth.uid() = patient_id OR auth.uid() = caregiver_id OR public.is_caregiver_of(patient_id));

CREATE POLICY "Caregivers and patients manage voice reminders"
ON public.family_voice_reminders FOR ALL TO authenticated
USING (auth.uid() = patient_id OR auth.uid() = caregiver_id)
WITH CHECK (auth.uid() = patient_id OR auth.uid() = caregiver_id);

-- 6. Normalized Medicines Table (for structured querying)
CREATE TABLE IF NOT EXISTS public.medicines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Tablet',
  times TEXT[] NOT NULL DEFAULT ARRAY['Morning'],
  food TEXT NOT NULL DEFAULT 'After food',
  frequency TEXT NOT NULL DEFAULT 'Daily',
  quantity INTEGER NOT NULL DEFAULT 30,
  color TEXT NOT NULL DEFAULT 'var(--mint)',
  notes TEXT,
  refill_days INTEGER DEFAULT 7,
  pharmacy TEXT,
  expiry_date DATE,
  reminder_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users and linked caregivers view medicines"
ON public.medicines FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_caregiver_of(user_id));

CREATE POLICY "Users manage own medicines"
ON public.medicines FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 7. Dose Tracking Logs Table
CREATE TABLE IF NOT EXISTS public.dose_logs (
  id TEXT NOT NULL PRIMARY KEY, -- medicine_id|date|slot
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicine_id TEXT NOT NULL,
  date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('taken', 'skipped', 'snoozed')),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dose_logs_user_date ON public.dose_logs (user_id, date DESC);

ALTER TABLE public.dose_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users and linked caregivers view dose logs"
ON public.dose_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_caregiver_of(user_id));

CREATE POLICY "Users manage own dose logs"
ON public.dose_logs FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
