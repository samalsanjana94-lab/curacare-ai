import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Play, RotateCcw, Save, Square, Volume2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { LANGUAGES, defaultSettings, reminderSentence } from "@/lib/mediguardian";
import { speak, stopSpeaking } from "@/lib/speech";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "Voice Reminder Editor — CuraCare" },
      {
        name: "description",
        content:
          "Write the exact words your reminder should say, choose the language, voice and speed, and hear a preview before you save.",
      },
      { property: "og:title", content: "Voice Reminder Editor — CuraCare" },
      {
        property: "og:description",
        content: "Personalise every spoken medicine reminder in your own words and language.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RemindersPage,
});

const TOKENS = ["{name}", "{medicine}", "{dosage}", "{food}", "{time}"];

function RemindersPage() {
  const { medicines, settings, updateSettings, updateMedicine } = useStore();
  const [template, setTemplate] = useState(
    settings.reminderTemplate || defaultSettings.reminderTemplate,
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const voiceOpts = {
    lang: settings.language,
    rate: settings.rate,
    volume: settings.volume,
    voice: settings.voice,
  };

  const sample = medicines[0];
  const field = "min-h-12 w-full rounded-2xl border border-input bg-card px-4 text-base";

  function preview(text: string) {
    if (!sample) {
      speak(text.replaceAll("{name}", settings.patientName), voiceOpts);
      return;
    }
    speak(reminderSentence(settings.patientName, { ...sample, reminderText: text }, text), voiceOpts);
  }

  function saveTemplate() {
    const value = template.trim();
    if (!value) {
      toast.error("Please write what the reminder should say");
      return;
    }
    if (value.length > 300) {
      toast.error("Please keep the reminder shorter than 300 characters");
      return;
    }
    updateSettings({ reminderTemplate: value });
    toast.success("Reminder wording saved");
  }

  return (
    <AppShell
      title="Voice reminder editor"
      subtitle="Choose the words, language and speed of every spoken reminder — then listen before you save."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="soft-card p-5">
          <h2 className="text-xl font-bold">What every reminder says</h2>
          <p className="mt-1 text-muted-foreground">
            Use these words and they will be filled in automatically:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TOKENS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTemplate((v) => `${v} ${t}`.trim())}
                className="min-h-10 rounded-2xl bg-muted px-3 font-mono text-sm font-bold"
              >
                {t}
              </button>
            ))}
          </div>
          <label className="mt-4 grid gap-1 font-semibold">
            Reminder wording
            <textarea
              rows={4}
              maxLength={300}
              className="w-full rounded-2xl border border-input bg-card p-4 text-base"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => preview(template)}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-card px-5 font-bold"
            >
              <Play className="size-5" aria-hidden /> Hear it
            </button>
            <button
              type="button"
              onClick={() => stopSpeaking()}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-card px-5 font-bold"
            >
              <Square className="size-5" aria-hidden /> Stop
            </button>
            <button
              type="button"
              onClick={() => setTemplate(defaultSettings.reminderTemplate)}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-card px-5 font-bold"
            >
              <RotateCcw className="size-5" aria-hidden /> Reset
            </button>
            <button
              type="button"
              onClick={saveTemplate}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-bold text-primary-foreground"
            >
              <Save className="size-5" aria-hidden /> Save wording
            </button>
          </div>
        </section>

        <section className="soft-card p-5">
          <h2 className="text-xl font-bold">How it sounds</h2>
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
                    type="button"
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
              Speaking speed ({settings.rate.toFixed(1)}x)
              <input
                type="range"
                min={0.5}
                max={1.3}
                step={0.1}
                value={settings.rate}
                onChange={(e) => updateSettings({ rate: Number(e.target.value) })}
              />
            </label>
            <label className="grid gap-1 font-semibold">
              Volume ({Math.round(settings.volume * 100)}%)
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.1}
                value={settings.volume}
                onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
              />
            </label>
            <label className="grid gap-1 font-semibold">
              Repeat an unanswered reminder every
              <select
                className={field}
                value={settings.repeatEvery}
                onChange={(e) =>
                  updateSettings({ repeatEvery: Number(e.target.value) as 5 | 10 | 15 | 30 })
                }
              >
                {[5, 10, 15, 30].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      </div>

      <section className="soft-card mt-6 p-5">
        <h2 className="text-xl font-bold">Words for one medicine</h2>
        <p className="mt-1 text-muted-foreground">
          Leave blank to use the wording above. Handy for special instructions like “take with warm
          water”.
        </p>
        <div className="mt-4 grid gap-4">
          {medicines.map((m) => {
            const value = drafts[m.id] ?? m.reminderText ?? "";
            return (
              <div key={m.id} className="rounded-2xl border border-border p-4">
                <p className="font-bold">
                  {m.name} <span className="font-normal text-muted-foreground">· {m.dosage}</span>
                </p>
                <textarea
                  rows={2}
                  maxLength={300}
                  placeholder="Use the standard reminder"
                  className="mt-2 w-full rounded-2xl border border-input bg-card p-3 text-base"
                  value={value}
                  onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      speak(
                        reminderSentence(
                          settings.patientName,
                          { ...m, reminderText: value },
                          settings.reminderTemplate,
                        ),
                        voiceOpts,
                      )
                    }
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-card px-4 font-bold"
                  >
                    <Volume2 className="size-5" aria-hidden /> Hear it
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateMedicine(m.id, { reminderText: value.trim() || undefined });
                      toast.success(`Reminder saved for ${m.name}`);
                    }}
                    className="min-h-11 rounded-2xl bg-primary px-4 font-bold text-primary-foreground"
                  >
                    Save
                  </button>
                </div>
              </div>
            );
          })}
          {!medicines.length ? (
            <p className="text-muted-foreground">Add a medicine first and it will appear here.</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
