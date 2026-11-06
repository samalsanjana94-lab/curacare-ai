import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { compareScanned, RX_STATUS_LABEL, type RxAction, type RxStatus } from "@/lib/rx-compare";

const RX_TONE: Record<RxStatus, string> = {
  match: "bg-primary/15 text-primary",
  new: "bg-accent text-accent-foreground",
  mismatch: "bg-warning/30 text-foreground",
  duplicate: "bg-warning/30 text-foreground",
  unclear: "bg-destructive/15 text-destructive",
};
import { toast } from "sonner";
import { Camera, Loader2, Pill, ScanLine, Sparkles, Upload, Volume2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ScanImageEditor } from "@/components/ScanImageEditor";
import { QUALITY_COPY, type QualityIssue } from "@/lib/image-tools";
import { readText, type OcrProgress } from "@/lib/ocr";
import { useStore } from "@/lib/store";
import { PILL_COLORS } from "@/lib/mediguardian";
import { speak } from "@/lib/speech";
import {
  identifyMedicine,
  recognizePrescription,
  type MedicineIdentity,
  type ScanResult,
  type ScannedMedicine,
} from "@/lib/scan.functions";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "AI Prescription & Medicine Scanner — CuraCare" },
      {
        name: "description",
        content:
          "Photograph a prescription or medicine strip and let AI read the names, dosage and timings — or explain what a tablet is for in plain language.",
      },
      { property: "og:title", content: "AI Prescription & Medicine Scanner — CuraCare" },
      {
        property: "og:description",
        content: "AI reads your prescription and explains any medicine pack in simple words.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Scan,
});

type Mode = "prescription" | "identify";

function Scan() {
  const { addMedicine, updateMedicine, medicines, settings } = useStore();
  const [confirmed, setConfirmed] = useState(false);
  const [actions, setActions] = useState<Record<number, RxAction>>({});
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("prescription");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [identity, setIdentity] = useState<MedicineIdentity | null>(null);
  const [ocr, setOcr] = useState<{ text: string; confidence: number } | null>(null);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const checks = useMemo(
    () => (result ? compareScanned(result.medicines, medicines, result.confidence) : []),
    [result, medicines],
  );
  const actionFor = (i: number): RxAction => actions[i] ?? checks[i]?.suggested ?? "add";
  useEffect(() => {
    setActions({});
    setConfirmed(false);
  }, [result?.rawText, result?.medicines.length]);


  async function onFile(file?: File | null) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("That photo is too large", { description: "Please use an image under 8 MB." });
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });
    if (!/^data:image\/(jpeg|jpg|png|webp|gif|bmp)/i.test(dataUrl)) {
      toast.error("This file type is not supported", { description: "Please use a JPG, PNG or WEBP photo." });
      return;
    }
    setImage(dataUrl);
    setResult(null);
    setIdentity(null);
    setOcr(null);
  }

  function clearImage() {
    setImage(null);
    setResult(null);
    setIdentity(null);
    setOcr(null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  function scanPrepared(prepared: string, issues: QualityIssue[]) {
    if (issues.length) toast.warning("Photo quality may affect the result", { description: QUALITY_COPY[issues[0]] });
    void run(prepared);
  }

  async function run(dataUrl: string) {
    setBusy(true);
    try {
      if (mode === "identify") {
        const res = await identifyMedicine({ data: { image: dataUrl } });
        setIdentity(res);
        toast.success(`Identified: ${res.name}`, { description: "Read the simple explanation below." });
      } else {
        setProgress({ stage: "Preparing reader", pct: 0 });
        let text = "";
        try {
          const r = await readText(dataUrl, setProgress);
          setOcr(r);
          text = r.text;
        } catch {
          setOcr({ text: "", confidence: 0 });
          toast.error("The on-device reader could not run here", { description: "Continuing with AI reading only." });
        }
        setProgress({ stage: "Understanding medicines", pct: 100 });
        const res = await recognizePrescription({ data: { image: dataUrl, ocrText: text.slice(0, 6000) } });
        setResult(res);
        if (!res.medicines.length) {
          toast.error("No medicines found", { description: "Try a clearer, well-lit photo." });
        } else {
          toast.success(`${res.medicines.length} medicine(s) recognised`, {
            description: "Check the details, then save.",
          });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed. Please try again.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function readIdentityAloud(id: MedicineIdentity) {
    speak(
      `${id.name}. ${id.purpose} ${id.howToTake ?? ""}`,
      { lang: settings.language, rate: settings.rate, volume: settings.volume, voice: settings.voice },
    );
  }


  function saveAll() {
    if (!result?.medicines.length) return;
    if (!confirmed) {
      toast.error("Please confirm you checked the details against the prescription");
      return;
    }
    let added = 0;
    let updated = 0;
    result.medicines.forEach((m, i) => {
      const action = actionFor(i);
      const notes =
        [m.duration ? `Course: ${m.duration}` : "", m.instructions ?? "", m.notes ?? ""]
          .filter(Boolean)
          .join(" · ") || "Added from prescription scan";
      if (action === "skip") return;
      if (action === "update" && checks[i]?.existing) {
        updateMedicine(checks[i].existing!.id, {
          dosage: m.dosage || checks[i].existing!.dosage,
          times: m.times.length ? m.times : checks[i].existing!.times,
          food: m.food,
          frequency: m.frequency,
          notes,
        });
        updated++;
        return;
      }
      addMedicine({
        name: m.name,
        dosage: m.dosage,
        type: m.type,
        times: m.times.length ? m.times : ["Morning"],
        food: m.food,
        frequency: m.frequency,
        quantity: Math.max(1, Math.round(m.quantity || 30)),
        color: PILL_COLORS[i % PILL_COLORS.length],
        notes,
      });
      added++;
    });
    if (!added && !updated) {
      toast("Nothing changed — every line was skipped");
      return;
    }
    toast.success(`${added} added, ${updated} updated`);
    void navigate({ to: "/medicines" });
  }

  function patch(index: number, key: string, value: string | number) {
    setResult((r) =>
      r
        ? {
            ...r,
            medicines: r.medicines.map((m, i) => (i === index ? { ...m, [key]: value } : m)),
          }
        : r,
    );
  }

  function toggleTime(index: number, time: ScannedMedicine["times"][number]) {
    setResult((r) =>
      r
        ? {
            ...r,
            medicines: r.medicines.map((m, i) =>
              i === index
                ? {
                    ...m,
                    times: m.times.includes(time)
                      ? m.times.filter((t) => t !== time)
                      : [...m.times, time],
                  }
                : m,
            ),
          }
        : r,
    );
  }

  const field = "min-h-12 w-full rounded-2xl border border-input bg-card px-4 text-base";

  return (
    <AppShell
      title="AI medicine scanner"
      subtitle="Read a whole prescription, or point the camera at one strip to learn what it is for."
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="soft-card h-fit p-5">
          <fieldset>
            <legend className="font-semibold">What are you scanning?</legend>
            <div className="mt-2 flex gap-2">
              {(
                [
                  ["prescription", "Prescription"],
                  ["identify", "Strip / bottle / box"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => {
                    setMode(m);
                    setResult(null);
                    setIdentity(null);
                  }}
                  className={`min-h-12 flex-1 rounded-2xl font-bold ${
                    mode === m ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 grid gap-3">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-gradient-lav text-lg font-bold"
            >
              <Camera className="size-5" aria-hidden /> Take photo
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-card text-lg font-bold"
            >
              <Upload className="size-5" aria-hidden /> Choose from gallery
            </button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />

          {image ? (
            <ScanImageEditor
              src={image}
              busy={busy}
              onScan={scanPrepared}
              onRemove={clearImage}
              onRetake={() => cameraRef.current?.click()}
              scanLabel={mode === "identify" ? "Identify this medicine" : "Scan prescription"}
            />
          ) : (
            <p className="mt-4 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
              {mode === "identify"
                ? "Hold the strip or box steady in good light so the printed name is readable."
                : "Keep the paper flat, in good light, and make sure the medicine names are readable. Printed prescriptions read best — handwriting may be partly missed, so always check the result."}
            </p>
          )}
        </div>

        <div className="grid gap-4">
          {busy ? (
            <div className="soft-card flex items-center gap-3 p-6 text-lg font-semibold">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
              <span className="flex-1">
                {mode === "identify" ? "Identifying this medicine…" : progress?.stage ?? "Reading your prescription…"}
                {progress && progress.stage === "Reading text" ? (
                  <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}

          {ocr && mode === "prescription" ? (
            <section className="soft-card p-5">
              <h2 className="text-lg font-bold">Text read from your photo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Read on this device{ocr.text ? ` · reader confidence ${ocr.confidence}%` : ""}. You can correct it and read the medicines again.
              </p>
              {ocr.text ? null : (
                <p className="mt-2 rounded-2xl bg-warning/20 p-3 text-sm font-semibold">
                  No clear text was found. Handwriting and blurry photos are hard to read — try a sharper photo.
                </p>
              )}
              <textarea
                rows={6}
                value={ocr.text}
                onChange={(e) => setOcr({ ...ocr, text: e.target.value })}
                className="mt-3 w-full rounded-2xl border border-input bg-card p-3 font-mono text-sm"
              />
              <button
                disabled={busy || !ocr.text.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await recognizePrescription({ data: { image: image!, ocrText: ocr.text.slice(0, 6000) } });
                    setResult(res);
                    toast.success(`${res.medicines.length} medicine(s) found from your corrected text`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not read the medicines.");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="mt-3 min-h-12 rounded-2xl bg-secondary px-5 font-bold text-secondary-foreground disabled:opacity-50"
              >
                Read medicines from this text
              </button>
            </section>
          ) : null}

          {identity ? (
            <section className="soft-card p-6">
              <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold">
                <Pill className="size-6 text-primary" aria-hidden /> {identity.name}
              </h2>
              <p className="text-muted-foreground">
                {[identity.saltOrIngredient, identity.strength].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-4 text-lg">{identity.purpose}</p>
              {identity.howToTake ? (
                <p className="mt-3 rounded-2xl bg-gradient-sky p-4 font-semibold">
                  How it is usually taken: {identity.howToTake}
                </p>
              ) : null}
              {identity.commonSideEffects?.length ? (
                <div className="mt-3">
                  <p className="font-bold">Common side effects</p>
                  <ul className="mt-1 list-inside list-disc text-muted-foreground">
                    {identity.commonSideEffects.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {identity.cautions?.length ? (
                <div className="mt-3 rounded-2xl bg-accent/40 p-4">
                  <p className="font-bold">Please be careful</p>
                  <ul className="mt-1 list-inside list-disc">
                    {identity.cautions.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="mt-3 text-sm text-muted-foreground">
                Confidence: {identity.confidence}. This is general information — always follow your
                doctor&apos;s advice.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => readIdentityAloud(identity)}
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-card px-5 font-bold"
                >
                  <Volume2 className="size-5" aria-hidden /> Read aloud
                </button>
                <button
                  onClick={() => {
                    addMedicine({
                      name: identity.name,
                      dosage: identity.strength || "1 tablet",
                      type: "Tablet",
                      times: ["Morning"],
                      food: "After food",
                      frequency: "Daily",
                      quantity: 30,
                      color: PILL_COLORS[0],
                      notes: identity.purpose,
                    });
                    toast.success("Added to your medicines");
                    void navigate({ to: "/medicines" });
                  }}
                  className="min-h-12 rounded-2xl bg-primary px-5 font-bold text-primary-foreground"
                >
                  Add to my medicines
                </button>
              </div>
            </section>
          ) : null}


          {result ? (
            <>
              {(result.doctor || result.patient || result.confidence) && (
                <div className="soft-card p-5">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <Sparkles className="size-5 text-primary" aria-hidden /> Prescription details
                  </h2>
                  {result.doctor ? <p className="mt-1">Doctor: {result.doctor}</p> : null}
                  {result.patient ? <p>Patient: {result.patient}</p> : null}
                  {result.confidence ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Reading confidence: {result.confidence}. Please check every line before saving.
                    </p>
                  ) : null}
                </div>
              )}

              {result.medicines.map((m, i) => (
                <div key={i} className="soft-card grid gap-3 p-5 sm:grid-cols-2">
                  {checks[i] ? (
                    <div className="grid gap-2 sm:col-span-2">
                      <span className={`w-fit rounded-2xl px-3 py-1 text-sm font-bold ${RX_TONE[checks[i].status]}`}>
                        {RX_STATUS_LABEL[checks[i].status]}
                      </span>
                      <ul className="list-disc pl-5 text-sm">
                        {checks[i].reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                      <label className="grid gap-1 font-semibold">
                        What should happen
                        <select
                          className={field}
                          value={actionFor(i)}
                          onChange={(e) => setActions((a) => ({ ...a, [i]: e.target.value as RxAction }))}
                        >
                          <option value="add">Add as a new medicine</option>
                          {checks[i].existing ? (
                            <option value="update">Update {checks[i].existing!.name} on my list</option>
                          ) : null}
                          <option value="skip">Skip this line</option>
                        </select>
                      </label>
                    </div>
                  ) : null}
                  <label className="grid gap-1 font-semibold sm:col-span-2">
                    Medicine name
                    <input
                      className={field}
                      value={m.name}
                      onChange={(e) => patch(i, "name", e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 font-semibold">
                    Dosage
                    <input
                      className={field}
                      value={m.dosage}
                      onChange={(e) => patch(i, "dosage", e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 font-semibold">
                    Quantity
                    <input
                      type="number"
                      min={1}
                      className={field}
                      value={m.quantity}
                      onChange={(e) => patch(i, "quantity", Number(e.target.value))}
                    />
                  </label>
                  <label className="grid gap-1 font-semibold">
                    Form
                    <select
                      className={field}
                      value={m.type}
                      onChange={(e) => patch(i, "type", e.target.value)}
                    >
                      {["Tablet", "Capsule", "Syrup", "Injection", "Drops"].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 font-semibold">
                    With food
                    <select
                      className={field}
                      value={m.food}
                      onChange={(e) => patch(i, "food", e.target.value)}
                    >
                      {["Before food", "After food", "Anytime"].map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 font-semibold">
                    How often
                    <select
                      className={field}
                      value={m.frequency}
                      onChange={(e) => patch(i, "frequency", e.target.value)}
                    >
                      {["Daily", "Alternate days", "Weekly"].map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset className="sm:col-span-2">
                    <legend className="font-semibold">Times of day</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["Morning", "Afternoon", "Evening", "Night"] as const).map((t) => {
                        const on = m.times.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleTime(i, t)}
                            className={`min-h-11 rounded-2xl px-4 font-bold ${
                              on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <label className="grid gap-1 font-semibold">
                    Duration
                    <input
                      className={field}
                      placeholder="5 days"
                      value={m.duration ?? ""}
                      onChange={(e) => patch(i, "duration", e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 font-semibold">
                    Doctor's instructions
                    <input
                      className={field}
                      placeholder="Drink plenty of water"
                      value={m.instructions ?? ""}
                      onChange={(e) => patch(i, "instructions", e.target.value)}
                    />
                  </label>
                  {m.notes ? (
                    <p className="sm:col-span-2 text-sm text-muted-foreground">{m.notes}</p>
                  ) : null}
                </div>
              ))}

              {result.medicines.length ? (
                <div className="soft-card grid gap-3 p-5">
                  <label className="flex items-start gap-3 text-lg font-semibold">
                    <input
                      type="checkbox"
                      className="mt-1 size-6 shrink-0"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    I have checked every line against the original prescription.
                  </label>
                  <button
                    onClick={saveAll}
                    disabled={!confirmed}
                    className="inline-flex min-h-14 items-center justify-center rounded-3xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
                  >
                    Confirm and save
                  </button>
                  <p className="text-sm text-muted-foreground">
                    This check compares names and schedules only. It is not medical advice — ask your doctor or
                    pharmacist about anything that looks wrong.
                  </p>
                </div>
              ) : null}

              {result.rawText ? (
                <details className="soft-card p-5">
                  <summary className="cursor-pointer font-bold">Text read from the image</summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {result.rawText}
                  </p>
                </details>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
