import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { checkInteractions } from "@/lib/interactions.functions";
import {
  INTERACTION_DISCLAIMER,
  SEVERITY_HELP,
  SEVERITY_LABEL,
  SEVERITY_RANK,
  type InteractionReport,
  type Severity,
} from "@/lib/interactions";

export const Route = createFileRoute("/interactions")({
  head: () => ({
    meta: [
      { title: "Medicine Safety Check — CuraCare" },
      {
        name: "description",
        content:
          "Check your medicines for known interactions, with clear severity labels and simple guidance.",
      },
      { property: "og:title", content: "Medicine Safety Check — CuraCare" },
      {
        property: "og:description",
        content: "See which of your medicines may not mix well, explained in plain words.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Interactions,
});

const TONE: Record<Severity, string> = {
  minor: "bg-muted text-foreground",
  moderate: "bg-accent text-accent-foreground",
  major: "bg-destructive/15 text-destructive",
  contraindicated: "bg-destructive text-destructive-foreground",
};

function Interactions() {
  const { medicines } = useStore();
  const [selected, setSelected] = useState<string[]>(() => medicines.map((m) => m.id));
  const [report, setReport] = useState<InteractionReport | null>(null);
  const [busy, setBusy] = useState(false);

  const names = medicines.filter((m) => selected.includes(m.id)).map((m) => m.name.trim()).filter(Boolean);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function run() {
    if (names.length < 2) {
      toast.error("Pick at least two medicines to compare");
      return;
    }
    setBusy(true);
    try {
      const out = await checkInteractions({ data: { drugs: names } });
      out.pairs.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
      setReport(out);
      toast.success(out.pairs.length ? "Check complete" : "No known interactions found");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not check right now");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Medicine safety check"
      subtitle="See which of your medicines may not mix well together."
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="soft-card h-fit p-5">
          <h2 className="text-xl font-bold">Medicines to check</h2>
          {medicines.length < 2 ? (
            <p className="mt-3 text-muted-foreground">
              Add at least two medicines first, then come back here.
            </p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {medicines.map((m) => (
                <li key={m.id}>
                  <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-muted px-4 font-semibold">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={selected.includes(m.id)}
                      onChange={() => toggle(m.id)}
                    />
                    <span className="truncate">
                      {m.name}
                      <span className="ml-1 font-normal text-muted-foreground">{m.dosage}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={run}
            disabled={busy || names.length < 2}
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            {busy ? "Checking…" : "Check my medicines"}
          </button>
        </section>

        <section className="grid gap-4">
          <p className="soft-card p-4 text-sm font-semibold text-muted-foreground">
            {INTERACTION_DISCLAIMER}
          </p>

          {report ? (
            <>
              <p className="text-sm text-muted-foreground">
                Source: <strong>{report.sourceName}</strong> · checked{" "}
                {new Date(report.checkedAt).toLocaleString()}
              </p>
              {report.pairs.length === 0 ? (
                <div className="soft-card flex items-start gap-3 p-5">
                  <ShieldCheck className="size-6 shrink-0 text-primary" aria-hidden />
                  <p className="font-semibold">
                    No well-known interactions were found between these medicines. Still mention your full
                    list at every visit.
                  </p>
                </div>
              ) : (
                <ul className="grid gap-4">
                  {report.pairs.map((p, i) => (
                    <li key={`${p.a}-${p.b}-${i}`} className="soft-card p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <AlertTriangle className="size-5 text-destructive" aria-hidden />
                        <h3 className="text-lg font-bold">
                          {p.a} + {p.b}
                        </h3>
                        <span
                          className={`rounded-2xl px-3 py-1 text-sm font-bold ${TONE[p.severity]}`}
                        >
                          {SEVERITY_LABEL[p.severity]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{SEVERITY_HELP[p.severity]}</p>
                      <p className="mt-3">{p.summary}</p>
                      {p.advice ? <p className="mt-2 font-semibold">{p.advice}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="soft-card p-5 text-muted-foreground">
              Choose your medicines and press <strong>Check my medicines</strong>. Results are shown with a
              clear severity label.
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
