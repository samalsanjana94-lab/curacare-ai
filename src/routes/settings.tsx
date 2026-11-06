import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { LANGUAGES, reminderSentence, seedMedicines } from "@/lib/mediguardian";
import { speak } from "@/lib/speech";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Accessibility — CuraCare" },
      {
        name: "description",
        content: "Choose language, voice, text size, contrast, dark mode and caregiver contacts.",
      },
      { property: "og:title", content: "Settings & Accessibility — CuraCare" },
      { property: "og:description", content: "Make the app fit how you see, hear and read." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, updateSettings } = useStore();
  const field = "min-h-12 w-full rounded-2xl border border-input bg-card px-4 text-base";

  return (
    <AppShell title="Settings" subtitle="Make the app fit how you see, hear and read.">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="soft-card p-5">
          <h2 className="text-xl font-bold">Profile</h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 font-semibold">
              Patient name
              <input
                className={field}
                value={settings.patientName}
                onChange={(e) => updateSettings({ patientName: e.target.value })}
              />
            </label>
            <fieldset>
              <legend className="font-semibold">I am a</legend>
              <div className="mt-2 flex gap-2">
                {(["patient", "caregiver"] as const).map((r) => (
                  <button
                    key={r}
                    aria-pressed={settings.role === r}
                    onClick={() => updateSettings({ role: r })}
                    className={`min-h-12 flex-1 rounded-2xl font-bold capitalize ${
                      settings.role === r
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="grid gap-1 font-semibold">
              Caregiver name
              <input
                className={field}
                value={settings.caregiverName}
                onChange={(e) => updateSettings({ caregiverName: e.target.value })}
              />
            </label>
            <label className="grid gap-1 font-semibold">
              Caregiver phone
              <input
                className={field}
                value={settings.caregiverPhone}
                onChange={(e) => updateSettings({ caregiverPhone: e.target.value })}
              />
            </label>
            {(
              [
                ["Second contact name", "altContactName", "Ravi (son)"],
                ["Second contact phone", "altContactPhone", "+91 90000 00001"],
                ["Doctor name", "doctorName", "Dr. Mehta"],
                ["Doctor phone", "doctorPhone", "+91 90000 00002"],
                ["Blood group", "bloodGroup", "B+"],
                ["Allergies", "allergies", "Penicillin"],
                ["Ongoing conditions", "conditions", "Diabetes, blood pressure"],
              ] as const
            ).map(([label, key, ph]) => (
              <label key={key} className="grid gap-1 font-semibold">
                {label}
                <input
                  className={field}
                  placeholder={ph}
                  value={settings[key] ?? ""}
                  onChange={(e) => updateSettings({ [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="soft-card p-5">
          <h2 className="text-xl font-bold">Voice reminders</h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 font-semibold">
              Language
              <select
                className={field}
                value={settings.language}
                onChange={(e) => updateSettings({ language: e.target.value })}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className="font-semibold">Voice</legend>
              <div className="mt-2 flex gap-2">
                {(["female", "male"] as const).map((v) => (
                  <button
                    key={v}
                    aria-pressed={settings.voice === v}
                    onClick={() => updateSettings({ voice: v })}
                    className={`min-h-12 flex-1 rounded-2xl font-bold capitalize ${
                      settings.voice === v
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="grid gap-1 font-semibold">
              Speaking speed: {settings.rate.toFixed(1)}x
              <input
                type="range"
                min={0.6}
                max={1.4}
                step={0.1}
                value={settings.rate}
                onChange={(e) => updateSettings({ rate: Number(e.target.value) })}
              />
            </label>
            <label className="grid gap-1 font-semibold">
              Volume: {Math.round(settings.volume * 100)}%
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.1}
                value={settings.volume}
                onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
              />
            </label>
            <label className="grid gap-1 font-semibold">
              Repeat reminder every
              <select
                className={field}
                value={settings.repeatEvery}
                onChange={(e) =>
                  updateSettings({ repeatEvery: Number(e.target.value) as 5 | 10 | 15 | 30 })
                }
              >
                {[5, 10, 15, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} minutes
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                speak(reminderSentence(settings.patientName, seedMedicines[0]), {
                  lang: settings.language,
                  rate: settings.rate,
                  volume: settings.volume,
                  voice: settings.voice,
                });
                toast("Playing a sample reminder");
              }}
              className="min-h-14 rounded-3xl bg-primary text-lg font-bold text-primary-foreground"
            >
              🔊 Test the voice
            </button>
          </div>
        </section>

        <section className="soft-card p-5 md:col-span-2">
          <h2 className="text-xl font-bold">Accessibility</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <fieldset>
              <legend className="font-semibold">Text size</legend>
              <div className="mt-2 flex gap-2">
                {(["normal", "large", "xlarge"] as const).map((s) => (
                  <button
                    key={s}
                    aria-pressed={settings.textSize === s}
                    onClick={() => updateSettings({ textSize: s })}
                    className={`min-h-12 flex-1 rounded-2xl font-bold ${
                      settings.textSize === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s === "xlarge" ? "XL" : s === "large" ? "L" : "M"}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-muted px-4 font-semibold">
              High contrast
              <input
                type="checkbox"
                className="size-6"
                checked={settings.highContrast}
                onChange={(e) => updateSettings({ highContrast: e.target.checked })}
              />
            </label>
            <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-muted px-4 font-semibold">
              Dark mode
              <input
                type="checkbox"
                className="size-6"
                checked={settings.darkMode}
                onChange={(e) => updateSettings({ darkMode: e.target.checked })}
              />
            </label>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
