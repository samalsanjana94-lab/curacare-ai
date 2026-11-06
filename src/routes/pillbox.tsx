import { createFileRoute } from "@tanstack/react-router";
import { Check, Minus, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { TIME_SLOTS, dosesForDate, logKey, toKey } from "@/lib/mediguardian";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pillbox")({
  head: () => ({
    meta: [
      { title: "Weekly Pillbox — CuraCare" },
      {
        name: "description",
        content: "A digital weekly pillbox: see every compartment, what was taken and what was missed.",
      },
      { property: "og:title", content: "Weekly Pillbox — CuraCare" },
      {
        property: "og:description",
        content: "Seven days, four times a day — tap a compartment to confirm your dose.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pillbox,
});

function Pillbox() {
  const { medicines, logs, markDose } = useStore();
  const doses = dosesForDate(medicines);
  const start = new Date();
  start.setDate(start.getDate() - start.getDay() + 1 - (start.getDay() === 0 ? 7 : 0));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const todayKey = toKey(new Date());
  const now = new Date();

  return (
    <AppShell title="Weekly pillbox" subtitle="Like your plastic pill organiser — tap today's box when you take it.">
      <div className="soft-card overflow-x-auto p-4">
        <table className="w-full min-w-[640px] border-separate border-spacing-2">
          <thead>
            <tr>
              <th className="w-28" />
              {days.map((d) => (
                <th
                  key={d.toISOString()}
                  className={cn(
                    "rounded-2xl py-2 text-sm font-bold",
                    toKey(d) === todayKey ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                  <span className="block text-xs font-normal">{d.getDate()}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot) => {
              const inSlot = doses.filter((d) => d.slot.key === slot.key);
              return (
                <tr key={slot.key}>
                  <th className="text-left text-sm font-bold">
                    {slot.key}
                    <span className="block text-xs font-normal text-muted-foreground">{slot.at}</span>
                  </th>
                  {days.map((d) => {
                    const key = toKey(d);
                    if (!inSlot.length)
                      return <td key={key} className="h-20 rounded-2xl bg-muted/40" />;
                    const statuses = inSlot.map((x) => logs[logKey(x.medicine.id, key, slot.key)]?.status);
                    const all = statuses.every((s) => s === "taken");
                    const anySkip = statuses.some((s) => s === "skipped");
                    const past =
                      key < todayKey || (key === todayKey && slot.hour < now.getHours());
                    const missed = !all && past;
                    const isToday = key === todayKey;
                    const future = key > todayKey;
                    return (
                      <td key={key} className="p-0">
                        <button
                          disabled={!isToday || all}
                          onClick={() =>
                            inSlot.forEach((x) => markDose(x.medicine.id, key, slot.key, "taken"))
                          }
                          aria-label={`${slot.key} ${d.toDateString()}: ${all ? "taken" : missed ? "missed" : "not yet"}`}
                          className={cn(
                            "flex h-20 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 text-xs font-bold transition",
                            all && "border-primary bg-primary/15 text-primary",
                            !all && missed && "border-destructive/50 bg-destructive/10 text-destructive",
                            !all && !missed && "border-border bg-background",
                            isToday && !all && "hover:border-primary",
                            future && "opacity-60",
                          )}
                        >
                          {all ? (
                            <Check className="size-6" aria-hidden />
                          ) : missed ? (
                            <X className="size-6" aria-hidden />
                          ) : anySkip ? (
                            <Minus className="size-6" aria-hidden />
                          ) : (
                            <span className="text-lg">{inSlot.length}</span>
                          )}
                          {all ? "Taken" : missed ? "Missed" : isToday ? "Tap" : `${inSlot.length} pill${inSlot.length > 1 ? "s" : ""}`}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TIME_SLOTS.map((slot) => {
          const inSlot = doses.filter((d) => d.slot.key === slot.key);
          return (
            <div key={slot.key} className="soft-card p-4">
              <p className="font-bold">{slot.key} box</p>
              {inSlot.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {inSlot.map((x) => (
                    <li key={x.medicine.id}>
                      {x.medicine.name} <span className="text-muted-foreground">{x.medicine.dosage}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Empty</p>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
