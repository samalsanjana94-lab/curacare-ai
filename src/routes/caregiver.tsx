import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { BellRing, CheckCircle2, PhoneCall, Siren, Trash2, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { speak } from "@/lib/speech";
import {
  INVENTORY_LABEL,
  RISK_COPY,
  TIME_SLOTS,
  dosesForDate,
  escalationMessage,
  inventoryStatus,
  logKey,
  missedOnDate,
  missedStreak,
  riskFromStreak,
  toKey,
} from "@/lib/mediguardian";

export const Route = createFileRoute("/caregiver")({
  head: () => ({
    meta: [
      { title: "Caregiver Dashboard — CuraCare" },
      {
        name: "description",
        content:
          "Watch over your loved one: today's doses, missed medicines, low stock and instant emergency notifications.",
      },
      { property: "og:title", content: "Caregiver Dashboard — CuraCare" },
      {
        property: "og:description",
        content: "Live adherence, refill warnings and SOS alerts for the person you care for.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Caregiver,
});

function Caregiver() {
  const { medicines, logs, alerts, settings, acknowledgeAlert, clearAlerts, addAlert } = useStore();
  const today = toKey(new Date());
  const now = new Date();

  const doses = useMemo(() => dosesForDate(medicines), [medicines]);
  const taken = doses.filter((d) => logs[logKey(d.medicine.id, today, d.slot.key)]?.status === "taken");
  const missed = doses.filter((d) => {
    const log = logs[logKey(d.medicine.id, today, d.slot.key)];
    const slotPassed = now.getHours() > d.slot.hour + 1;
    return !log && slotPassed;
  });
  const lowStock = medicines.filter((m) => inventoryStatus(m) !== "ok");
  const unread = alerts.filter((a) => !a.acknowledged);
  const percent = doses.length ? Math.round((taken.length / doses.length) * 100) : 0;

  const streak = useMemo(() => missedStreak(medicines, logs), [medicines, logs]);
  const risk = riskFromStreak(streak);
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toKey(d);
  }, []);
  const missedYesterday = useMemo(
    () => Array.from(new Set(missedOnDate(medicines, logs, yesterday).map((m) => m.medicine.name))),
    [medicines, logs, yesterday],
  );
  const escalation = escalationMessage(settings.patientName, streak, missedYesterday);

  const riskStyle: Record<string, string> = {
    watch: "bg-secondary/40 border-border",
    alert: "bg-accent/50 border-border",
    high: "bg-destructive/10 border-destructive",
  };

  function nudge() {
    addAlert({
      kind: "note",
      title: "Reminder sent",
      detail: `${settings.caregiverName} asked ${settings.patientName} to take the pending medicines.`,
    });
    speak(
      `${settings.patientName}, ${settings.caregiverName} is reminding you to take your pending medicines.`,
      { lang: settings.language, rate: settings.rate, volume: settings.volume, voice: settings.voice },
    );
    toast.success("Reminder sent and spoken aloud");
  }

  const kindStyle: Record<string, string> = {
    sos: "bg-destructive/12 text-destructive",
    missed: "bg-secondary/40",
    refill: "bg-accent/40",
    note: "bg-muted",
  };

  return (
    <AppShell
      title="Caregiver dashboard"
      subtitle={`Watching over ${settings.patientName} — live status and emergency notifications.`}
    >
      <Link
        to="/care-essentials"
        className="mb-5 flex min-h-14 items-center justify-center rounded-3xl bg-secondary text-lg font-bold text-secondary-foreground md:hidden"
      >
        Open simple phone view
      </Link>
      {unread.some((a) => a.kind === "sos") ? (
        <div className="soft-card mb-6 flex flex-wrap items-center gap-4 border-destructive bg-destructive/10 p-6">
          <Siren className="size-10 animate-pulse text-destructive" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold text-destructive">Emergency SOS active</h2>
            <p className="text-sm">{settings.patientName} pressed the SOS button. Call now.</p>
          </div>
          <a
            href={`tel:${settings.caregiverPhone.replace(/\s/g, "")}`}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-destructive px-5 font-bold text-destructive-foreground"
          >
            <PhoneCall className="size-5" aria-hidden /> Call now
          </a>
        </div>
      ) : null}

      {risk !== "none" ? (
        <section className={`soft-card mb-6 border p-6 ${riskStyle[risk]}`}>
          <div className="flex flex-wrap items-start gap-4">
            <TriangleAlert
              className={`size-9 shrink-0 ${risk === "high" ? "text-destructive" : "text-primary"}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Missed-dose escalation
              </p>
              <h2 className="text-xl font-extrabold">{RISK_COPY[risk].label}</h2>
              <p className="mt-1 text-lg">{escalation}</p>
              <p className="mt-1 font-semibold text-muted-foreground">{RISK_COPY[risk].action}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`tel:${settings.caregiverPhone.replace(/\s/g, "")}`}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-bold text-primary-foreground"
            >
              <PhoneCall className="size-5" aria-hidden /> Call {settings.patientName}
            </a>
            <button
              onClick={() => {
                addAlert({
                  kind: "missed",
                  title:
                    risk === "high" ? "HIGH RISK — 3+ days missed" : `Missed doses (${streak} day${streak > 1 ? "s" : ""})`,
                  detail: escalation,
                });
                speak(escalation, {
                  lang: settings.language,
                  rate: settings.rate,
                  volume: settings.volume,
                  voice: settings.voice,
                });
                toast.success("Escalation logged and read aloud");
              }}
              className="min-h-12 rounded-2xl bg-card px-5 font-bold"
            >
              🔊 Announce &amp; log alert
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="soft-card p-5">
          <p className="text-sm font-semibold text-muted-foreground">Today&apos;s adherence</p>
          <p className="mt-1 text-4xl font-extrabold">{percent}%</p>
          <p className="text-sm">
            {taken.length} of {doses.length} doses taken
          </p>
        </div>
        <div className="soft-card p-5">
          <p className="text-sm font-semibold text-muted-foreground">Missed so far</p>
          <p className="mt-1 text-4xl font-extrabold text-destructive">{missed.length}</p>
          <p className="text-sm">{missed.length ? "Needs a gentle nudge" : "All good today"}</p>
        </div>
        <div className="soft-card p-5">
          <p className="text-sm font-semibold text-muted-foreground">Medicines to refill</p>
          <p className="mt-1 text-4xl font-extrabold">{lowStock.length}</p>
          <p className="text-sm">{lowStock.map((m) => m.name).join(", ") || "Stock is healthy"}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="soft-card p-5">
          <h2 className="text-xl font-bold">Today&apos;s schedule</h2>
          <ul className="mt-3 grid gap-2">
            {TIME_SLOTS.map((slot) => {
              const items = doses.filter((d) => d.slot.key === slot.key);
              if (!items.length) return null;
              return (
                <li key={slot.key} className="rounded-2xl bg-muted p-3">
                  <p className="font-bold">
                    {slot.key} · {slot.at}
                  </p>
                  <ul className="mt-1 grid gap-1">
                    {items.map((d) => {
                      const log = logs[logKey(d.medicine.id, today, slot.key)];
                      const state: string =
                        log?.status ?? (now.getHours() > slot.hour + 1 ? "missed" : "due");
                      return (
                        <li key={d.medicine.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">
                            {d.medicine.name} · {d.medicine.dosage}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                              state === "taken"
                                ? "bg-primary/15 text-primary"
                                : state === "missed"
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-card"
                            }`}
                          >
                            {state}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
          <button
            onClick={nudge}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground"
          >
            <BellRing className="size-5" aria-hidden /> Send a reminder
          </button>
        </section>

        <section className="soft-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Emergency notifications</h2>
            {alerts.length ? (
              <button
                onClick={clearAlerts}
                className="inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                <Trash2 className="size-4" aria-hidden /> Clear
              </button>
            ) : null}
          </div>
          {alerts.length ? (
            <ul className="mt-3 grid gap-2">
              {alerts.map((a) => (
                <li key={a.id} className={`rounded-2xl p-4 ${kindStyle[a.kind] ?? "bg-muted"}`}>
                  <p className="font-bold">{a.title}</p>
                  <p className="text-sm">{a.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(a.at).toLocaleString()}
                  </p>
                  {a.acknowledged ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                      <CheckCircle2 className="size-4" aria-hidden /> Acknowledged
                    </p>
                  ) : (
                    <button
                      onClick={() => acknowledgeAlert(a.id)}
                      className="mt-2 min-h-10 rounded-2xl bg-card px-4 text-sm font-bold"
                    >
                      Acknowledge
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-2xl bg-muted p-4 text-muted-foreground">
              No alerts. SOS presses, missed doses and refill warnings will appear here.
            </p>
          )}

          {lowStock.length ? (
            <div className="mt-4 rounded-2xl bg-accent/40 p-4">
              <p className="font-bold">Refill needed</p>
              <ul className="mt-1 grid gap-1 text-sm">
                {lowStock.map((m) => (
                  <li key={m.id}>
                    {m.name} — {INVENTORY_LABEL[inventoryStatus(m)]} ({m.quantity} left)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
