import { describe, expect, it } from "vitest";
import { compareScanned, normalizeName } from "./rx-compare";
import type { Medicine } from "./mediguardian";
import type { ScannedMedicine } from "./scan.functions";

const saved: Medicine = {
  id: "1", name: "Metformin", dosage: "500 mg", type: "Tablet", times: ["Morning", "Night"],
  food: "After food", frequency: "Daily", quantity: 30, color: "x",
};
const rx = (p: Partial<ScannedMedicine>): ScannedMedicine => ({
  name: "Metformin", dosage: "500mg", type: "Tablet", times: ["Morning", "Night"],
  food: "After food", frequency: "Daily", quantity: 30, ...p,
});

describe("compareScanned", () => {
  it("strips strength and form from names", () => {
    expect(normalizeName("Tab. Metformin 500mg")).toBe("metformin");
  });
  it("reports a match when the saved medicine is identical", () => {
    expect(compareScanned([rx({})], [saved])[0].status).toBe("match");
  });
  it("reports a mismatch when the dose differs and suggests updating", () => {
    const [c] = compareScanned([rx({ dosage: "1000 mg" })], [saved]);
    expect(c.status).toBe("mismatch");
    expect(c.suggested).toBe("update");
  });
  it("flags the same medicine listed twice on one prescription", () => {
    expect(compareScanned([rx({}), rx({})], [])[1].status).toBe("duplicate");
  });
  it("flags an unreadable name and skips it by default", () => {
    const [c] = compareScanned([rx({ name: "?" })], []);
    expect(c.status).toBe("unclear");
    expect(c.suggested).toBe("skip");
  });
  it("treats a medicine not on the list as new", () => {
    expect(compareScanned([rx({ name: "Amlodipine", dosage: "5 mg" })], [saved])[0].status).toBe("new");
  });
});
