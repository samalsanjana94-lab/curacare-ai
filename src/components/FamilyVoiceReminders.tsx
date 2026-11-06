import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic, Play, Square, Trash2 } from "lucide-react";
import {
  addFamilyVoiceReminder,
  deleteFamilyVoiceReminder,
  listFamilyVoiceReminders,
  setFamilyVoiceReminderActive,
} from "@/lib/family-voice.functions";
import { playAudioNote } from "@/lib/speech";
import type { Medicine } from "@/lib/mediguardian";

const MAX_SEC = 60;

export function familyVoiceKey(patientId: string | null) {
  return ["family-voice", patientId ?? "me"] as const;
}

/** Caregiver mode records for a linked patient; patient mode reviews messages sent to them. */
export function FamilyVoiceReminders({
  patientId,
  medicines,
  mode,
}: {
  patientId: string | null;
  medicines: Medicine[];
  mode: "caregiver" | "patient";
}) {
  const qc = useQueryClient();
  const list = useServerFn(listFamilyVoiceReminders);
  const add = useServerFn(addFamilyVoiceReminder);
  const toggle = useServerFn(setFamilyVoiceReminderActive);
  const remove = useServerFn(deleteFamilyVoiceReminder);
  const key = familyVoiceKey(patientId);
  const q = useQuery({
    queryKey: key,
    queryFn: () => list({ data: patientId ? { patientId } : {} }),
  });

  const [fromName, setFromName] = useState("");
  const [medicineId, setMedicineId] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secRef = useRef(0);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }, []);

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function start() {
    if (!fromName.trim()) return toast.error("Add your name first, e.g. “Your daughter Priya”");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return toast.error("Recording is not supported on this device");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const dur = secRef.current;
        if (dur < 1) return toast.error("That was too short — try again");
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = async () => {
          setSaving(true);
          try {
            await add({
              data: {
                patientId: patientId!,
                fromName: fromName.trim(),
                medicineId: medicineId || null,
                audio: String(reader.result),
                durationSec: dur,
              },
            });
            toast.success("Message saved — it will play with their reminders");
            void refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not save the message");
          } finally {
            setSaving(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      recorderRef.current = rec;
      secRef.current = 0;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        secRef.current += 1;
        setSeconds(secRef.current);
        if (secRef.current >= MAX_SEC) stop();
      }, 1000);
    } catch {
      toast.error("Please allow microphone access to record");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  const medName = (id: string | null) =>
    id ? (medicines.find((m) => m.id === id)?.name ?? "A removed medicine") : "All medicines";
  const field = "min-h-12 w-full rounded-2xl border border-input bg-card px-4 text-base";
  const messages = q.data ?? [];

  return (
    <div className="rounded-3xl bg-gradient-lav p-5">
      <h3 className="text-lg font-bold">
        {mode === "caregiver" ? "Record a reassuring message" : "Messages from your family"}
      </h3>
      <p className="mt-1 text-muted-foreground">
        {mode === "caregiver"
          ? "Your voice plays right after their medicine reminder. Keep it short and warm (up to 60 seconds)."
          : "These play after your medicine reminders. Pause any you don't want to hear."}
      </p>

      {mode === "caregiver" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 font-semibold">
            Your name as they know you
            <input
              className={field}
              placeholder="Your daughter Priya"
              value={fromName}
              maxLength={60}
              onChange={(e) => setFromName(e.target.value)}
            />
          </label>
          <label className="grid gap-1 font-semibold">
            Play with
            <select className={field} value={medicineId} onChange={(e) => setMedicineId(e.target.value)}>
              <option value="">All medicines</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={recording ? stop : start}
            className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-3xl px-6 text-lg font-bold sm:col-span-2 ${
              recording ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            {recording ? <Square className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
            {saving ? "Saving…" : recording ? `Stop and save (${seconds}s)` : "Start recording"}
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        {q.isLoading ? (
          <p className="text-muted-foreground">Loading messages…</p>
        ) : q.isError ? (
          <p className="text-destructive">Could not load messages. Check your connection.</p>
        ) : messages.length === 0 ? (
          <p className="text-muted-foreground">
            {mode === "caregiver" ? "No messages recorded yet." : "No family messages yet."}
          </p>
        ) : (
          <ul className="grid gap-2">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3">
                <button
                  type="button"
                  aria-label={`Play message from ${m.from_name}`}
                  onClick={async () => {
                    if (!(await playAudioNote(m.audio))) toast.error("This message could not play here");
                  }}
                  className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"
                >
                  <Play className="size-5" aria-hidden />
                </button>
                <span className="min-w-0 flex-1">
                  <b>{m.from_name}</b> · {m.duration_sec}s
                  <span className="block text-sm text-muted-foreground">
                    {medName(m.medicine_id)} · {new Date(m.created_at).toLocaleDateString()}
                  </span>
                </span>
                <label className="flex min-h-11 items-center gap-2 font-semibold">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={m.active}
                    onChange={async (e) => {
                      try {
                        await toggle({ data: { id: m.id, active: e.target.checked } });
                        void refresh();
                      } catch {
                        toast.error("Could not update");
                      }
                    }}
                  />
                  Plays
                </label>
                <button
                  type="button"
                  aria-label={`Delete message from ${m.from_name}`}
                  onClick={async () => {
                    try {
                      await remove({ data: { id: m.id } });
                      toast.success("Message deleted");
                      void refresh();
                    } catch {
                      toast.error("Could not delete");
                    }
                  }}
                  className="grid size-11 place-items-center rounded-2xl bg-muted"
                >
                  <Trash2 className="size-5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
