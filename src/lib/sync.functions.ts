import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Pull the signed-in person's synced snapshot. */
export const loadCloudState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_state")
      .select("data, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

/** Push the signed-in person's snapshot. */
export const saveCloudState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { data: Record<string, unknown> }) => {
    if (!input || typeof input.data !== "object" || input.data === null) {
      throw new Error("Invalid payload");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("app_state")
      .upsert(
        { user_id: context.userId, data: data.data as never },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, at: new Date().toISOString() };
  });
