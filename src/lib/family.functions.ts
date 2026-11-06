import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type FamilyLink = {
  id: string;
  otherId: string;
  name: string;
  role: "patient" | "caregiver";
  since: string;
};

function newCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  bytes.forEach((b) => (s += chars[b % chars.length]));
  return s;
}

/** Patient creates a 6-character code to share with a family member. */
export const createInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("care_invites").delete().eq("patient_id", context.userId);
    const code = newCode();
    const { data, error } = await context.supabase
      .from("care_invites")
      .insert({ code, patient_id: context.userId })
      .select("code, expires_at")
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

/** Caregiver enters the code to connect. */
export const redeemInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { code: string }) =>
    z.object({ code: z.string().trim().min(4).max(12) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("redeem_care_invite", { _code: data.code });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Everyone this person is connected with, in both directions. */
export const listFamilyLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FamilyLink[]> => {
    const { data, error } = await context.supabase
      .from("care_links")
      .select("id, patient_id, caregiver_id, created_at");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const ids = rows.map((r) => (r.patient_id === context.userId ? r.caregiver_id : r.patient_id));
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      (profs ?? []).forEach((p) => names.set(p.id, p.display_name ?? "Family member"));
    }
    return rows.map((r) => {
      const iAmPatient = r.patient_id === context.userId;
      const otherId = iAmPatient ? r.caregiver_id : r.patient_id;
      return {
        id: r.id,
        otherId,
        name: names.get(otherId) ?? (iAmPatient ? "Caregiver" : "Patient"),
        role: iAmPatient ? "caregiver" : "patient",
        since: r.created_at,
      };
    });
  });

export const removeFamilyLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("care_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Read-only view of a connected patient's medicines, doses and alerts. */
export const getPatientOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { patientId: string }) =>
    z.object({ patientId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const [state, alerts] = await Promise.all([
      context.supabase
        .from("app_state")
        .select("data, updated_at")
        .eq("user_id", data.patientId)
        .maybeSingle(),
      context.supabase
        .from("care_alerts")
        .select("id, kind, title, detail, acknowledged, acknowledged_at, created_at")
        .eq("user_id", data.patientId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (state.error) throw new Error(state.error.message);
    return {
      snapshot: state.data?.data ? JSON.stringify(state.data.data) : null,
      updatedAt: state.data?.updated_at ?? null,
      alerts: alerts.data ?? [],
    };
  });

export const acknowledgePatientAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("care_alerts")
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString(), acknowledged_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
