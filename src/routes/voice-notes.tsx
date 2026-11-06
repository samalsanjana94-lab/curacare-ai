import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, Play, Square, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { speak } from "@/lib/speech";
import type { VoiceNote } from "@/lib/mediguardian";

export const Route = createFileRoute("/voice-notes")({
  head: () => ({
    meta: [
      { title: "Doctor & Family Voice Notes — CuraCare" },
      {
        name: "description",
        content:
          "Record short voice messages from doctors, family and caregivers, attach them to a medicine and play them back any time.",
      },
      { property: "og:title", content: "Doctor & Family Voice Notes — CuraCare" },
      {
        property: "og:description",
        content: "Familiar voices explaining each medicine, saved on the device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VoiceNotes,
});

const ROLES: VoiceNote["role"][] = ["Doctor", "Family", "Caregiver"];

function VoiceNotes() {
  const { voiceNotes, medicines, addVoiceNote, removeVoiceNote, settings } = useStore();
  const [from, setFrom] = useState("");
  const [role, setRole] = useState<VoiceNote["role"]>("Family");
  const [medicineId, setMedicineId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Recording is not supported on this device");
      return;
    }
    if (!from.trim()) {
      toast.error("Please add who is speaking first");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          addVoiceNote({
            audio: String(reader.result),
            from: from.trim(),
            role,
            medicineId: medicineId || undefined,
            transcript: transcript.trim() || undefined,
            durationSec: seconds,
          });
          toast.success("Voice note saved");
          setTranscript("");
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone permission is needed to record");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function saveTextNote() {
    if (!from.trim() || !transcript.trim()) {
      toast.error("Add who is speaking and the message");
      return;
    }
    addVoiceNote({
      audio: "",
      from: from.trim(),
      role,
      medicineId: medicineId || undefined,
      transcript: transcript.trim(),
      durationSec: 0,
    });
    setTranscript("");
    toast.success("Note saved — it will be read aloud on playback");
  }

  function play(note: VoiceNote) {
    if (note.audio) {
      const audio = new Audio(note.audio);
      void audio.play();
      return;
    }
    speak(`Message from ${note.from}. ${note.transcript ?? ""}`, {
      lang: settings.language,
      rate: settings.rate,
      volume: settings.volume,
      voice: settings.voice,
    });
  }

  const field = "min-h-12 w-full rounded-2xl border border-input bg-card px-4 text-base";

  return (
    <AppShell
      title="Doctor & family voice notes"
      subtitle="Familiar voices explaining what to take and why — play them any time."
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="soft-card h-fit p-5">
          <h2 className="text-xl font-bold">Record a note</h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 font-semibold">
              Who is speaking
              <input
                className={field}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="Dr. Meera Shah"
              />
            </label>
            <label className="grid gap-1 font-semibold">
              Relationship
              <select
                className={field}
                value={role}
                onChange={(e) => setRole(e.target.value as VoiceNote["role"])}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 font-semibold">
              About which medicine (optional)
              <select
                className={field}
                value={medicineId}
                onChange={(e) => setMedicineId(e.target.value)}
              >
                <option value="">General note</option>
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 font-semibold">
              Written message (optional)
              <textarea
                className="min-h-24 w-full rounded-2xl border border-input bg-card p-4 text-base"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Take this after dinner with a full glass of water."
              />
            </label>
          </div>

          {recording ? (
            <button
              onClick={stopRecording}
              className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-destructive text-lg font-bold text-destructive-foreground"
            >
              <Square className="size-5" aria-hidden /> Stop ({seconds}s)
            </button>
          ) : (
            <button
              onClick={() => void startRecording()}
              className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-gradient-lav text-lg font-bold"
            >
              <Mic className="size-5" aria-hidden /> Start recording
            </button>
          )}
          <button
            onClick={saveTextNote}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-card font-bold"
          >
            Save as spoken text note
          </button>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {voiceNotes.length ? (
            voiceNotes.map((n) => {
              const med = medicines.find((m) => m.id === n.medicineId);
              return (
                <li key={n.id} className="soft-card p-5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold">{n.from}</h3>
                      <p className="text-sm text-muted-foreground">
                        {n.role}
                        {med ? ` · ${med.name}` : ""}
                        {n.durationSec ? ` · ${n.durationSec}s` : " · text note"}
                      </p>
                      {n.transcript ? <p className="mt-2 text-sm">{n.transcript}</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(n.at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      aria-label={`Delete note from ${n.from}`}
                      onClick={() => removeVoiceNote(n.id)}
                      className="grid size-11 shrink-0 place-items-center rounded-2xl text-muted-foreground hover:bg-muted"
                    >
                      <Trash2 className="size-5" aria-hidden />
                    </button>
                  </div>
                  <button
                    onClick={() => play(n)}
                    className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground"
                  >
                    <Play className="size-5" aria-hidden /> Play
                  </button>
                </li>
              );
            })
          ) : (
            <li className="soft-card p-6 text-muted-foreground sm:col-span-2">
              No voice notes yet. Record the doctor&apos;s advice or a loving reminder from family.
            </li>
          )}
        </ul>
      </div>
    </AppShell>
  );
}
