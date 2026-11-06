import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { resolvePrefs, shouldAlertSos } from "@/lib/alert-prefs";
import { speak, stopSpeaking, vibrate } from "@/lib/speech";
import {
  AlertTriangle,
  HeartPulse,
  MapPin,
  PhoneCall,
  ShieldAlert,
  Siren,
  X,
} from "lucide-react";

export const Route = createFileRoute("/emergency")({
  head: () => ({
    meta: [
      { title: "Emergency SOS — CuraCare" },
      {
        name: "description",
        content: "One large button to alert caregivers, share location and call for help.",
      },
      { property: "og:title", content: "Emergency SOS — CuraCare" },
      { property: "og:description", content: "Alert your family instantly with one press." },
    ],
  }),
  component: Emergency,
});

function Emergency() {
  const { settings, addAlert, medicines } = useStore();
  const [alerting, setAlerting] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (confirming) {
      setCountdown(3);
      timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            setConfirming(false);
            executeTrigger();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [confirming]);

  function startTrigger() {
    setConfirming(true);
  }

  function cancelTrigger() {
    setConfirming(false);
    toast.info("SOS trigger cancelled");
  }

  function executeTrigger() {
    setAlerting(true);
    if (shouldAlertSos(resolvePrefs(settings.alertPrefs), "sos")) {
      addAlert({
        kind: "sos",
        title: "EMERGENCY SOS Triggered",
        detail: `${settings.patientName} pressed the Emergency SOS button and requested immediate assistance.`,
      });
    }

    vibrate([600, 200, 600, 200, 600]);
    speak(
      `Emergency alert triggered for ${settings.patientName}. Alerting caregiver ${settings.caregiverName || ""}.`,
      { lang: settings.language, rate: settings.rate, volume: 1, voice: settings.voice }
    );

    toast.error(`Emergency alert logged for ${settings.caregiverName}`, {
      description: `Phone: ${settings.caregiverPhone || "Not set"}`,
    });

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const where = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
          setLocation(where);
          if (shouldAlertSos(resolvePrefs(settings.alertPrefs), "location")) {
            addAlert({
              kind: "sos",
              title: "Patient Location Coordinates",
              detail: `Location: ${where} (accuracy ~${Math.round(pos.coords.accuracy)}m)`,
            });
          }
        },
        () => setLocation("Location permission not granted on this device")
      );
    }
  }

  function resetAlert() {
    setAlerting(false);
    stopSpeaking();
  }

  return (
    <AppShell title="Emergency SOS" subtitle="Quick access to emergency contacts and your vital medical profile.">
      {/* ━━━ NOTICE ━━━ */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <p>
          <strong>Notice:</strong> This feature alerts linked caregivers in CuraCare and opens your phone dialer. It does <em>not</em> directly dispatch police or emergency ambulances automatically. If in immediate danger, please dial your local emergency services directly.
        </p>
      </div>

      <div className={`soft-card p-8 text-center transition ${alerting ? "bg-destructive/10 border-destructive/40" : ""}`}>
        {confirming ? (
          <div className="mx-auto max-w-sm rounded-[2.5rem] bg-card p-6 shadow-xl border-2 border-destructive animate-pulse">
            <h3 className="text-2xl font-extrabold text-destructive">Triggering SOS in {countdown}...</h3>
            <p className="mt-2 text-sm text-muted-foreground">Alert will be dispatched to your caregivers.</p>
            <button
              onClick={cancelTrigger}
              className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-muted text-lg font-bold text-foreground hover:bg-muted/80"
            >
              <X className="size-5" /> Cancel SOS
            </button>
          </div>
        ) : (
          <button
            onClick={startTrigger}
            aria-label="Press SOS button"
            className="animate-sos mx-auto grid size-56 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-[var(--shadow-soft)] hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <span>
              <Siren className="mx-auto size-16" aria-hidden />
              <span className="mt-2 block font-display text-4xl font-extrabold tracking-wider">SOS</span>
            </span>
          </button>
        )}

        <p className="mt-6 text-xl font-bold">
          {alerting
            ? `Emergency Alert Active — Caregiver: ${settings.caregiverName} (${settings.caregiverPhone})`
            : "Tap the SOS button to alert your caregiver immediately."}
        </p>

        {location ? (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4 text-primary" /> {location}
          </p>
        ) : null}

        {alerting && (
          <button
            type="button"
            onClick={resetAlert}
            className="mt-4 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted"
          >
            Stop / Dismiss Active Alert
          </button>
        )}

        {/* Action Call Buttons */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {settings.caregiverPhone ? (
            <a
              href={`tel:${settings.caregiverPhone.replace(/\s/g, "")}`}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-primary text-lg font-bold text-primary-foreground shadow-sm hover:opacity-95"
            >
              <PhoneCall className="size-5" aria-hidden /> Call {settings.caregiverName || "Caregiver"}
            </a>
          ) : (
            <Link
              to="/settings"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-muted text-sm font-bold text-muted-foreground"
            >
              Set Caregiver Phone in Settings
            </Link>
          )}

          <a
            href="tel:112"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-destructive text-lg font-bold text-destructive-foreground shadow-sm hover:opacity-95"
          >
            <PhoneCall className="size-5" aria-hidden /> Dial Emergency (112)
          </a>

          {settings.altContactPhone ? (
            <a
              href={`tel:${settings.altContactPhone.replace(/\s/g, "")}`}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-3xl border border-border bg-card text-base font-bold hover:bg-muted"
            >
              <PhoneCall className="size-5" aria-hidden /> Call {settings.altContactName || "Secondary Contact"}
            </a>
          ) : null}

          {settings.doctorPhone ? (
            <a
              href={`tel:${settings.doctorPhone.replace(/\s/g, "")}`}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-3xl border border-border bg-card text-base font-bold hover:bg-muted"
            >
              <PhoneCall className="size-5" aria-hidden /> Call Dr. {settings.doctorName || "Doctor"}
            </a>
          ) : null}
        </div>
      </div>

      {/* ━━━ MEDICAL PROFILE ━━━ */}
      <section className="soft-card mt-6 p-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <HeartPulse className="size-5 text-primary" aria-hidden /> Emergency Medical Profile
          </h2>
          <Link
            to="/settings"
            className="text-sm font-bold text-primary hover:underline"
          >
            Edit Profile
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Show this medical summary to first responders or doctors in an emergency.</p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {(
            [
              ["Patient Name", settings.patientName],
              ["Blood Group", settings.bloodGroup || "Not specified"],
              ["Allergies", settings.allergies || "None documented"],
              ["Ongoing Conditions", settings.conditions || "None documented"],
              ["Primary Doctor", settings.doctorName ? `Dr. ${settings.doctorName} (${settings.doctorPhone || ""})` : "Not set"],
              ["Primary Caregiver", settings.caregiverName ? `${settings.caregiverName} (${settings.caregiverPhone})` : "Not set"],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-muted p-4">
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</dt>
              <dd className="mt-1 text-base font-bold">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 rounded-2xl bg-gradient-sky p-4">
          <p className="font-bold text-sm">Active Medications List</p>
          {medicines.length ? (
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 text-sm">
              {medicines.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />
                  <span className="font-bold">{m.name}</span>
                  <span className="text-muted-foreground font-medium">({m.dosage} · {m.times.join(", ")})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No active medicines logged.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
