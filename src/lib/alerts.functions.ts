import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type CloudAlert = {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  acknowledged: boolean;
  acknowledged_at?: string | null;
  created_at: string;
};

/** Most recent care alerts for the signed-in person. */
export const listCareAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CloudAlert[]> => {
    const { data, error } = await context.supabase
      .from("care_alerts")
      .select("id, kind, title, detail, acknowledged, acknowledged_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as CloudAlert[];
  });

const alertInput = z.object({
  kind: z.enum(["sos", "missed", "refill", "note"]),
  title: z.string().trim().min(1).max(140),
  detail: z.string().trim().max(600).optional(),
});

/** Raise an alert that streams live to every device signed into this account. */
export const pushCareAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => alertInput.parse(input))
  .handler(async ({ data, context }): Promise<CloudAlert> => {
    const { data: row, error } = await context.supabase
      .from("care_alerts")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        title: data.title,
        detail: data.detail ?? null,
      })
      .select("id, kind, title, detail, acknowledged, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as CloudAlert;
  });

export const acknowledgeCareAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("care_alerts")
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString(), acknowledged_by: context.userId })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearCareAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("care_alerts")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
