import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { FamilyVoiceReminder } from "./family-voice";

const COLS = "id, patient_id, caregiver_id, from_name, medicine_id, audio, duration_sec, active, created_at";

/** Messages for a patient. Patient sees all; caregivers see the ones they recorded. */
export const listFamilyVoiceReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { patientId?: string }) =>
    z.object({ patientId: z.string().uuid().optional() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<FamilyVoiceReminder[]> => {
    const patientId = data.patientId ?? context.userId;
    const { data: rows, error } = await context.supabase
      .from("family_voice_reminders")
      .select(COLS)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addFamilyVoiceReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    patientId: string;
    fromName: string;
    medicineId?: string | null;
    audio: string;
    durationSec: number;
  }) =>
    z
      .object({
        patientId: z.string().uuid(),
        fromName: z.string().trim().min(1).max(60),
        medicineId: z.string().max(100).nullish(),
        audio: z.string().startsWith("data:audio/").max(1_900_000),
        durationSec: z.number().int().min(1).max(120),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("family_voice_reminders").insert({
      patient_id: data.patientId,
      caregiver_id: context.userId,
      from_name: data.fromName,
      medicine_id: data.medicineId ?? null,
      audio: data.audio,
      duration_sec: data.durationSec,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setFamilyVoiceReminderActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; active: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("family_voice_reminders")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFamilyVoiceReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("family_voice_reminders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
