import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { toKey } from "@/lib/mediguardian";
import { cn } from "@/lib/utils";
import { resolvePrefs, shouldAlertWellness } from "@/lib/alert-prefs";

const MOODS = [
  { emoji: "😄", label: "Great" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😐", label: "Okay" },
  { emoji: "😟", label: "Not well" },
  { emoji: "🤒", label: "Unwell" },
];
const SYMPTOMS = ["Dizzy", "Pain", "Tired", "Breathless", "Poor sleep", "Upset stomach"];

/** Once-a-day "How are you feeling?" check-in. Poor answers notify the caregiver. */
export function WellnessCheck() {
  const { vitals, addVital, addAlert, settings } = useStore();
  const today = toKey(new Date());
  const done = vitals.find((v) => v.date === today && v.note?.startsWith("Wellness:"));
  const [mood, setMood] = useState<number | null>(null);
  const [sym, setSym] = useState<string[]>([]);

  if (done) {
    return (
      <section className="soft-card p-6">
        <h2 className="text-xl font-bold">Today's check-in</h2>
        <p className="mt-2 text-lg">
          You said you feel <b>{done.mood}</b>. Thank you!
        </p>
      </section>
    );
  }

  function save() {
    if (mood === null) return;
    const m = MOODS[mood];
    addVital({
      date: today,
      bp: "",
      sugar: "",
      weight: "",
      pulse: "",
      mood: m.label,
      note: `Wellness: ${sym.length ? sym.join(", ") : "no symptoms"}`,
    });
    if (shouldAlertWellness(resolvePrefs(settings.alertPrefs), mood, sym.length)) {
      addAlert({
        kind: "note",
        title: `${settings.patientName} is feeling ${m.label.toLowerCase()}`,
        detail: sym.length ? `Mentioned: ${sym.join(", ")}` : "Daily wellness check",
      });
      toast.success("Saved. Your caregiver has been told.");
    } else {
      toast.success("Saved. Have a lovely day!");
    }
  }

  return (
    <section className="soft-card p-6">
      <h2 className="text-xl font-bold">How are you feeling today?</h2>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {MOODS.map((m, i) => (
          <button
            key={m.label}
            onClick={() => setMood(i)}
            aria-pressed={mood === i}
            className={cn(
              "flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 text-sm font-semibold",
              mood === i ? "border-primary bg-primary/12" : "border-transparent bg-muted",
            )}
          >
            <span className="text-3xl" aria-hidden>
              {m.emoji}
            </span>
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-4 font-semibold">Anything bothering you?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {SYMPTOMS.map((s) => (
          <button
            key={s}
            onClick={() => setSym((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))}
            aria-pressed={sym.includes(s)}
            className={cn(
              "min-h-12 rounded-2xl px-4 font-semibold",
              sym.includes(s) ? "bg-accent text-accent-foreground" : "bg-muted",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        onClick={save}
        disabled={mood === null}
        className="mt-5 min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
      >
        Save check-in
      </button>
    </section>
  );
}
