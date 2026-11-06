import { describe, expect, it } from "vitest";
import { pickFamilyMessage } from "./family-voice";

const m = (id: string, medicine_id: string | null, created_at: string, active = true) => ({
  id,
  medicine_id,
  created_at,
  active,
});

describe("pickFamilyMessage", () => {
  it("prefers a message recorded for that medicine over a general one", () => {
    const list = [m("general", null, "2026-10-10"), m("specific", "med1", "2026-10-01")];
    expect(pickFamilyMessage(list, "med1")?.id).toBe("specific");
  });
  it("falls back to a general message for other medicines", () => {
    const list = [m("general", null, "2026-10-10"), m("specific", "med1", "2026-10-01")];
    expect(pickFamilyMessage(list, "med2")?.id).toBe("general");
  });
  it("never plays a paused message", () => {
    expect(pickFamilyMessage([m("off", null, "2026-10-10", false)], "med1")).toBeNull();
  });
  it("plays the newest message when several match", () => {
    const list = [m("old", null, "2026-10-01"), m("new", null, "2026-10-09")];
    expect(pickFamilyMessage(list, "x")?.id).toBe("new");
  });
});
