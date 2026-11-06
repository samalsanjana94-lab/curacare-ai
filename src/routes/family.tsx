import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, KeyRound, Link2, Trash2, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ActivityHistory } from "@/components/ActivityHistory";
import { AlertPreferences } from "@/components/AlertPreferences";
import { FamilyVoiceReminders } from "@/components/FamilyVoiceReminders";
import { listCareAlerts } from "@/lib/alerts.functions";
import { useStore } from "@/lib/store";
import {
  acknowledgePatientAlert,
  createInviteCode,
  getPatientOverview,
  listFamilyLinks,
  redeemInviteCode,
  removeFamilyLink,
  type FamilyLink,
} from "@/lib/family.functions";
import { dosesForDate, logKey, toKey, type DoseLog, type Medicine, type Vital } from "@/lib/mediguardian";

export const Route = createFileRoute("/family")({
  head: () => ({
    meta: [
      { title: "Family & Caregivers — CuraCare" },
      {
        name: "description",
        content: "Connect a patient with family caregivers using a simple invite code.",
      },
      { property: "og:title", content: "Family & Caregivers — CuraCare" },
      {
        property: "og:description",
        content: "Share a code, connect caregivers, and watch medicines together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FamilyPage,
});

function FamilyPage() {
  const { signedIn } = useStore();
  if (!signedIn) {
    return (
      <AppShell title="Family & caregivers" subtitle="Connect with the people who help you.">
        <div className="soft-card p-6">
          <p className="text-lg">Please sign in first so we can connect your accounts safely.</p>
          <Link
            to="/auth"
            className="mt-4 inline-flex min-h-12 items-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      </AppShell>
    );
  }
  return <Connected />;
}

function Connected() {
  const qc = useQueryClient();
  const list = useServerFn(listFamilyLinks);
  const createCode = useServerFn(createInviteCode);
  const redeem = useServerFn(redeemInviteCode);
  const remove = useServerFn(removeFamilyLink);
  const links = useQuery({ queryKey: ["family-links"], queryFn: () => list() });
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);

  const patients = (links.data ?? []).filter((l) => l.role === "patient");
  const caregivers = (links.data ?? []).filter((l) => l.role === "caregiver");

  async function makeCode() {
    setBusy(true);
    try {
      setCode(await createCode());
    } catch {
      toast.error("Could not create a code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    try {
      await redeem({ data: { code: entry } });
      toast.success("Connected! You can now see their medicines.");
      setEntry("");
      void qc.invalidateQueries({ queryKey: ["family-links"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink(l: FamilyLink) {
    if (!confirm(`Disconnect from ${l.name}?`)) return;
    await remove({ data: { id: l.id } });
    void qc.invalidateQueries({ queryKey: ["family-links"] });
  }

  return (
    <AppShell title="Family & caregivers" subtitle="Connect with the people who help you.">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="soft-card p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <KeyRound className="size-5 text-primary" aria-hidden /> I take the medicines
          </h2>
          <p className="mt-1 text-muted-foreground">
            Create a code and give it to your son, daughter or nurse. It works once, for 2 days.
          </p>
          {code ? (
            <div className="mt-4 rounded-2xl bg-muted p-5 text-center">
              <p className="font-display text-4xl font-extrabold tracking-[0.3em]">{code.code}</p>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(code.code);
                  toast.success("Code copied");
                }}
                className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-secondary px-5 font-bold text-secondary-foreground"
              >
                <Copy className="size-4" aria-hidden /> Copy code
              </button>
            </div>
          ) : (
            <button
              onClick={makeCode}
              disabled={busy}
              className="mt-4 min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
            >
              Create invite code
            </button>
          )}
          <h3 className="mt-6 font-bold">My caregivers</h3>
          <LinkList items={caregivers} onRemove={unlink} empty="No caregivers connected yet." />
        </section>

        <section className="soft-card p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Link2 className="size-5 text-primary" aria-hidden /> I look after someone
          </h2>
          <p className="mt-1 text-muted-foreground">Type the code they gave you.</p>
          <div className="mt-4 flex gap-2">
            <input
              value={entry}
              onChange={(e) => setEntry(e.target.value.toUpperCase())}
              placeholder="ABC123"
              aria-label="Invite code"
              maxLength={12}
              className="min-h-14 min-w-0 flex-1 rounded-2xl border bg-background px-4 text-center font-display text-2xl tracking-[0.2em]"
            />
            <button
              onClick={join}
              disabled={busy || entry.trim().length < 4}
              className="min-h-14 rounded-2xl bg-primary px-6 font-bold text-primary-foreground disabled:opacity-60"
            >
              Connect
            </button>
          </div>
          <h3 className="mt-6 font-bold">People I care for</h3>
          <LinkList items={patients} onRemove={unlink} empty="Nobody connected yet." />
        </section>
      </div>

      {patients.map((p) => (
        <PatientOverview key={p.id} link={p} />
      ))}

      <AlertPreferences />
      <MyHistory />
    </AppShell>
  );
}

function LinkList({
  items,
  onRemove,
  empty,
}: {
  items: FamilyLink[];
  onRemove: (l: FamilyLink) => void;
  empty: string;
}) {
  if (!items.length) return <p className="mt-2 text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-2 space-y-2">
      {items.map((l) => (
        <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-muted p-3">
          <UserRound className="size-5 text-primary" aria-hidden />
          <span className="flex-1 font-semibold">{l.name}</span>
          <button
            onClick={() => onRemove(l)}
            aria-label={`Disconnect ${l.name}`}
            className="grid size-11 place-items-center rounded-2xl hover:bg-background"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

function PatientOverview({ link }: { link: FamilyLink }) {
  const qc = useQueryClient();
  const get = useServerFn(getPatientOverview);
  const ack = useServerFn(acknowledgePatientAlert);
  const q = useQuery({
    queryKey: ["patient-overview", link.otherId],
    queryFn: () => get({ data: { patientId: link.otherId } }),
    refetchInterval: 30_000,
  });
  const snap = (q.data?.snapshot ? JSON.parse(q.data.snapshot) : null) as
    | { medicines?: Medicine[]; logs?: Record<string, DoseLog>; settings?: { patientName?: string }; vitals?: Vital[] }
    | null
    | undefined;
  const meds = snap?.medicines ?? [];
  const logs = snap?.logs ?? {};
  const today = toKey(new Date());
  const doses = dosesForDate(meds);
  const nowHour = new Date().getHours();

  return (
    <section className="soft-card mt-5 p-6">
      <h2 className="text-xl font-bold">{snap?.settings?.patientName ?? link.name} — today</h2>
      {q.isLoading ? (
        <p className="mt-2 text-muted-foreground">Loading…</p>
      ) : !snap ? (
        <p className="mt-2 text-muted-foreground">
          They have not synced any medicines yet.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Last updated {q.data?.updatedAt ? new Date(q.data.updatedAt).toLocaleString() : "—"}
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {doses.map((d) => {
              const st = logs[logKey(d.medicine.id, today, d.slot.key)]?.status;
              const late = !st && d.slot.hour < nowHour;
              return (
                <li
                  key={d.medicine.id + d.slot.key}
                  className="flex items-center justify-between rounded-2xl bg-muted p-3"
                >
                  <span>
                    <b>{d.medicine.name}</b>{" "}
                    <span className="text-muted-foreground">· {d.slot.key}</span>
                  </span>
                  <span
                    className={
                      st === "taken"
                        ? "font-bold text-primary"
                        : late || st === "skipped"
                          ? "font-bold text-destructive"
                          : "text-muted-foreground"
                    }
                  >
                    {st === "taken" ? "Taken" : st === "skipped" ? "Skipped" : late ? "Missed" : "Upcoming"}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {q.data?.alerts.length ? (
        <>
          <h3 className="mt-5 font-bold">Recent alerts</h3>
          <ul className="mt-2 space-y-2">
            {q.data.alerts.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-muted p-3">
                <span className="flex-1">
                  <b>{a.title}</b>
                  <span className="block text-sm text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </span>
                {a.acknowledged ? (
                  <CheckCircle2 className="size-5 text-primary" aria-label="Seen" />
                ) : (
                  <button
                    onClick={async () => {
                      await ack({ data: { id: a.id } });
                      void qc.invalidateQueries({ queryKey: ["patient-overview", link.otherId] });
                    }}
                    className="min-h-11 rounded-2xl bg-primary px-4 font-bold text-primary-foreground"
                  >
                    Seen
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="mt-6">
        <FamilyVoiceReminders patientId={link.otherId} medicines={meds} mode="caregiver" />
      </div>
      {snap ? (
        <>
          <h3 className="mt-6 font-bold">Activity history</h3>
          <div className="mt-2">
            <ActivityHistory
              medicines={meds}
              logs={logs}
              vitals={snap.vitals ?? []}
              alerts={q.data?.alerts ?? []}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

function MyHistory() {
  const { medicines, logs, vitals } = useStore();
  const list = useServerFn(listCareAlerts);
  const alerts = useQuery({ queryKey: ["my-alert-history"], queryFn: () => list() });
  return (
    <>
      <section className="soft-card mt-5 p-6">
        <FamilyVoiceReminders patientId={null} medicines={medicines} mode="patient" />
      </section>
      <section className="soft-card mt-5 p-6">
        <h2 className="text-xl font-bold">My activity history</h2>
        <p className="mt-1 text-muted-foreground">Doses, check-ins, alerts and when family saw them.</p>
        <div className="mt-4">
          <ActivityHistory medicines={medicines} logs={logs} vitals={vitals} alerts={alerts.data ?? []} />
        </div>
      </section>
    </>
  );
}
