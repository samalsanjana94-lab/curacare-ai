import { useEffect, useState } from "react";
import { AlertTriangle, RotateCw, Trash2, ZoomIn, ZoomOut, ScanLine } from "lucide-react";
import {
  QUALITY_COPY,
  defaultEdits,
  judgeQuality,
  measure,
  renderEdited,
  type Edits,
  type QualityIssue,
} from "@/lib/image-tools";

/** Rotate, crop, brighten and zoom a photo, then hand back the prepared image. */
export function ScanImageEditor({
  src,
  busy,
  onScan,
  onRemove,
  onRetake,
  scanLabel,
}: {
  src: string;
  busy: boolean;
  onScan: (prepared: string, issues: QualityIssue[]) => void;
  onRemove: () => void;
  onRetake: () => void;
  scanLabel: string;
}) {
  const [edits, setEdits] = useState<Edits>(defaultEdits);
  const [preview, setPreview] = useState<string | null>(null);
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setEdits(defaultEdits), [src]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      renderEdited(src, edits)
        .then((c) => {
          if (!alive) return;
          setPreview(c.toDataURL("image/jpeg", 0.9));
          setIssues(judgeQuality(measure(c)));
          setError(null);
        })
        .catch((e: Error) => alive && setError(e.message));
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [src, edits]);

  const crop = (k: keyof Edits["crop"], v: number) =>
    setEdits((e) => ({ ...e, crop: { ...e.crop, [k]: v } }));

  if (error) {
    return (
      <div className="mt-4 rounded-2xl bg-destructive/10 p-4 font-semibold text-destructive">
        {error}
        <button onClick={onRemove} className="mt-3 block min-h-12 rounded-2xl bg-card px-4 text-foreground">
          Choose another photo
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="relative max-h-[28rem] overflow-auto rounded-2xl border border-border bg-muted">
        {preview ? (
          <img
            src={preview}
            alt="Prepared photo ready to scan"
            style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
            className="block"
          />
        ) : (
          <div className="h-64" />
        )}
      </div>

      {issues.length ? (
        <ul className="grid gap-2">
          {issues.map((i) => (
            <li key={i} className="flex gap-2 rounded-2xl bg-warning/20 p-3 text-sm font-semibold">
              <AlertTriangle className="size-5 shrink-0" aria-hidden /> {QUALITY_COPY[i]}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Tool onClick={() => setEdits((e) => ({ ...e, rotate: (((e.rotate + 90) % 360) as Edits["rotate"]) }))}>
          <RotateCw className="size-5" aria-hidden /> Rotate
        </Tool>
        <Tool onClick={() => setZoom((z) => Math.min(4, z + 0.5))} label="Zoom in">
          <ZoomIn className="size-5" aria-hidden />
        </Tool>
        <Tool onClick={() => setZoom((z) => Math.max(1, z - 0.5))} label="Zoom out">
          <ZoomOut className="size-5" aria-hidden />
        </Tool>
        <Tool onClick={() => setEdits(defaultEdits)}>Reset</Tool>
        <Tool onClick={onRetake}>Retake</Tool>
        <Tool onClick={onRemove}>
          <Trash2 className="size-5" aria-hidden /> Remove
        </Tool>
      </div>

      <details className="rounded-2xl bg-muted p-4">
        <summary className="cursor-pointer font-bold">Crop, brightness and contrast</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["top", "bottom", "left", "right"] as const).map((k) => (
            <Slider key={k} label={`Trim ${k}`} value={edits.crop[k]} min={0} max={45} unit="%" onChange={(v) => crop(k, v)} />
          ))}
          <Slider label="Brightness" value={edits.brightness} min={50} max={180} unit="%" onChange={(v) => setEdits((e) => ({ ...e, brightness: v }))} />
          <Slider label="Contrast" value={edits.contrast} min={50} max={200} unit="%" onChange={(v) => setEdits((e) => ({ ...e, contrast: v }))} />
        </div>
      </details>

      <button
        disabled={busy || !preview}
        onClick={() => preview && onScan(preview, issues)}
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
      >
        <ScanLine className="size-5" aria-hidden /> {scanLabel}
      </button>
    </div>
  );
}

function Tool({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-card px-4 font-bold"
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold capitalize">
      {label}: {value}
      {unit}
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
