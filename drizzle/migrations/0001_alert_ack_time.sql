ALTER TABLE public.care_alerts ADD COLUMN acknowledged_at timestamptz;
ALTER TABLE public.care_alerts ADD COLUMN acknowledged_by uuid;