CREATE TABLE public.care_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  caregiver_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, caregiver_id)
);
GRANT SELECT, DELETE ON public.care_links TO authenticated;
GRANT ALL ON public.care_links TO service_role;
ALTER TABLE public.care_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see own links" ON public.care_links FOR SELECT TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = caregiver_id);
CREATE POLICY "Members remove own links" ON public.care_links FOR DELETE TO authenticated
  USING (auth.uid() = patient_id OR auth.uid() = caregiver_id);

CREATE TABLE public.care_invites (
  code text PRIMARY KEY,
  patient_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 days'
);
GRANT SELECT, INSERT, DELETE ON public.care_invites TO authenticated;
GRANT ALL ON public.care_invites TO service_role;
ALTER TABLE public.care_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients manage own invites" ON public.care_invites FOR ALL TO authenticated
  USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);

CREATE OR REPLACE FUNCTION public.is_caregiver_of(_patient uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.care_links WHERE patient_id = _patient AND caregiver_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.redeem_care_invite(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _patient uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT patient_id INTO _patient FROM public.care_invites
    WHERE code = upper(trim(_code)) AND expires_at > now();
  IF _patient IS NULL THEN RAISE EXCEPTION 'Invite code not found or expired'; END IF;
  IF _patient = auth.uid() THEN RAISE EXCEPTION 'You cannot link to yourself'; END IF;
  INSERT INTO public.care_links (patient_id, caregiver_id) VALUES (_patient, auth.uid())
    ON CONFLICT DO NOTHING;
  DELETE FROM public.care_invites WHERE code = upper(trim(_code));
  RETURN _patient;
END $$;
REVOKE ALL ON FUNCTION public.redeem_care_invite(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_care_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_caregiver_of(uuid) TO authenticated;

CREATE POLICY "Caregivers read linked app state" ON public.app_state FOR SELECT TO authenticated
  USING (public.is_caregiver_of(user_id));
CREATE POLICY "Caregivers read linked profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_caregiver_of(id) OR EXISTS (SELECT 1 FROM public.care_links l WHERE l.caregiver_id = profiles.id AND l.patient_id = auth.uid()));
CREATE POLICY "Caregivers read linked alerts" ON public.care_alerts FOR SELECT TO authenticated
  USING (public.is_caregiver_of(user_id));
CREATE POLICY "Caregivers acknowledge linked alerts" ON public.care_alerts FOR UPDATE TO authenticated
  USING (public.is_caregiver_of(user_id)) WITH CHECK (public.is_caregiver_of(user_id));