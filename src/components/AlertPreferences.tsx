import { useStore } from "@/lib/store";
import { resolvePrefs, type AlertPrefs } from "@/lib/alert-prefs";
import { cn } from "@/lib/utils";

function Choice<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={cn(
            "min-h-12 rounded-2xl px-4 font-bold",
            value === o.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Choose which check-ins and SOS events notify the caregiver. */
export function AlertPreferences() {
  const { settings, updateSettings } = useStore();
  const prefs = resolvePrefs(settings.alertPrefs);
  const set = (patch: Partial<AlertPrefs>) => updateSettings({ alertPrefs: { ...prefs, ...patch } });

  return (
    <section className="soft-card mt-5 p-6">
      <h2 className="text-xl font-bold">When should my caregiver be told?</h2>
      <p className="mt-1 text-muted-foreground">These choices apply to everyone connected to you.</p>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <p className="font-semibold">Daily check-in — when I feel</p>
          <Choice
            value={prefs.wellnessMood}
            onChange={(v) => set({ wellnessMood: v })}
            options={[
              { v: "okay", label: "Okay or worse" },
              { v: "notwell", label: "Not well or worse" },
              { v: "unwell", label: "Unwell only" },
              { v: "never", label: "Never" },
            ]}
          />
        </div>
        <div>
          <p className="font-semibold">Daily check-in — when I tick symptoms</p>
          <Choice
            value={prefs.wellnessSymptoms}
            onChange={(v) => set({ wellnessSymptoms: v })}
            options={[
              { v: 1, label: "Any 1" },
              { v: 2, label: "2 or more" },
              { v: 3, label: "3 or more" },
              { v: 0, label: "Never" },
            ]}
          />
        </div>
        {(
          [
            ["sos", "When I press SOS"],
            ["sosLocation", "Share my location after SOS"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-muted px-4 font-semibold">
            {label}
            <input type="checkbox" className="size-6" checked={prefs[k]} onChange={(e) => set({ [k]: e.target.checked })} />
          </label>
        ))}
      </div>
      {!prefs.sos ? (
        <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          SOS will still call and speak aloud, but your family will not get an alert.
        </p>
      ) : null}
    </section>
  );
}
