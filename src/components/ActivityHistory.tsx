import { useMemo, useState } from "react";
import { BellRing, CheckCircle2, HeartPulse, Pill, SkipForward } from "lucide-react";
import type { DoseLog, Medicine, Vital } from "@/lib/mediguardian";
import { cn } from "@/lib/utils";

export type HistoryAlert = {
  id: string;
  title: string;
  detail?: string | null;
  created_at: string;
  acknowledged: boolean;
  acknowledged_at?: string | null;
};

type Kind = "dose" | "wellness" | "alert" | "ack";
type Entry = { id: string; kind: Kind; at: string; title: string; detail?: string; bad?: boolean };

const FILTERS: { key: Kind | "all"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "dose", label: "Doses" },
  { key: "wellness", label: "Check-ins" },
  { key: "alert", label: "Alerts" },
  { key: "ack", label: "Seen by family" },
];

const RANGES = [7, 30, 90] as const;

export function ActivityHistory({
  medicines,
  logs,
  vitals,
  alerts,
}: {
  medicines: Medicine[];
  logs: Record<string, DoseLog>;
  vitals: Vital[];
  alerts: HistoryAlert[];
}) {
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);

  const entries = useMemo(() => {
    const names = new Map(medicines.map((m) => [m.id, m.name]));
    const list: Entry[] = [];
    Object.values(logs).forEach((l) => {
      // seeded/older logs store only the date; place them at the slot time
      const at = l.at.length > 10 ? l.at : `${l.date}T12:00:00`;
      list.push({
        id: `d-${l.id}`,
        kind: "dose",
        at,
        title: `${names.get(l.medicineId) ?? "Medicine"} ${l.status === "taken" ? "taken" : "skipped"}`,
        detail: `${l.time} dose`,
        bad: l.status === "skipped",
      });
    });
    vitals
      .filter((v) => v.note?.startsWith("Wellness:"))
      .forEach((v) =>
        list.push({
          id: `w-${v.id}`,
          kind: "wellness",
          at: `${v.date}T09:00:00`,
          title: `Feeling ${v.mood.toLowerCase()}`,
          detail: v.note?.replace("Wellness: ", "Symptoms: "),
          bad: v.mood === "Not well" || v.mood === "Unwell",
        }),
      );
    alerts.forEach((a) => {
      list.push({ id: `a-${a.id}`, kind: "alert", at: a.created_at, title: a.title, detail: a.detail ?? undefined, bad: true });
      if (a.acknowledged && a.acknowledged_at)
        list.push({ id: `k-${a.id}`, kind: "ack", at: a.acknowledged_at, title: `Seen: ${a.title}` });
    });
    const cutoff = Date.now() - days * 86_400_000;
    return list
      .filter((e) => new Date(e.at).getTime() >= cutoff)
      .filter((e) => filter === "all" || e.kind === filter)
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [medicines, logs, vitals, alerts, filter, days]);

  const grouped = useMemo(() => {
    const g = new Map<string, Entry[]>();
    entries.forEach((e) => {
      const k = new Date(e.at).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
      g.set(k, [...(g.get(k) ?? []), e]);
    });
    return [...g.entries()];
  }, [entries]);

  const icon = (e: Entry) => {
    if (e.kind === "dose") return e.bad ? SkipForward : Pill;
    if (e.kind === "wellness") return HeartPulse;
    if (e.kind === "ack") return CheckCircle2;
    return BellRing;
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              "min-h-11 rounded-2xl px-4 text-sm font-bold",
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex gap-1 rounded-2xl bg-muted p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              aria-pressed={days === r}
              className={cn(
                "min-h-9 rounded-xl px-3 text-sm font-bold",
                days === r ? "bg-background" : "text-muted-foreground",
              )}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>
      {grouped.length === 0 ? (
        <p className="mt-4 text-muted-foreground">Nothing recorded in this period.</p>
      ) : (
        <div className="mt-4 max-h-[32rem] space-y-4 overflow-y-auto pr-1">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <h4 className="sticky top-0 bg-card py-1 text-sm font-bold text-muted-foreground">{day}</h4>
              <ul className="mt-1 space-y-2">
                {items.map((e) => {
                  const Icon = icon(e);
                  return (
                    <li key={e.id} className="flex items-start gap-3 rounded-2xl bg-muted p-3">
                      <Icon
                        className={cn("mt-0.5 size-5 shrink-0", e.bad ? "text-destructive" : "text-primary")}
                        aria-hidden
                      />
                      <span className="flex-1">
                        <b>{e.title}</b>
                        {e.detail ? <span className="block text-sm text-muted-foreground">{e.detail}</span> : null}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
