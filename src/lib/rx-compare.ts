import type { Medicine } from "./mediguardian";
import type { ScannedMedicine } from "./scan.functions";

export type RxStatus = "match" | "mismatch" | "duplicate" | "unclear" | "new";
export type RxAction = "add" | "update" | "skip";

export type RxCheck = {
  status: RxStatus;
  /** Plain-language reasons shown to the person. */
  reasons: string[];
  /** Saved medicine this line was compared with, if any. */
  existing?: Medicine;
  /** Safe default choice for this line. */
  suggested: RxAction;
};

export const RX_STATUS_LABEL: Record<RxStatus, string> = {
  match: "Match found",
  mismatch: "Possible mismatch",
  duplicate: "Possible duplicate",
  unclear: "Unclear or unreadable",
  new: "New medicine",
};

const FORM_WORDS = /\b(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|syrup|syp|inj|injection|drops?|mg|mcg|ml|g)\b/g;

/** Lower-case name without strengths, forms or punctuation: "Tab. Metformin 500mg" → "metformin". */
export function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[0-9]+(\.[0-9]+)?\s*(mg|mcg|ml|g|iu|%)?/g, " ")
    .replace(FORM_WORDS, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDose(d: string) {
  return d.toLowerCase().replace(/\s+/g, "");
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Compare each scanned line with the saved list and with the other scanned lines. */
export function compareScanned(
  scanned: ScannedMedicine[],
  saved: Medicine[],
  confidence?: "high" | "medium" | "low",
): RxCheck[] {
  return scanned.map((m, i) => {
    const name = normalizeName(m.name);
    const unclear: string[] = [];
    if (name.length < 3) unclear.push("The medicine name could not be read clearly.");
    if (!m.dosage.trim()) unclear.push("The strength or dose is missing.");
    if (!m.times.length) unclear.push("No time of day was found.");
    if (confidence === "low") unclear.push("The prescription was hard to read.");

    if (name.length < 3) return { status: "unclear", reasons: unclear, suggested: "skip" };

    const twinInScan = scanned.findIndex((o, j) => j !== i && normalizeName(o.name) === name);
    if (twinInScan !== -1 && twinInScan < i) {
      return {
        status: "duplicate",
        reasons: [`${m.name} appears more than once on this prescription.`, ...unclear],
        suggested: "skip",
      };
    }

    const exact = saved.find((s) => normalizeName(s.name) === name);
    if (exact) {
      const diffs: string[] = [];
      if (m.dosage.trim() && normalizeDose(m.dosage) !== normalizeDose(exact.dosage))
        diffs.push(`Dose differs: prescription says ${m.dosage}, your list says ${exact.dosage}.`);
      if (m.times.length && !sameSet(m.times, exact.times))
        diffs.push(`Timing differs: prescription says ${m.times.join(", ")}, your list says ${exact.times.join(", ")}.`);
      if (m.food !== exact.food) diffs.push(`Food instruction differs: ${m.food} vs ${exact.food}.`);
      if (m.frequency !== exact.frequency) diffs.push(`How often differs: ${m.frequency} vs ${exact.frequency}.`);
      if (diffs.length) return { status: "mismatch", reasons: [...diffs, ...unclear], existing: exact, suggested: "update" };
      return {
        status: "match",
        reasons: [`Already on your list as ${exact.name} ${exact.dosage}.`, ...unclear],
        existing: exact,
        suggested: "skip",
      };
    }

    const first = name.split(" ")[0];
    const similar =
      first.length >= 4 ? saved.find((s) => normalizeName(s.name).split(" ")[0] === first) : undefined;
    if (similar) {
      return {
        status: "duplicate",
        reasons: [`Looks similar to ${similar.name} already on your list. Check it is not the same medicine.`, ...unclear],
        existing: similar,
        suggested: "skip",
      };
    }

    if (unclear.length) return { status: "unclear", reasons: unclear, suggested: "add" };
    return { status: "new", reasons: ["Not on your list yet."], suggested: "add" };
  });
}
