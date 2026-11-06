import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { todayPlus, toKey, type Appointment } from "@/lib/mediguardian";
import {
  CalendarDays,
  Clock,
  Edit3,
  MapPin,
  Navigation,
  Plus,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/appointments")({
  head: () => ({
    meta: [
      { title: "Doctor Appointments — CuraCare" },
      {
        name: "description",
        content: "Track doctor visits, hospitals, department notes, and navigation directions.",
      },
      { property: "og:title", content: "Doctor Appointments — CuraCare" },
      { property: "og:description", content: "Track doctor visits, hospital directions, and notes in one place." },
    ],
  }),
  component: Appointments,
});

const EMPTY: Omit<Appointment, "id"> = {
  doctor: "",
  hospital: "",
  department: "",
  date: todayPlus(3),
  time: "10:00",
  notes: "",
};

function Appointments() {
  const { appointments, addAppointment, updateAppointment, removeAppointment } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const todayStr = toKey(new Date());

  const upcomingList = [...appointments]
    .filter((a) => a.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const pastList = [...appointments]
    .filter((a) => a.date < todayStr)
    .sort((a, b) => b.date.localeCompare(a.date));

  function handleEdit(a: Appointment) {
    setEditingId(a.id);
    setForm({
      doctor: a.doctor,
      hospital: a.hospital,
      department: a.department,
      date: a.date,
      time: a.time,
      notes: a.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.doctor.trim()) {
      return toast.error("Please enter the doctor's name");
    }

    if (editingId) {
      updateAppointment(editingId, form);
      setEditingId(null);
      setForm(EMPTY);
      toast.success("Appointment updated");
    } else {
      addAppointment(form);
      setForm(EMPTY);
      toast.success("Appointment scheduled");
    }
  }

  const field = "min-h-12 w-full rounded-2xl border border-input bg-card px-4 text-base focus:border-primary focus:outline-none";

  const displayList = tab === "upcoming" ? upcomingList : pastList;

  return (
    <AppShell title="Doctor Appointments" subtitle="Manage scheduled clinic visits, hospital addresses, and doctor instructions.">
      {/* ━━━ TABS ━━━ */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex rounded-2xl bg-muted p-1 text-sm font-bold">
          <button
            type="button"
            onClick={() => setTab("upcoming")}
            className={`rounded-xl px-5 py-2 transition ${
              tab === "upcoming"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Upcoming ({upcomingList.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("past")}
            className={`rounded-xl px-5 py-2 transition ${
              tab === "past"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Past History ({pastList.length})
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left column: Appointments List */}
        <div>
          {displayList.length === 0 ? (
            <div className="soft-card p-12 text-center">
              <CalendarDays className="mx-auto size-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-bold">
                {tab === "upcoming" ? "No upcoming appointments" : "No past appointment history"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {tab === "upcoming"
                  ? "You are all clear! Use the form to book an upcoming visit."
                  : "Completed appointment records will be kept here."}
              </p>
            </div>
          ) : (
            <ul className="grid gap-4">
              {displayList.map((a) => {
                const mapsUrl = a.hospital
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.hospital)}`
                  : null;

                return (
                  <li key={a.id} className="soft-card p-5 transition hover:shadow-md">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-sky">
                          <Stethoscope className="size-6 text-primary" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-lg font-bold">{a.doctor}</h3>
                          <p className="text-sm font-medium text-muted-foreground">
                            {a.department || "General Consultation"} · {a.hospital || "Private Clinic"}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-bold text-primary">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="size-4" /> {a.date}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="size-4" /> {a.time}
                            </span>
                          </div>

                          {a.notes ? (
                            <p className="mt-2 rounded-xl bg-muted/60 p-2.5 text-xs text-muted-foreground">
                              <strong>Notes:</strong> {a.notes}
                            </p>
                          ) : null}

                          {mapsUrl && (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                            >
                              <Navigation className="size-3.5" /> Navigate to {a.hospital}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(a)}
                          title="Edit appointment"
                          aria-label={`Edit appointment with ${a.doctor}`}
                          className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted transition"
                        >
                          <Edit3 className="size-4.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete appointment with ${a.doctor}?`)) {
                              removeAppointment(a.id);
                              toast.success("Appointment removed");
                            }
                          }}
                          title="Delete appointment"
                          aria-label={`Delete appointment with ${a.doctor}`}
                          className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-muted transition"
                        >
                          <Trash2 className="size-4.5" />
                        </button>
                      </div>
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
                {editingId ? "Edit Appointment" : "Add Appointment"}
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
                Doctor Name *
                <input
                  required
                  className={field}
                  value={form.doctor}
                  onChange={(e) => setForm({ ...form, doctor: e.target.value })}
                  placeholder="e.g. Dr. Anil Sharma"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold">
                Hospital / Clinic Name
                <input
                  className={field}
                  value={form.hospital}
                  onChange={(e) => setForm({ ...form, hospital: e.target.value })}
                  placeholder="e.g. Apollo Hospital, Room 204"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold">
                Department / Specialty
                <input
                  className={field}
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. Cardiology, Neurology, Eyes"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm font-semibold">
                  Date *
                  <input
                    type="date"
                    required
                    className={field}
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </label>

                <label className="grid gap-1 text-sm font-semibold">
                  Time *
                  <input
                    type="time"
                    required
                    className={field}
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </label>
              </div>

              <label className="grid gap-1 text-sm font-semibold">
                Doctor Notes / Checklist
                <textarea
                  rows={2}
                  className="w-full rounded-2xl border border-input bg-card p-3 text-sm focus:border-primary focus:outline-none"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Carry blood test report, fast 8 hours before"
                />
              </label>
            </div>

            <button
              type="submit"
              className="mt-6 min-h-14 w-full rounded-3xl bg-primary text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90 transition"
            >
              {editingId ? "Update Appointment" : "Save Appointment"}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
