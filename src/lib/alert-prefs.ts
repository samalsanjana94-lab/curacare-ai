/** Which events notify the caregiver. Stored with the patient's settings. */
export type AlertPrefs = {
  /** Lowest mood that notifies: "okay" = Okay or worse, "notwell" = Not well or worse, "unwell" = Unwell only. */
  wellnessMood: "never" | "okay" | "notwell" | "unwell";
  /** Notify when at least this many symptoms are ticked. 0 = never. */
  wellnessSymptoms: 0 | 1 | 2 | 3;
  /** Notify when the SOS button is pressed. */
  sos: boolean;
  /** Notify with the shared location after SOS. */
  sosLocation: boolean;
};

export const defaultAlertPrefs: AlertPrefs = {
  wellnessMood: "notwell",
  wellnessSymptoms: 2,
  sos: true,
  sosLocation: true,
};

export function resolvePrefs(p?: Partial<AlertPrefs> | null): AlertPrefs {
  return { ...defaultAlertPrefs, ...(p ?? {}) };
}

const MOOD_THRESHOLD: Record<AlertPrefs["wellnessMood"], number> = {
  never: Infinity,
  okay: 2,
  notwell: 3,
  unwell: 4,
};

/** moodIndex: 0 Great, 1 Good, 2 Okay, 3 Not well, 4 Unwell. */
export function shouldAlertWellness(prefs: AlertPrefs, moodIndex: number, symptomCount: number) {
  if (moodIndex >= MOOD_THRESHOLD[prefs.wellnessMood]) return true;
  return prefs.wellnessSymptoms > 0 && symptomCount >= prefs.wellnessSymptoms;
}

export function shouldAlertSos(prefs: AlertPrefs, event: "sos" | "location") {
  return event === "sos" ? prefs.sos : prefs.sosLocation;
}
