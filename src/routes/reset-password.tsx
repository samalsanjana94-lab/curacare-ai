import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — CuraCare" },
      {
        name: "description",
        content: "Choose a new password for your CuraCare account.",
      },
      { property: "og:title", content: "Set a new password — CuraCare" },
      { property: "og:description", content: "Securely reset your CuraCare password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <form
        className="glass w-full max-w-md rounded-[2rem] p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await supabase.auth.updateUser({ password });
          setBusy(false);
          if (error) {
            toast.error(error.message);
            return;
          }
          toast.success("Password updated");
          void navigate({ to: "/dashboard" });
        }}
      >
        <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-gradient-lav">
          <KeyRound className="size-7 text-primary" aria-hidden />
        </span>
        <h1 className="mt-4 text-center text-3xl font-extrabold">Set a new password</h1>
        <p className="mt-1 text-center text-muted-foreground">
          Choose something easy for you to remember.
        </p>
        <label className="mt-6 grid gap-1 font-semibold">
          New password
          <input
            type="password"
            required
            minLength={6}
            className="min-h-14 w-full rounded-2xl border border-input bg-card px-5 text-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <button
          disabled={busy}
          className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          Save password
        </button>
      </form>
    </div>
  );
}
