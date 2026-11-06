/** On-device text reading with Tesseract. Runs in the browser only. */
export type OcrProgress = { stage: string; pct: number };

export async function readText(
  image: string,
  onProgress: (p: OcrProgress) => void,
): Promise<{ text: string; confidence: number }> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      const stage = m.status.includes("recogniz")
        ? "Reading text"
        : m.status.includes("load") || m.status.includes("initial")
          ? "Preparing reader"
          : m.status;
      onProgress({ stage, pct: Math.round((m.progress ?? 0) * 100) });
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return { text: data.text.trim(), confidence: Math.round(data.confidence) };
  } finally {
    await worker.terminate();
  }
}
