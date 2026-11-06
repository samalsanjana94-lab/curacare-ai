import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ProgressRing } from "@/components/ProgressRing";
import { useStore } from "@/lib/store";
import { playAudioNote, speak, stopSpeaking, vibrate, waitForSpeechEnd } from "@/lib/speech";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { listFamilyVoiceReminders } from "@/lib/family-voice.functions";
import { pickFamilyMessage } from "@/lib/family-voice";
import { familyVoiceKey } from "@/components/FamilyVoiceReminders";
import {
  HEALTH_TIPS,
  TIME_SLOTS,
  dosesForDate,
  greeting,
  logKey,
  reminderSentence,
  toKey,
  type Medicine,
  type MedTime,
} from "@/lib/mediguardian";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  HeartPulse,
  Lightbulb,
  Phone,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { WellnessCheck } from "@/components/WellnessCheck";
import {
  isNotificationSupported,
  playReminderSound,
  requestNotificationPermission,
  showDoseNotification,
} from "@/lib/notifications";
import { generateAdherenceReportPDF } from "@/lib/reports";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Today's Medicines — CuraCare" },
      {
        name: "description",
        content: "Your medicines for today, next dose countdown and daily adherence at a glance.",
      },
      { property: "og:title", content: "Today's Medicines — CuraCare" },
      { property: "og:description", content: "Doses, countdown and adherence in one calm screen." },
    ],
  }),
  component: Dashboard,
});

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Dashboard() {
  const { medicines, logs, appointments, vitals, settings, updateSettings, markDose } = useStore();
  const { user } = useSession();
  const listFamilyVoice = useServerFn(listFamilyVoiceReminders);
  const familyVoice = useQuery({
    queryKey: familyVoiceKey(null),
    queryFn: () => listFamilyVoice({ data: {} }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const now = useClock();
  const today = toKey(now);
  const doses = useMemo(() => dosesForDate(medicines), [medicines]);
  const [active, setActive] = useState<{ medicine: Medicine; time: MedTime } | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default");

  // Check notification permission on mount
  useEffect(() => {
    if (isNotificationSupported()) {
      setNotifPerm(Notification.permission);
    }
  }, []);

  const taken = doses.filter(
    (d) => logs[logKey(d.medicine.id, today, d.slot.key)]?.status === "taken",
  );
  const pct = doses.length ? Math.round((taken.length / doses.length) * 100) : 0;

  const nextDose = doses.find((d) => {
    const log = logs[logKey(d.medicine.id, today, d.slot.key)];
    return !log && d.slot.hour * 60 >= now.getHours() * 60 + now.getMinutes();
  });

  const weekly = useMemo(() => {
    let t = 0;
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toKey(d);
      dosesForDate(medicines).forEach((dose) => {
        const log = logs[logKey(dose.medicine.id, key, dose.slot.key)];
        if (log) {
          total++;
          if (log.status === "taken") t++;
        }
      });
    }
    return total ? Math.round((t / total) * 100) : 0;
  }, [logs, medicines]);

  const nextAppointment = [...appointments].sort((a, b) => a.date.localeCompare(b.date))[0];
  const tip = HEALTH_TIPS[now.getDate() % HEALTH_TIPS.length];

  function announce(medicine: Medicine) {
    playReminderSound();
    speak(
      reminderSentence(
        settings.patientName,
        medicine,
        settings.reminderTemplate,
        settings.language,
      ),
      {
        lang: settings.language,
        rate: settings.rate,
        volume: settings.volume,
        voice: settings.voice,
      },
    );
    vibrate();

    // Trigger local push notification if browser permitted
    showDoseNotification({
      medicineName: medicine.name,
      dosage: medicine.dosage,
      instructions: medicine.food,
      onOpen: () => setActive({ medicine, time: medicine.times[0] || "Morning" }),
    });

    const family = pickFamilyMessage(familyVoice.data ?? [], medicine.id);
    if (family) {
      void waitForSpeechEnd().then(async () => {
        toast(`Message from ${family.from_name}`);
        await playAudioNote(family.audio);
      });
    }
  }

  function confirm(medicine: Medicine, time: MedTime, status: "taken" | "skipped") {
    markDose(medicine.id, today, time, status);
    stopSpeaking();
    setActive(null);
    if (status === "taken") {
      toast.success(`${medicine.name} marked as taken`, {
        description: `Great job staying on track!`,
      });
    } else {
      toast.error(`Skipped ${medicine.name} — Caregiver alerted`, {
        description: `Alert recorded at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      });
    }
  }

  async function handleEnableNotifications() {
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
    if (perm === "granted") {
      toast.success("Medicine notifications enabled!");
      playReminderSound();
    } else {
      toast.error("Notification permission not granted in your browser.");
    }
  }

  function handleDownloadReport() {
    generateAdherenceReportPDF({
      patientName: settings.patientName,
      settings,
      medicines,
      logs,
      appointments,
      vitals,
      days: 7,
    });
    toast.success("Adherence report downloaded as PDF");
  }

  const isSeniorMode = !!settings.seniorSimpleMode;

  return (
    <AppShell
      title={`${greeting(now)}, ${settings.patientName}`}
      subtitle={now.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    >
      {/* ━━━ TOP CONTROLS & SENIOR MODE TOGGLE ━━━ */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => updateSettings({ seniorSimpleMode: !isSeniorMode })}
          className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 font-bold transition shadow-sm ${
            isSeniorMode
              ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
              : "border border-border bg-card text-foreground hover:bg-muted"
          }`}
        >
          <Eye className="size-5" aria-hidden />
          {isSeniorMode ? "Senior Simple Mode: ON" : "Switch to Senior Simple Mode"}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {notifPerm !== "granted" && (
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground hover:opacity-90"
            >
              <Bell className="size-4" aria-hidden /> Turn on Notifications
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadReport}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-sm font-bold hover:bg-muted"
          >
            <Download className="size-4" aria-hidden /> Download PDF Report
          </button>
        </div>
      </div>

      {/* ━━━ SENIOR SIMPLE MODE VIEW ━━━ */}
      {isSeniorMode ? (
        <div className="space-y-6">
          <div className="soft-card border-2 border-primary/40 bg-gradient-mint p-8 text-center sm:p-12">
            <p className="text-xl font-bold text-primary">Senior Mode Activated</p>
            <h2 className="mt-2 text-3xl font-extrabold sm:text-5xl">
              {taken.length} of {doses.length} Medicines Done Today
            </h2>
            <p className="mt-3 text-2xl font-bold text-foreground">
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>

            {nextDose ? (
              <div className="mx-auto mt-8 max-w-lg rounded-3xl bg-card p-6 shadow-md">
                <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-lg font-bold text-primary">
                  Up Next: {nextDose.slot.key} ({nextDose.slot.at})
                </span>
                <h3 className="mt-4 text-3xl font-extrabold">{nextDose.medicine.name}</h3>
                <p className="mt-2 text-xl font-semibold text-muted-foreground">
                  {nextDose.medicine.dosage} · {nextDose.medicine.food}
                </p>

                <div className="mt-6 grid gap-4">
                  <button
                    onClick={() => confirm(nextDose.medicine, nextDose.slot.key, "taken")}
                    className="flex min-h-16 items-center justify-center gap-3 rounded-3xl bg-success text-2xl font-extrabold text-success-foreground shadow-md transition hover:scale-[1.02]"
                  >
                    <CheckCircle2 className="size-8" /> YES, I HAVE TAKEN IT
                  </button>
                  <button
                    onClick={() => announce(nextDose.medicine)}
                    className="flex min-h-16 items-center justify-center gap-3 rounded-3xl bg-card text-2xl font-extrabold text-foreground border-2 border-primary/30 shadow-sm"
                  >
                    <Volume2 className="size-8 text-primary" /> LISTEN TO INSTRUCTIONS
                  </button>
                  <button
                    onClick={() => confirm(nextDose.medicine, nextDose.slot.key, "skipped")}
                    className="min-h-14 rounded-3xl bg-muted text-xl font-bold text-muted-foreground"
                  >
                    Skip this dose
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-3xl bg-card p-8 text-center">
                <CheckCircle2 className="mx-auto size-16 text-success" />
                <h3 className="mt-4 text-3xl font-extrabold">All Doses Completed!</h3>
                <p className="mt-2 text-xl text-muted-foreground">You are all done for today. Wonderful job!</p>
              </div>
            )}

            {/* Quick emergency access */}
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                to="/emergency"
                className="flex min-h-16 flex-1 max-w-xs items-center justify-center gap-3 rounded-3xl bg-destructive text-xl font-extrabold text-destructive-foreground shadow-md"
              >
                🆘 EMERGENCY SOS
              </Link>
              {settings.caregiverPhone && (
                <a
                  href={`tel:${settings.caregiverPhone}`}
                  className="flex min-h-16 flex-1 max-w-xs items-center justify-center gap-3 rounded-3xl bg-card text-xl font-extrabold border-2 border-border shadow-sm"
                >
                  <Phone className="size-6 text-primary" /> Call {settings.caregiverName || "Caregiver"}
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ━━━ STANDARD DASHBOARD VIEW ━━━ */
        <>
          <div className="mb-5">
            <WellnessCheck />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Adherence Card */}
            <section className="soft-card flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
              <ProgressRing value={pct} label="today" />
              <div className="min-w-0">
                <h2 className="text-xl font-bold">
                  {taken.length} of {doses.length} doses done
                </h2>
                <p className="mt-1 font-semibold text-muted-foreground">
                  Weekly adherence: <span className="text-primary font-bold">{weekly}%</span>
                </p>
                <p className="mt-3 font-display text-2xl font-extrabold text-primary">
                  {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>
            </section>

            {/* Next Medicine Card */}
            <section className="soft-card bg-gradient-sky p-6">
              <p className="flex items-center gap-2 font-semibold text-muted-foreground">
                <Bell className="size-4" aria-hidden /> Next Scheduled Dose
              </p>
              {nextDose ? (
                <>
                  <h2 className="mt-2 text-2xl font-extrabold">{nextDose.medicine.name}</h2>
                  <p className="text-muted-foreground font-medium">
                    {nextDose.medicine.dosage} · {nextDose.medicine.food}
                  </p>
                  <p className="mt-3 font-display text-xl font-bold text-primary">
                    {nextDose.slot.key} at {nextDose.slot.at}
                  </p>
                  <button
                    onClick={() => {
                      setActive({ medicine: nextDose.medicine, time: nextDose.slot.key });
                      announce(nextDose.medicine);
                    }}
                    className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-card px-5 py-3 font-bold shadow-sm hover:bg-muted"
                  >
                    <Volume2 className="size-5 text-primary" aria-hidden /> Speak Reminder
                  </button>
                </>
              ) : (
                <div className="mt-4 flex items-center gap-3">
                  <CheckCircle2 className="size-8 text-success" />
                  <p className="text-lg font-semibold">All doses handled for today. Great job!</p>
                </div>
              )}
            </section>

            {/* Next Appointment Card */}
            <section className="soft-card bg-gradient-lav p-6">
              <p className="flex items-center gap-2 font-semibold text-muted-foreground">
                <CalendarDays className="size-4" aria-hidden /> Next Doctor Visit
              </p>
              {nextAppointment ? (
                <>
                  <h2 className="mt-2 text-xl font-extrabold">{nextAppointment.doctor}</h2>
                  <p className="text-muted-foreground font-medium">
                    {nextAppointment.department} · {nextAppointment.hospital}
                  </p>
                  <p className="mt-2 font-bold text-primary">
                    {nextAppointment.date} at {nextAppointment.time}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-muted-foreground">No upcoming appointments booked.</p>
              )}
              <Link to="/appointments" className="mt-4 inline-block font-bold text-primary underline">
                Manage all visits
              </Link>
            </section>
          </div>

          {/* ━━━ SCHEDULE & FILTER TABS ━━━ */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold">Today's Medicine Schedule</h2>

            <div className="flex rounded-2xl bg-muted p-1 text-sm font-bold">
              {(["all", "pending", "done"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`rounded-xl px-4 py-1.5 capitalize transition ${
                    filter === tab
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "all" ? "All Doses" : tab === "pending" ? "Pending" : "Completed"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {TIME_SLOTS.map((slot) => {
              let items = doses.filter((d) => d.slot.key === slot.key);
              if (filter === "pending") {
                items = items.filter(
                  (d) => !logs[logKey(d.medicine.id, today, slot.key)],
                );
              } else if (filter === "done") {
                items = items.filter(
                  (d) => !!logs[logKey(d.medicine.id, today, slot.key)],
                );
              }
              if (!items.length) return null;

              return (
                <section key={slot.key} className="soft-card p-5">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-lg font-bold">
                      {slot.key} <span className="text-muted-foreground">· {slot.at}</span>
                    </h3>
                    <span className="text-xs font-bold text-muted-foreground">
                      {items.length} {items.length === 1 ? "medicine" : "medicines"}
                    </span>
                  </div>

                  <ul className="mt-3 grid gap-3">
                    {items.map(({ medicine }) => {
                      const log = logs[logKey(medicine.id, today, slot.key)];
                      return (
                        <li
                          key={medicine.id}
                          className="rounded-3xl border border-border p-4 transition"
                          style={{ background: log ? undefined : medicine.color }}
                        >
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className="size-10 shrink-0 rounded-2xl border border-border"
                                style={{ background: medicine.color }}
                                aria-hidden
                              />
                              <div className="min-w-0">
                                <p className="truncate text-lg font-bold">{medicine.name}</p>
                                <p className="truncate text-sm text-muted-foreground">
                                  {medicine.dosage} · {medicine.food}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => announce(medicine)}
                              title="Speak reminder"
                              aria-label={`Play audio reminder for ${medicine.name}`}
                              className="grid size-10 shrink-0 place-items-center rounded-2xl bg-card hover:bg-muted"
                            >
                              <Volume2 className="size-5 text-primary" />
                            </button>
                          </div>

                          {log ? (
                            <div className="mt-3 flex items-center gap-2 font-bold">
                              {log.status === "taken" ? (
                                <span className="inline-flex items-center gap-1.5 text-success">
                                  <CheckCircle2 className="size-5" /> Taken at{" "}
                                  {new Date(log.at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-destructive">
                                  <XCircle className="size-5" /> Skipped — caregiver notified
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => confirm(medicine, slot.key, "taken")}
                                className="min-h-12 flex-1 rounded-2xl bg-success px-4 font-bold text-success-foreground hover:opacity-90 transition"
                              >
                                ✅ Taken
                              </button>
                              <button
                                onClick={() => {
                                  setActive({ medicine, time: slot.key });
                                  announce(medicine);
                                  toast(
                                    `Reminder repeating in ${settings.repeatEvery} minutes`,
                                  );
                                }}
                                className="min-h-12 rounded-2xl bg-card px-4 font-bold hover:bg-muted transition"
                              >
                                ⏰ Snooze
                              </button>
                              <button
                                onClick={() => confirm(medicine, slot.key, "skipped")}
                                className="min-h-12 rounded-2xl bg-card px-4 font-bold text-destructive hover:bg-muted transition"
                              >
                                ❌ Skip
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          {/* Health tip card */}
          <section className="soft-card mt-8 flex items-start gap-3 bg-gradient-warm p-6">
            <Lightbulb className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-bold">Daily Health Tip</p>
              <p className="mt-1 text-base font-medium text-foreground/80">{tip}</p>
            </div>
          </section>
        </>
      )}

      {/* ━━━ FULL SCREEN REMINDER MODAL ━━━ */}
      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Active medicine reminder"
          className="fixed inset-0 z-50 grid place-items-center bg-primary/30 p-4 backdrop-blur-sm"
        >
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 text-center shadow-2xl">
            <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary text-primary-foreground">
              <Bell className="size-8" />
            </span>
            <p className="mt-3 font-semibold text-muted-foreground">Medicine Due Now</p>
            <h2 className="mt-1 font-display text-3xl font-extrabold">{active.medicine.name}</h2>
            <p className="mt-2 text-xl font-medium">
              {active.medicine.dosage} · {active.medicine.food}
            </p>

            <div className="mt-8 grid gap-3">
              <button
                onClick={() => confirm(active.medicine, active.time, "taken")}
                className="min-h-14 rounded-3xl bg-success text-xl font-bold text-success-foreground shadow-sm hover:scale-[1.01] transition"
              >
                ✅ I Have Taken It
              </button>
              <button
                onClick={() => announce(active.medicine)}
                className="min-h-14 rounded-3xl bg-card text-lg font-bold border border-border hover:bg-muted transition"
              >
                🔊 Say It Again
              </button>
              <button
                onClick={() => {
                  stopSpeaking();
                  setActive(null);
                }}
                className="min-h-14 rounded-3xl bg-muted text-lg font-bold text-muted-foreground hover:bg-muted/80 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
