import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import {
  INVENTORY_LABEL,
  daysLeft,
  dosesForDate,
  inventoryStatus,
  logKey,
  toKey,
  type Vital,
} from "@/lib/mediguardian";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Health Records & Reports — CuraCare" },
      {
        name: "description",
        content: "Weekly adherence charts plus blood pressure, sugar, pulse, weight and mood logs.",
      },
      { property: "og:title", content: "Health Records & Reports — CuraCare" },
      { property: "og:description", content: "Adherence trends and daily vitals for your doctor." },
    ],
  }),
  component: Health,
});

const EMPTY: Omit<Vital, "id"> = {
  date: toKey(new Date()),
  bp: "",
  sugar: "",
  weight: "",
  pulse: "",
  mood: "Good",
  note: "",
};

function Health() {
  const { medicines, logs, vitals, addVital, appointments } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [period, setPeriod] = useState<7 | 30>(7);
  const field = "min-h-12 w-full rounded-2xl border border-input bg-card px-4 text-base";

  const chart = useMemo(() => {
    const rows = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toKey(d);
      let taken = 0;
      let missed = 0;
      dosesForDate(medicines).forEach((dose) => {
        const log = logs[logKey(dose.medicine.id, key, dose.slot.key)];
        if (log?.status === "taken") taken++;
        else if (log?.status === "skipped") missed++;
      });
      rows.push({
        day:
          period === 7
            ? d.toLocaleDateString(undefined, { weekday: "short" })
            : d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        taken,
        missed,
      });
    }
    return rows;
  }, [logs, medicines, period]);

  const totalTaken = chart.reduce((s, r) => s + r.taken, 0);
  const totalMissed = chart.reduce((s, r) => s + r.missed, 0);
  const adherence = totalTaken + totalMissed ? Math.round((totalTaken / (totalTaken + totalMissed)) * 100) : 0;
  const periodLabel = period === 7 ? "Weekly" : "Monthly";

  return (
    <AppShell title="Health &amp; reports" subtitle="Share this page with your doctor at each visit.">
      <div className="flex flex-wrap gap-2">
        {([7, 30] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
            className={`min-h-12 rounded-2xl px-5 font-bold ${
              period === p ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            {p === 7 ? "Weekly report" : "Monthly report"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          [`${periodLabel} adherence`, `${adherence}%`, "bg-gradient-sky"],
          ["Doses taken", String(totalTaken), "bg-gradient-lav"],
          ["Doses missed", String(totalMissed), "bg-gradient-warm"],
        ].map(([label, value, tone]) => (
          <div key={label} className={`soft-card p-5 ${tone}`}>
            <p className="font-semibold text-muted-foreground">{label}</p>
            <p className="font-display text-3xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>

      <section className="soft-card mt-6 p-5">
        <h2 className="text-xl font-bold">Last {period} days</h2>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" tickLine={false} />
              <YAxis stroke="var(--muted-foreground)" allowDecimals={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                }}
              />
              <Bar dataKey="taken" fill="var(--chart-2)" radius={[10, 10, 0, 0]} />
              <Bar dataKey="missed" fill="var(--chart-5)" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={async () => {
              const { jsPDF } = await import("jspdf");
              const doc = new jsPDF();
              let y = 18;
              doc.setFontSize(18);
              doc.text("CuraCare — Health Report", 14, y);
              doc.setFontSize(11);
              y += 8;
              doc.text(`Generated ${new Date().toLocaleString()}`, 14, y);
              y += 10;
              doc.text(
                `${periodLabel} adherence: ${adherence}%  ·  Taken: ${totalTaken}  ·  Missed: ${totalMissed}`,
                14,
                y,
              );
              y += 10;
              doc.setFontSize(14);
              doc.text(`Last ${period} days`, 14, y);
              doc.setFontSize(11);
              chart.forEach((r) => {
                y += 7;
                if (y > 275) {
                  doc.addPage();
                  y = 18;
                }
                doc.text(`${r.day}: ${r.taken} taken, ${r.missed} missed`, 18, y);
              });
              y += 12;
              doc.setFontSize(14);
              doc.text("Current medicines", 14, y);
              doc.setFontSize(11);
              medicines.forEach((m) => {
                y += 7;
                if (y > 275) {
                  doc.addPage();
                  y = 18;
                }
                doc.text(`${m.name} — ${m.dosage} · ${m.times.join(", ")} · ${m.food}`, 18, y);
              });
              y += 12;
              doc.setFontSize(14);
              doc.text("Health diary", 14, y);
              doc.setFontSize(11);
              if (!vitals.length) {
                y += 7;
                doc.text("No readings recorded.", 18, y);
              }
              vitals.slice(0, 30).forEach((v) => {
                y += 7;
                if (y > 275) {
                  doc.addPage();
                  y = 18;
                }
                doc.text(
                  `${v.date}: BP ${v.bp || "—"}, Sugar ${v.sugar || "—"}, Pulse ${v.pulse || "—"}, Weight ${v.weight || "—"}, Mood ${v.mood}`,
                  18,
                  y,
                );
              });
              y += 12;
              doc.setFontSize(14);
              doc.text("Stock & refill status", 14, y);
              doc.setFontSize(11);
              if (!medicines.length) {
                y += 7;
                doc.text("No medicines added.", 18, y);
              }
              medicines.forEach((m) => {
                y += 7;
                if (y > 275) {
                  doc.addPage();
                  y = 18;
                }
                const left = daysLeft(m);
                doc.text(
                  `${m.name}: ${m.quantity} units · ${Number.isFinite(left) ? `${left} days cover` : "—"} · ${INVENTORY_LABEL[inventoryStatus(m)]}${m.expiryDate ? ` · expires ${m.expiryDate}` : ""}`,
                  18,
                  y,
                );
              });
              y += 12;
              doc.setFontSize(14);
              doc.text("Doctor appointments", 14, y);
              doc.setFontSize(11);
              if (!appointments.length) {
                y += 7;
                doc.text("No appointments scheduled.", 18, y);
              }
              appointments.forEach((a) => {
                y += 7;
                if (y > 275) {
                  doc.addPage();
                  y = 18;
                }
                doc.text(
                  `${a.date} ${a.time} — ${a.doctor}${a.hospital ? ` @ ${a.hospital}` : ""}`,
                  18,
                  y,
                );
              });
              doc.save(`mediguardian-${period === 7 ? "weekly" : "monthly"}-report-${toKey(new Date())}.pdf`);
              toast.success("PDF report downloaded");
            }}
            className="min-h-12 rounded-2xl bg-primary px-6 font-bold text-primary-foreground"
          >
            Download PDF report
          </button>
          <button
            onClick={() => typeof window !== "undefined" && window.print()}
            className="min-h-12 rounded-2xl bg-card px-6 font-bold"
          >
            Print this page
          </button>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="soft-card p-5">
          <h2 className="text-xl font-bold">Health diary</h2>
          {vitals.length === 0 ? (
            <p className="mt-3 text-muted-foreground">No readings yet. Add today's on the right.</p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {vitals.map((v) => (
                <li key={v.id} className="rounded-3xl border border-border p-4">
                  <p className="font-bold">
                    {v.date} · {v.mood}
                  </p>
                  <p className="text-muted-foreground">
                    BP {v.bp || "—"} · Sugar {v.sugar || "—"} · Pulse {v.pulse || "—"} · Weight{" "}
                    {v.weight || "—"}
                  </p>
                  {v.note ? <p className="mt-1 text-sm">{v.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <form
          className="soft-card h-fit p-5"
          onSubmit={(e) => {
            e.preventDefault();
            addVital(form);
            setForm(EMPTY);
            toast.success("Reading saved");
          }}
        >
          <h2 className="text-xl font-bold">Add today's reading</h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 font-semibold">
              Date
              <input
                type="date"
                className={field}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            {(
              [
                ["Blood pressure", "bp", "120/80"],
                ["Sugar", "sugar", "110 mg/dL"],
                ["Pulse", "pulse", "72 bpm"],
                ["Weight", "weight", "68 kg"],
              ] as const
            ).map(([label, key, ph]) => (
              <label key={key} className="grid gap-1 font-semibold">
                {label}
                <input
                  className={field}
                  placeholder={ph}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
            <label className="grid gap-1 font-semibold">
              Mood
              <select
                className={field}
                value={form.mood}
                onChange={(e) => setForm({ ...form, mood: e.target.value })}
              >
                {["Great", "Good", "Tired", "Unwell"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 font-semibold">
              Notes
              <textarea
                className="min-h-24 w-full rounded-2xl border border-input bg-card p-4"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
          </div>
          <button className="mt-5 min-h-14 w-full rounded-3xl bg-primary text-lg font-bold text-primary-foreground">
            Save reading
          </button>
        </form>
      </div>
    </AppShell>
  );
}
