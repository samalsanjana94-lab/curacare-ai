import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { HeartPulse, Package, PhoneCall, Pill, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { getPatientOverview, listFamilyLinks } from "@/lib/family.functions";
import {
  INVENTORY_LABEL,
  daysLeft,
  dosesForDate,
  inventoryStatus,
  logKey,
  missedStreak,
  toKey,
  type DoseLog,
  type Medicine,
  type Vital,
} from "@/lib/mediguardian";
import { cn } from "@/lib/utils";
import logo from "@/assets/curacare-logo.png";

export const Route = createFileRoute("/care-essentials")({
  head: () => ({
    meta: [
      { title: "Caregiver Essentials — CuraCare" },
      {
        name: "description",
        content: "A simple phone view for caregivers: missed doses, adherence, stock and health readings.",
      },
      { property: "og:title", content: "Caregiver Essentials — CuraCare" },
      {
        property: "og:description",
        content: "Only what matters, in big clear cards made for phones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Essentials,
});

type Snapshot = {
  medicines: Medicine[];
  logs: Record<string, DoseLog>;
  vitals: Vital[];
  name: string;
  phone?: string;
};

function Essentials() {
  const store = useStore();
  const listLinks = useServerFn(listFamilyLinks);
  const getOverview = useServerFn(getPatientOverview);
  const links = useQuery({
    queryKey: ["family-links"],
    queryFn: () => listLinks(),
    enabled: store.signedIn,
  });
  const patients = (links.data ?? []).filter((l) => l.role === "patient");
  const [pick, setPick] = useState<string | null>(null);
  const active = pick ?? patients[0]?.otherId ?? null;
  const remote = useQuery({
    queryKey: ["patient-overview", active],
    queryFn: () => getOverview({ data: { patientId: active! } }),
    enabled: !!active,
    refetchInterval: 30_000,
  });

  let snap: Snapshot;
  if (active && remote.data?.snapshot) {
    const s = JSON.parse(remote.data.snapshot) as Partial<{
      medicines: Medicine[];
      logs: Record<string, DoseLog>;
      vitals: Vital[];
      settings: { patientName?: string };
    }>;
    snap = {
      medicines: s.medicines ?? [],
      logs: s.logs ?? {},
      vitals: s.vitals ?? [],
      name: s.settings?.patientName ?? "Patient",
    };
  } else {
    snap = {
      medicines: store.medicines,
      logs: store.logs,
      vitals: store.vitals,
      name: store.settings.patientName,
    };
  }

  const today = toKey(new Date());
  const hour = new Date().getHours();
  const doses = dosesForDate(snap.medicines);
  const missedToday = doses.filter(
    (d) => d.slot.hour < hour && snap.logs[logKey(d.medicine.id, today, d.slot.key)]?.status !== "taken",
  );
  const streak = missedStreak(snap.medicines, snap.logs);

  let due = 0;
  let taken = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = toKey(d);
    doses.forEach((x) => {
      if (i === 0 && x.slot.hour >= hour) return;
      due++;
      if (snap.logs[logKey(x.medicine.id, k, x.slot.key)]?.status === "taken") taken++;
    });
  }
  const adherence = due ? Math.round((taken / due) * 100) : 100;
  const lowStock = snap.medicines.filter((m) => inventoryStatus(m) !== "ok");
  const latest = snap.vitals.find((v) => v.bp || v.sugar || v.pulse || v.weight);
  const mood = snap.vitals.find((v) => v.note?.startsWith("Wellness:"));

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-10 pt-4">
      <header className="flex items-center gap-3">
        <img src={logo} alt="" width={44} height={44} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Caring for</p>
          <h1 className="truncate font-display text-2xl font-semibold">{snap.name}</h1>
        </div>
        <Link to="/caregiver" className="rounded-2xl bg-muted px-3 py-2 text-sm font-bold">
          Full view
        </Link>
      </header>

      {patients.length > 1 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {patients.map((p) => (
            <button
              key={p.id}
              onClick={() => setPick(p.otherId)}
              className={cn(
                "min-h-12 shrink-0 rounded-2xl px-4 font-bold",
                active === p.otherId ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : null}

      {!active ? (
        <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
          Showing this device. <Link to="/family" className="font-bold text-primary underline">Connect a patient</Link> to see their phone's data.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4">
        <Card
          icon={Pill}
          tone={missedToday.length || streak ? "bad" : "good"}
          label="Missed doses"
          value={missedToday.length ? `${missedToday.length} today` : "None today"}
        >
          {missedToday.length ? (
            <ul className="mt-2 space-y-1 text-base">
              {missedToday.map((d) => (
                <li key={d.medicine.id + d.slot.key}>
                  {d.medicine.name} · {d.slot.key}
                </li>
              ))}
            </ul>
          ) : null}
          {streak ? (
            <p className="mt-2 font-bold text-destructive">
              Doses missed {streak} day{streak > 1 ? "s" : ""} in a row
            </p>
          ) : null}
        </Card>

        <Card
          icon={TrendingUp}
          tone={adherence >= 80 ? "good" : adherence >= 60 ? "warn" : "bad"}
          label="Taken this week"
          value={`${adherence}%`}
        >
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${adherence}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {taken} of {due} doses in the last 7 days
          </p>
        </Card>

        <Card
          icon={Package}
          tone={lowStock.length ? "warn" : "good"}
          label="Medicine stock"
          value={lowStock.length ? `${lowStock.length} running low` : "All stocked"}
        >
          {lowStock.length ? (
            <ul className="mt-2 space-y-1 text-base">
              {lowStock.map((m) => (
                <li key={m.id}>
                  {m.name} — {INVENTORY_LABEL[inventoryStatus(m)]}, {daysLeft(m)} days left
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card icon={HeartPulse} tone="neutral" label="Health" value={mood ? `Feeling ${mood.mood.toLowerCase()}` : "No check-in yet"}>
          {latest ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-base">
              {latest.bp ? <Stat k="Blood pressure" v={latest.bp} /> : null}
              {latest.sugar ? <Stat k="Sugar" v={latest.sugar} /> : null}
              {latest.pulse ? <Stat k="Pulse" v={latest.pulse} /> : null}
              {latest.weight ? <Stat k="Weight" v={`${latest.weight} kg`} /> : null}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No readings recorded yet.</p>
          )}
          <Link to="/health" className="mt-3 inline-block font-bold text-primary underline">
            Open health report
          </Link>
        </Card>
      </div>

      <a
        href={store.settings.caregiverPhone ? `tel:${store.settings.caregiverPhone.replace(/\s/g, "")}` : undefined}
        className="mt-6 flex min-h-16 items-center justify-center gap-2 rounded-3xl bg-destructive text-lg font-bold text-destructive-foreground"
      >
        <PhoneCall className="size-5" aria-hidden /> Call now
      </a>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-muted p-3">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-bold">{v}</dd>
    </div>
  );
}

function Card({
  icon: Icon,
  tone,
  label,
  value,
  children,
}: {
  icon: typeof Pill;
  tone: "good" | "warn" | "bad" | "neutral";
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "soft-card border-l-8 p-5",
        tone === "good" && "border-l-success",
        tone === "warn" && "border-l-warning",
        tone === "bad" && "border-l-destructive",
        tone === "neutral" && "border-l-secondary",
      )}
    >
      <p className="flex items-center gap-2 font-semibold text-muted-foreground">
        <Icon className="size-5" aria-hidden /> {label}
      </p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
      {children}
    </section>
  );
}
