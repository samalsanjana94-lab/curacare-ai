import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useStore } from "@/lib/store";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CuraCare" },
      {
        name: "description",
        content:
          "Sign in with email, a one-time code, Google or Apple to sync medicines, reminders and caregiver alerts across your devices.",
      },
      { property: "og:title", content: "Sign in — CuraCare" },
      {
        property: "og:description",
        content: "Secure patient and caregiver access with email, OTP, Google or Apple.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auth,
});

type Mode = "signin" | "signup" | "otp" | "forgot";

const field = "min-h-14 w-full rounded-2xl border border-input bg-card px-5 text-base";

function Auth() {
  const { settings, updateSettings } = useStore();
  const { user } = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function social(provider: "google" | "apple") {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: origin });
      if (result.error) {
        // Fallback to direct Supabase OAuth if Lovable Cloud broker fails
        const { error: sbErr } = await supabase.auth.signInWithOAuth({
          provider: provider === "google" ? "google" : "apple",
          options: { redirectTo: origin },
        });
        if (sbErr) throw sbErr;
        return;
      }
      if (result.redirected) return;
      toast.success("Signed in");
      void navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in — your data is syncing");
        void navigate({ to: "/dashboard" });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: origin,
            data: { display_name: name || email.split("@")[0], role: settings.role },
          },
        });
        if (error) throw error;
        if (name) updateSettings({ patientName: name });
        if (!data.session) {
          toast.success("Check your email", {
            description: "Tap the confirmation link we just sent, then sign in.",
          });
          setMode("signin");
        } else {
          toast.success("Account created");
          void navigate({ to: "/dashboard" });
        }
      } else if (mode === "otp") {
        if (!codeSent) {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: origin },
          });
          if (error) throw error;
          setCodeSent(true);
          toast.success("Code sent", { description: "Enter the 6-digit code from your email." });
        } else {
          const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
          if (error) throw error;
          toast.success("Verified");
          void navigate({ to: "/dashboard" });
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset link sent", { description: "Check your inbox." });
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const heading: Record<Mode, string> = {
    signin: "Welcome back",
    signup: "Create your account",
    otp: "Sign in with a code",
    forgot: "Reset your password",
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-[2rem] p-7">
        <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-gradient-sky">
          <ShieldCheck className="size-7 text-primary" aria-hidden />
        </span>
        <h1 className="mt-4 text-center text-3xl font-extrabold">{heading[mode]}</h1>
        <p className="mt-1 text-center text-muted-foreground">
          {user
            ? `Signed in as ${user.email}`
            : "Your medicines and reminders sync safely across every device."}
        </p>

        {user ? (
          <div className="mt-6 grid gap-3">
            <Link
              to="/dashboard"
              className="grid min-h-14 place-items-center rounded-3xl bg-primary text-lg font-bold text-primary-foreground"
            >
              Go to today's medicines
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                toast.success("Signed out");
              }}
              className="min-h-14 rounded-3xl bg-card text-lg font-bold text-muted-foreground"
            >
              Sign out
            </button>
          </div>
        ) : (
          <>
            <fieldset className="mt-6">
              <legend className="font-semibold">I am a</legend>
              <div className="mt-2 flex gap-2">
                {(["patient", "caregiver"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={settings.role === r}
                    onClick={() => updateSettings({ role: r })}
                    className={`min-h-12 flex-1 rounded-2xl font-bold capitalize ${
                      settings.role === r
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </fieldset>

            <form className="mt-5 grid gap-3" onSubmit={submit}>
              {mode === "signup" ? (
                <label className="grid gap-1 font-semibold">
                  Full name
                  <input
                    className={field}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Kamla Devi"
                    autoComplete="name"
                  />
                </label>
              ) : null}

              <label className="grid gap-1 font-semibold">
                Email
                <input
                  type="email"
                  required
                  className={field}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              {mode === "signin" || mode === "signup" ? (
                <label className="grid gap-1 font-semibold">
                  Password
                  <input
                    type="password"
                    required
                    minLength={6}
                    className={field}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                </label>
              ) : null}

              {mode === "otp" && codeSent ? (
                <label className="grid gap-1 font-semibold">
                  6-digit code
                  <input
                    inputMode="numeric"
                    required
                    className={`${field} tracking-[0.4em]`}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    autoComplete="one-time-code"
                  />
                </label>
              ) : null}

              <button
                disabled={busy}
                className="mt-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                {mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "otp"
                      ? codeSent
                        ? "Verify code"
                        : "Email me a code"
                      : "Send reset link"}
              </button>
            </form>

            <div className="mt-5 grid gap-2">
              <button
                disabled={busy}
                onClick={() => void social("google")}
                className="min-h-14 rounded-3xl bg-card font-bold disabled:opacity-60"
              >
                Continue with Google
              </button>
              <button
                disabled={busy}
                onClick={() => void social("apple")}
                className="min-h-14 rounded-3xl bg-card font-bold disabled:opacity-60"
              >
                Continue with Apple
              </button>
            </div>

            <div className="mt-5 grid gap-1 text-center text-sm font-semibold">
              {mode !== "signin" ? (
                <button onClick={() => setMode("signin")} className="text-primary underline">
                  Sign in with a password
                </button>
              ) : null}
              {mode !== "signup" ? (
                <button onClick={() => setMode("signup")} className="text-primary underline">
                  Create a new account
                </button>
              ) : null}
              {mode !== "otp" ? (
                <button
                  onClick={() => {
                    setMode("otp");
                    setCodeSent(false);
                  }}
                  className="text-primary underline"
                >
                  Sign in with a one-time code
                </button>
              ) : null}
              {mode !== "forgot" ? (
                <button onClick={() => setMode("forgot")} className="text-muted-foreground underline">
                  Forgot password?
                </button>
              ) : null}
            </div>
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          You can keep using CuraCare offline — signing in simply keeps everything backed up and
          shared with your caregiver.
        </p>
      </div>
    </div>
  );
}
