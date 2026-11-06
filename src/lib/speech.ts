export type SpeakOptions = {
  lang?: string;
  rate?: number;
  volume?: number;
  voice?: "male" | "female";
};

export function speak(text: string, opts: SpeakOptions = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = opts.lang ?? "en-IN";
  utterance.rate = opts.rate ?? 0.9;
  utterance.volume = opts.volume ?? 1;

  const voices = synth.getVoices();
  const langMatches = voices.filter((v) => v.lang.startsWith(utterance.lang.slice(0, 2)));
  const wanted = opts.voice ?? "female";
  const picked =
    langMatches.find((v) =>
      wanted === "female"
        ? /female|woman|zira|samantha|google/i.test(v.name)
        : /male|man|david|daniel/i.test(v.name),
    ) ?? langMatches[0];
  if (picked) utterance.voice = picked;
  synth.speak(utterance);
}

/** Resolves once the browser has finished speaking (or after a safety timeout). */
export function waitForSpeechEnd(maxMs = 20000): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const s = window.speechSynthesis;
      if ((!s.speaking && !s.pending && Date.now() - started > 300) || Date.now() - started > maxMs) resolve();
      else setTimeout(tick, 200);
    };
    setTimeout(tick, 300);
  });
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function vibrate(pattern: number | number[] = [400, 200, 400]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

/** Play a recorded voice note (data URL). Resolves when playback finishes or fails. */
export function playAudioNote(dataUrl: string): Promise<boolean> {
  if (typeof window === "undefined" || !dataUrl) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const audio = new Audio(dataUrl);
      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);
      void audio.play().catch(() => resolve(false));
    } catch {
      resolve(false);
    }
  });
}
