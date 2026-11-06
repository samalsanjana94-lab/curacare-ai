import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import {
  INVENTORY_LABEL,
  PILL_COLORS,
  TIME_SLOTS,
  daysLeft,
  inventoryStatus,
  reminderSentence,
  type MedTime,
  type Medicine,
} from "@/lib/mediguardian";
import { speak } from "@/lib/speech";
import {
  Edit3,
  Pill,
  Plus,
  ScanLine,
  Search,
  Trash2,
  Volume2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/medicines")({
  head: () => ({
    meta: [
      { title: "Medicine Manager — CuraCare" },
      {
        name: "description",
        content: "Add, edit and manage medicines, set times, food instructions and track remaining stock.",
      },
      { property: "og:title", content: "Medicine Manager — CuraCare" },
      { property: "og:description", content: "Add, edit and manage every medicine in one simple list." },
    ],
  }),
  component: Medicines,
});

interface MedicineFormData extends Omit<Medicine, "id"> {
  startDate?: string;
  endDate?: string;
}

const EMPTY: MedicineFormData = {
  name: "",
  dosage: "",
  type: "Tablet",
  times: ["Morning"],
  food: "After food",
  frequency: "Daily",
  quantity: 30,
  color: PILL_COLORS[0],
  notes: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
};

function Medicines() {
  const { medicines, settings, addMedicine, updateMedicine, removeMedicine } = useStore();
  const [form, setForm] = useState<MedicineFormData>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  function toggleTime(t: MedTime) {
    setForm((f) => ({
      ...f,
      times: f.times.includes(t) ? f.times.filter((x) => x !== t) : [...f.times, t],
    }));
  }

  function handleEdit(m: Medicine) {
    setEditingId(m.id);
    setForm({
      name: m.name,
      dosage: m.dosage,
      type: m.type,
      times: [...m.times],
      food: m.food,
      frequency: m.frequency,
      quantity: m.quantity,
      color: m.color,
      notes: m.notes || "",
      startDate: (m as { startDate?: string }).startDate || "",
      endDate: (m as { endDate?: string }).endDate || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.times.length) {
      toast.error("Please add a name and at least one time slot");
      return;
    }

    if (editingId) {
      updateMedicine(editingId, form);
      setEditingId(null);
      setForm(EMPTY);
      toast.success("Medicine updated successfully");
    } else {
      addMedicine(form);
      setForm(EMPTY);
      toast.success("Medicine added to schedule");
    }
  }

  function playPreview(m: Medicine) {
    speak(reminderSentence(settings.patientName, m, settings.reminderTemplate, settings.language), {
      lang: settings.language,
      rate: settings.rate,
      volume: settings.volume,
      voice: settings.voice,
    });
  }

  const filteredMedicines = medicines.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.dosage.toLowerCase().includes(search.toLowerCase()) ||
    (m.notes && m.notes.toLowerCase().includes(search.toLowerCase()))
  );

  const field = "min-h-12 w-full rounded-2xl border border-input bg-card px-4 text-base focus:border-primary focus:outline-none";

  return (
    <AppShell title="Medicines" subtitle="Manage your complete medication schedule, dosages, and stock.">
      {/* Search & Actions Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medicine by name or dosage..."
            className="h-12 w-full rounded-2xl border border-input bg-card pl-11 pr-4 text-sm font-medium focus:border-primary focus:outline-none"
          />
        </div>

        <Link
          to="/scan"
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-mint px-5 font-bold text-primary shadow-sm hover:opacity-90 transition"
        >
          <ScanLine className="size-5" /> Scan Prescription with AI
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left column: List of medicines */}
        <div>
          {filteredMedicines.length === 0 ? (
            <div className="soft-card p-12 text-center">
              <Pill className="mx-auto size-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-bold">No medicines found</h3>
              <p className="mt-1 text-muted-foreground">
                {search ? "No medicine matches your search query." : "You haven't added any medicines yet. Use the form to add one!"}
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {filteredMedicines.map((m) => {
                const status = inventoryStatus(m);
                const isCritical = status === "critical" || status === "empty";
                return (
                  <li key={m.id} className="soft-card flex flex-col justify-between p-5 transition hover:shadow-md">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span
                            className="size-12 shrink-0 rounded-2xl border border-border"
                            style={{ background: m.color }}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-lg font-bold">{m.name}</h3>
                            <p className="text-sm font-medium text-muted-foreground">
                              {m.dosage} · {m.type}
                            </p>
                          </div>
                        </div>

                        {/* Top action icons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => playPreview(m)}
                            title="Hear spoken reminder"
                            aria-label={`Hear reminder for ${m.name}`}
                            className="grid size-9 place-items-center rounded-xl text-primary hover:bg-muted transition"
                          >
                            <Volume2 className="size-4.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(m)}
                            title="Edit medicine"
                            aria-label={`Edit ${m.name}`}
                            className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted transition"
                          >
                            <Edit3 className="size-4.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Remove ${m.name} from schedule?`)) {
                                removeMedicine(m.id);
                                toast.success(`${m.name} removed`);
                              }
                            }}
                            title="Delete medicine"
                            aria-label={`Delete ${m.name}`}
                            className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-muted transition"
                          >
                            <Trash2 className="size-4.5" />
                          </button>
                        </div>
                      </div>

                      {/* Instructions & badges */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
                          {m.food}
                        </span>
                        <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          {m.frequency}
                        </span>
                        {m.times.map((t) => (
                          <span key={t} className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                            {t}
                          </span>
                        ))}
                      </div>

                      {m.notes ? (
                        <p className="mt-3 text-xs italic text-muted-foreground line-clamp-2">
                          Note: {m.notes}
                        </p>
                      ) : null}
                    </div>

                    {/* Stock footer */}
                    <div className="mt-4 border-t border-border pt-3 flex items-center justify-between text-xs font-bold">
                      <span className={isCritical ? "text-destructive" : "text-muted-foreground"}>
                        {m.quantity} left · {daysLeft(m)} days ({INVENTORY_LABEL[status]})
                      </span>
                      <Link to="/inventory" className="text-primary hover:underline">
                        Refill Stock
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right column: Add / Edit form */}
        <div>
          <form onSubmit={submit} className="soft-card sticky top-24 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {editingId ? <Edit3 className="size-5 text-primary" /> : <Plus className="size-5 text-primary" />}
                {editingId ? "Edit Medicine" : "Add a Medicine"}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" /> Cancel
                </button>
              )}
            </div>

            <div className="mt-5 grid gap-3.5">
              <label className="grid gap-1 text-sm font-semibold">
                Medicine Name *
                <input
                  required
                  className={field}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Paracetamol, Metformin"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm font-semibold">
                  Dosage *
                  <input
                    required
                    className={field}
                    value={form.dosage}
                    onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                    placeholder="e.g. 500mg, 1 tablet"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Form Type
                  <select
                    className={field}
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as Medicine["type"] })}
                  >
                    {["Tablet", "Capsule", "Syrup", "Injection", "Drops"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Time Slots Toggle */}
              <fieldset>
                <legend className="text-sm font-semibold">Scheduled Times *</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TIME_SLOTS.map((s) => (
                    <button
                      type="button"
                      key={s.key}
                      aria-pressed={form.times.includes(s.key)}
                      onClick={() => toggleTime(s.key)}
                      className={`min-h-11 rounded-2xl px-4 text-sm font-bold transition ${
                        form.times.includes(s.key)
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {s.key} ({s.at})
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm font-semibold">
                  Food Instructions
                  <select
                    className={field}
                    value={form.food}
                    onChange={(e) => setForm({ ...form, food: e.target.value as Medicine["food"] })}
                  >
                    <option>Before food</option>
                    <option>After food</option>
                    <option>Anytime</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm font-semibold">
                  Frequency
                  <select
                    className={field}
                    value={form.frequency}
                    onChange={(e) =>
                      setForm({ ...form, frequency: e.target.value as Medicine["frequency"] })
                    }
                  >
                    <option>Daily</option>
                    <option>Alternate days</option>
                    <option>Weekly</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm font-semibold">
                  Current Stock Units
                  <input
                    type="number"
                    min={0}
                    className={field}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  />
                </label>

                <label className="grid gap-1 text-sm font-semibold">
                  Start Date
                  <input
                    type="date"
                    className={field}
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </label>
              </div>

              {/* Color Tag */}
              <fieldset>
                <legend className="text-sm font-semibold">Card Colour Tag</legend>
                <div className="mt-2 flex gap-2">
                  {PILL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Select colour ${c}`}
                      aria-pressed={form.color === c}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`size-10 rounded-xl border-2 transition ${
                        form.color === c ? "border-primary scale-110 shadow-sm" : "border-border"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </fieldset>

              <label className="grid gap-1 text-sm font-semibold">
                Doctor Instructions / Notes
                <textarea
                  rows={2}
                  className="w-full rounded-2xl border border-input bg-card p-3 text-sm focus:border-primary focus:outline-none"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Take with warm water, avoid milk"
                />
              </label>
            </div>

            <button
              type="submit"
              className="mt-6 min-h-14 w-full rounded-3xl bg-primary text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90 transition"
            >
              {editingId ? "Update Medicine" : "Save Medicine to Schedule"}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
