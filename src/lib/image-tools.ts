/** Browser-side photo preparation for the prescription scanner. */

export type Edits = {
  rotate: 0 | 90 | 180 | 270;
  /** Crop margins in percent of each side. */
  crop: { top: number; right: number; bottom: number; left: number };
  brightness: number; // 100 = unchanged
  contrast: number; // 100 = unchanged
};

export const defaultEdits: Edits = {
  rotate: 0,
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  brightness: 100,
  contrast: 100,
};

export type QualityIssue = "dark" | "bright" | "blurry" | "small";

export const QUALITY_COPY: Record<QualityIssue, string> = {
  dark: "This photo looks too dark. Move to better light or raise the brightness.",
  bright: "This photo looks washed out. Avoid direct light or lower the brightness.",
  blurry: "This photo looks blurry. Hold the phone still and tap to focus, then retake.",
  small: "This photo is very small. Move closer so the text fills the picture.",
};

/** Pure rule: decide quality issues from simple measurements. */
export function judgeQuality(m: { meanLuma: number; sharpness: number; width: number; height: number }) {
  const issues: QualityIssue[] = [];
  if (m.meanLuma < 60) issues.push("dark");
  else if (m.meanLuma > 250) issues.push("bright");
  if (m.sharpness < 40) issues.push("blurry");
  if (Math.min(m.width, m.height) < 500) issues.push("small");
  return issues;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This image format is not supported. Please use JPG or PNG."));
    img.src = src;
  });
}

/** Apply rotate → crop → brightness/contrast, downscaled to at most `max` px. */
export async function renderEdited(src: string, e: Edits, max = 2000): Promise<HTMLCanvasElement> {
  const img = await loadImage(src);
  const swap = e.rotate === 90 || e.rotate === 270;
  const rw = swap ? img.height : img.width;
  const rh = swap ? img.width : img.height;
  const rot = document.createElement("canvas");
  rot.width = rw;
  rot.height = rh;
  const rc = rot.getContext("2d")!;
  rc.translate(rw / 2, rh / 2);
  rc.rotate((e.rotate * Math.PI) / 180);
  rc.drawImage(img, -img.width / 2, -img.height / 2);

  const sx = (rw * e.crop.left) / 100;
  const sy = (rh * e.crop.top) / 100;
  const sw = Math.max(1, rw - sx - (rw * e.crop.right) / 100);
  const sh = Math.max(1, rh - sy - (rh * e.crop.bottom) / 100);
  const scale = Math.min(1, max / Math.max(sw, sh));
  const out = document.createElement("canvas");
  out.width = Math.round(sw * scale);
  out.height = Math.round(sh * scale);
  const oc = out.getContext("2d")!;
  oc.filter = `brightness(${e.brightness}%) contrast(${e.contrast}%)`;
  oc.drawImage(rot, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out;
}

/** Mean brightness and a Laplacian-variance sharpness score on a small sample. */
export function measure(canvas: HTMLCanvasElement) {
  const w = 320;
  const h = Math.max(1, Math.round((canvas.height / canvas.width) * w));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    g[i] = v;
    sum += v;
  }
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = g[i - w] + g[i + w] + g[i - 1] + g[i + 1] - 4 * g[i];
      lapSum += l;
      lapSq += l * l;
      n++;
    }
  const mean = lapSum / Math.max(1, n);
  return {
    meanLuma: sum / (w * h),
    sharpness: lapSq / Math.max(1, n) - mean * mean,
    width: canvas.width,
    height: canvas.height,
  };
}
