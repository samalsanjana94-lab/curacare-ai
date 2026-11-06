import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { speak } from "@/lib/speech";
import {
  INVENTORY_LABEL,
  daysLeft,
  daysToExpiry,
  dosesPerDay,
  expiryStatus,
  inventoryStatus,
  refillThreshold,
  runOutDate,
  type InventoryStatus,
  type Medicine,
} from "@/lib/mediguardian";
import { Boxes, PackagePlus, PhoneCall, Volume2 } from "lucide-react";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Medicine Stock & Refills — CuraCare" },
      {
        name: "description",
        content:
          "Track how many days of each medicine are left and get gentle refill reminders before you run out.",
      },
      { property: "og:title", content: "Medicine Stock & Refills — CuraCare" },
      {
        property: "og:description",
        content: "Smart inventory with days-left estimates and one-tap refills.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inventory,
});

const TONE: Record<InventoryStatus, string> = {
  ok: "bg-secondary/40 text-foreground",
  low: "bg-[var(--peach)] text-foreground",
  critical: "bg-destructive/15 text-destructive",
  empty: "bg-destructive text-destructive-foreground",
};

function Bar({ m }: { m: Medicine }) {
  const pct = Math.max(4, Math.min(100, (daysLeft(m) / (refillThreshold(m) * 3)) * 100));
  const status = inventoryStatus(m);
  return (
    <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{
          width: `${pct}%`,
          background:
            status === "ok"
              ? "var(--primary)"
              : status === "low"
                ? "var(--peach)"
                : "var(--destructive)",
        }}
      />
    </div>
  );
}

function Inventory() {
  const { medicines, refillMedicine, updateMedicine, settings } = useStore();
  const [refillSize, setRefillSize] = useState<Record<string, number>>({});

  const sorted = useMemo(
    () => [...medicines].sort((a, b) => daysLeft(a) - daysLeft(b)),
    [medicines],
  );
  const needsRefill = sorted.filter((m) => inventoryStatus(m) !== "ok");
  const expiring = sorted.filter((m) => expiryStatus(m) === "soon" || expiryStatus(m) === "expired");

  function announce() {
    const stockText = needsRefill.length
      ? `You need to refill ${needsRefill.length} medicine${needsRefill.length > 1 ? "s" : ""}: ${needsRefill
          .map((m) => `${m.name}, ${daysLeft(m)} days left`)
          .join(". ")}`
      : "All your medicines have enough stock. Nothing to refill today.";
    const expiryText = expiring.length
      ? ` Also check expiry dates: ${expiring
          .map((m) =>
            expiryStatus(m) === "expired"
              ? `${m.name} has expired`
              : `${m.name} expires in ${daysToExpiry(m)} days`,
          )
          .join(". ")}.`
      : "";
    speak(stockText + expiryText, {
      lang: settings.language,
      rate: settings.rate,
      volume: settings.volume,
      voice: settings.voice,
    });
  }

  const field = "min-h-12 w-full rounded-2xl border border-input bg-card px-4 text-base";

  return (
    <AppShell
      title="Stock & refills"
      subtitle="We count every dose so a box never runs empty by surprise."
    >
      <section className="soft-card flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-14 place-items-center rounded-3xl bg-gradient-lav">
          <Boxes className="size-6 text-primary" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">
            {needsRefill.length
              ? `${needsRefill.length} medicine${needsRefill.length > 1 ? "s" : ""} need a refill`
              : "Every medicine is well stocked"}
          </h2>
          <p className="text-muted-foreground">
            {needsRefill.length
              ? `Soonest to run out: ${needsRefill[0]?.name} in ${daysLeft(needsRefill[0]!)} days.`
              : "We will warn you a week before anything runs out."}
            {expiring.length
              ? ` ${expiring.length} pack${expiring.length > 1 ? "s need" : " needs"} an expiry check.`
              : ""}
          </p>
        </div>
        <button
          onClick={announce}
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-bold text-primary-foreground"
        >
          <Volume2 className="size-5" aria-hidden /> Read aloud
        </button>
      </section>

      <ul className="mt-6 grid gap-4 lg:grid-cols-2">
        {sorted.map((m) => {
          const status = inventoryStatus(m);
          const size = refillSize[m.id] ?? 30;
          return (
            <li key={m.id} className="soft-card p-5">
              <div className="flex items-start gap-3">
                <span
                  className="size-12 shrink-0 rounded-2xl border border-border"
                  style={{ background: m.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-bold">{m.name}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${TONE[status]}`}>
                      {INVENTORY_LABEL[status]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {m.quantity} units left · {dosesPerDay(m)} per day ·{" "}
                    {Number.isFinite(daysLeft(m)) ? `${daysLeft(m)} days` : "—"} of cover
                  </p>
                  {runOutDate(m) ? (
                    <p className="text-sm text-muted-foreground">Runs out on {runOutDate(m)}</p>
                  ) : null}
                  {expiryStatus(m) === "expired" ? (
                    <p className="mt-1 rounded-2xl bg-destructive/15 px-3 py-2 text-sm font-bold text-destructive">
                      Expired on {m.expiryDate}. Please do not take it — replace this pack.
                    </p>
                  ) : expiryStatus(m) === "soon" ? (
                    <p className="mt-1 rounded-2xl bg-[var(--peach)] px-3 py-2 text-sm font-bold">
                      Expires in {daysToExpiry(m)} days ({m.expiryDate}).
                    </p>
                  ) : m.expiryDate ? (
                    <p className="text-sm text-muted-foreground">Expires {m.expiryDate}</p>
                  ) : null}
                  <Bar m={m} />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">
                  Refill size (units)
                  <input
                    type="number"
                    min={1}
                    className={field}
                    value={size}
                    onChange={(e) =>
                      setRefillSize((s) => ({ ...s, [m.id]: Number(e.target.value) }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Warn me (days before)
                  <input
                    type="number"
                    min={1}
                    className={field}
                    value={refillThreshold(m)}
                    onChange={(e) => updateMedicine(m.id, { refillDays: Number(e.target.value) })}
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Pharmacy
                  <input
                    className={field}
                    placeholder="Sunrise Medical Store"
                    value={m.pharmacy ?? ""}
                    onChange={(e) => updateMedicine(m.id, { pharmacy: e.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Expiry date
                  <input
                    type="date"
                    className={field}
                    value={m.expiryDate ?? ""}
                    onChange={(e) => updateMedicine(m.id, { expiryDate: e.target.value })}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    refillMedicine(m.id, size);
                    toast.success(`${m.name} refilled`, {
                      description: `${size} units added to the box.`,
                    });
                  }}
                  className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-3xl bg-primary text-lg font-bold text-primary-foreground"
                >
                  <PackagePlus className="size-5" aria-hidden /> Mark refilled
                </button>
                <a
                  href={`tel:${settings.caregiverPhone.replace(/\s/g, "")}`}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-card px-5 text-lg font-bold"
                >
                  <PhoneCall className="size-5" aria-hidden /> Ask for help
                </a>
              </div>
              {m.lastRefilledAt ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Last refilled {new Date(m.lastRefilledAt).toLocaleDateString()}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
