import { describe, expect, it } from "vitest";
import { defaultAlertPrefs, resolvePrefs, shouldAlertSos, shouldAlertWellness } from "./alert-prefs";

describe("caregiver alert preferences", () => {
  it("default: 'Not well' notifies, 'Okay' does not", () => {
    expect(shouldAlertWellness(defaultAlertPrefs, 3, 0)).toBe(true);
    expect(shouldAlertWellness(defaultAlertPrefs, 2, 0)).toBe(false);
  });
  it("default: two symptoms notify, one does not", () => {
    expect(shouldAlertWellness(defaultAlertPrefs, 0, 2)).toBe(true);
    expect(shouldAlertWellness(defaultAlertPrefs, 0, 1)).toBe(false);
  });
  it("'Unwell only' ignores 'Not well'", () => {
    const p = resolvePrefs({ wellnessMood: "unwell", wellnessSymptoms: 0 });
    expect(shouldAlertWellness(p, 3, 5)).toBe(false);
    expect(shouldAlertWellness(p, 4, 0)).toBe(true);
  });
  it("'never' silences mood check-ins", () => {
    expect(shouldAlertWellness(resolvePrefs({ wellnessMood: "never", wellnessSymptoms: 0 }), 4, 0)).toBe(false);
  });
  it("SOS and location can be switched off separately", () => {
    const p = resolvePrefs({ sos: true, sosLocation: false });
    expect(shouldAlertSos(p, "sos")).toBe(true);
    expect(shouldAlertSos(p, "location")).toBe(false);
  });
});
