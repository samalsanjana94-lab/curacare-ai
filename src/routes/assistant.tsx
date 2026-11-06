import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { daysLeft, dosesForDate, inventoryStatus, logKey, toKey } from "@/lib/mediguardian";
import { speak } from "@/lib/speech";
import {
  askHealthAssistant,
  runWellnessCheck,
  type WellnessCheck,
} from "@/lib/assistant.functions";
import { HeartPulse, Loader2, Send, ShieldAlert, Volume2 } from "lucide-react";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "AI Health Assistant & Wellness Check — CuraCare" },
      {
        name: "description",
        content:
          "Ask about today's schedule, medicines and gentle wellness habits, and get a daily AI wellness check in simple words.",
      },
      { property: "og:title", content: "AI Health Assistant & Wellness Check — CuraCare" },
      {
        property: "og:description",
        content: "A gentle AI helper for schedule, medicine and wellness questions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Assistant,
});

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_EN = [
  "What medicines do I take today?",
  "Which doses are still pending?",
  "Give me a gentle wellness tip",
  "What does 'after food' mean?",
];

const QUICK_HI = [
  "मेरी आज की दवाएं क्या हैं?",
  "कौन सी खुराक अभी बची है?",
  "मुझे एक स्वास्थ्य सलाह दें",
  "खाने के बाद दवा का क्या नियम है?",
];

function Assistant() {
  const { medicines, logs, vitals, settings } = useStore();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [feeling, setFeeling] = useState("");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<WellnessCheck | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Hello ${settings.patientName}. I can explain your schedule, your medicines and share gentle wellness tips. I am not a doctor — please ask your healthcare professional about medical decisions.`,
    },
  ]);

  const careContext = useMemo(() => {
    const today = toKey(new Date());
    const doses = dosesForDate(medicines);
    const pending = doses.filter((d) => !logs[logKey(d.medicine.id, today, d.slot.key)]);
    const stock = medicines
      .map((m) => `${m.name}: ${m.quantity} units, ~${daysLeft(m)} days left (${inventoryStatus(m)})`)
      .join("; ");
    const lastVital = vitals[0];
    return [
      `Person: ${settings.patientName}. Date: ${today}.`,
      `Medicines: ${medicines.map((m) => `${m.name} ${m.dosage} at ${m.times.join("/")} ${m.food}`).join("; ") || "none"}.`,
      `Doses today: ${doses.length}. Still pending: ${pending.map((d) => `${d.medicine.name} at ${d.slot.at}`).join(", ") || "none"}.`,
      `Stock: ${stock || "none"}.`,
      lastVital
        ? `Latest reading (${lastVital.date}): BP ${lastVital.bp || "—"}, sugar ${lastVital.sugar || "—"}, pulse ${lastVital.pulse || "—"}, weight ${lastVital.weight || "—"}, mood ${lastVital.mood}.`
        : "No health readings recorded yet.",
    ].join("\n");
  }, [medicines, logs, vitals, settings.patientName]);

  function say(text: string) {
    speak(text, {
      lang: settings.language,
      rate: settings.rate,
      volume: settings.volume,
      voice: settings.voice,
    });
  }

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const reply = await askHealthAssistant({
        data: {
          messages: next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          context: careContext,
          language: settings.language,
        },
      });
      setMessages([...next, { role: "assistant", content: reply }]);
      say(reply);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "The assistant is unavailable right now.";
      toast.error(msg);
      setMessages([...next, { role: "assistant", content: msg }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  async function wellness() {
    setChecking(true);
    try {
      const res = await runWellnessCheck({
        data: { feeling, context: careContext, language: settings.language },
      });
      setCheck(res);
      say(`${res.summary} ${res.suggestions.join(". ")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wellness check failed.");
    } finally {
      setChecking(false);
    }
  }

  const field = "min-h-12 w-full rounded-2xl border border-input bg-card px-4 text-base";

  return (
    <AppShell
      title="AI health assistant"
      subtitle="Ask anything about your medicines and daily routine — in simple words."
    >
      <p className="soft-card flex items-start gap-3 bg-accent/30 p-4 text-sm font-semibold">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <span>
          Medical disclaimer: CuraCare gives general information only. It cannot diagnose,
          prescribe or change your dose. Always follow your doctor or pharmacist. In an emergency,
          press SOS or call emergency services.
        </span>
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="soft-card flex min-h-[28rem] flex-col p-5">
          <h2 className="text-xl font-bold">Chat</h2>
          <ul className="mt-4 flex-1 space-y-3 overflow-y-auto" aria-live="polite">
            {messages.map((m, i) => (
              <li
                key={i}
                className={`max-w-[85%] rounded-3xl p-4 text-base ${
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.role === "assistant" ? (
                  <button
                    onClick={() => say(m.content)}
                    className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-2xl bg-card px-3 text-sm font-bold"
                  >
                    <Volume2 className="size-4" aria-hidden /> Read aloud
                  </button>
                ) : null}
              </li>
            ))}
            {busy ? (
              <li className="inline-flex items-center gap-2 rounded-3xl bg-muted p-4 font-semibold">
                <Loader2 className="size-5 animate-spin text-primary" aria-hidden /> Thinking…
              </li>
            ) : null}
            <div ref={endRef} />
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            {(settings.language?.startsWith("hi") ? QUICK_HI : QUICK_EN).map((q) => (
              <button
                key={q}
                onClick={() => void send(q)}
                className="min-h-11 rounded-2xl bg-card border border-border px-4 text-sm font-bold hover:bg-muted transition"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label className="sr-only" htmlFor="assistant-input">
              Your question
            </label>
            <input
              id="assistant-input"
              className={field}
              placeholder="Type your question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              disabled={busy}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
            >
              <Send className="size-5" aria-hidden /> Ask
            </button>
          </form>
        </section>

        <section className="soft-card h-fit p-5">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <HeartPulse className="size-5 text-primary" aria-hidden /> Daily wellness check
          </h2>
          <p className="mt-1 text-muted-foreground">
            Tell me how you feel today and I will look at your doses, stock and readings.
          </p>
          <label className="mt-4 grid gap-1 font-semibold">
            How are you feeling?
            <textarea
              className="min-h-24 w-full rounded-2xl border border-input bg-card p-4"
              placeholder="A little tired, slight headache…"
              value={feeling}
              onChange={(e) => setFeeling(e.target.value)}
            />
          </label>
          <button
            onClick={() => void wellness()}
            disabled={checking}
            className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
          >
            {checking ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            {checking ? "Checking…" : "Run wellness check"}
          </button>

          {check ? (
            <div className="mt-5 grid gap-3">
              <div className="rounded-3xl bg-gradient-sky p-4">
                <p className="font-display text-3xl font-extrabold">{check.score}/100</p>
                <p className="font-semibold">{check.mood}</p>
              </div>
              <p className="text-base">{check.summary}</p>
              {check.suggestions?.length ? (
                <div>
                  <p className="font-bold">Try this today</p>
                  <ul className="mt-1 list-inside list-disc text-muted-foreground">
                    {check.suggestions.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {check.watchFor?.length ? (
                <div className="rounded-2xl bg-muted p-4">
                  <p className="font-bold">Keep an eye on</p>
                  <ul className="mt-1 list-inside list-disc">
                    {check.watchFor.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {check.seeDoctor ? (
                <p className="rounded-2xl bg-destructive/15 p-4 font-bold text-destructive">
                  Please speak to your doctor about this soon.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
