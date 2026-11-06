/** Shared, client-safe types and labels for medicine interaction checks. */

export const SEVERITIES = ["minor", "moderate", "major", "contraindicated"] as const;
export type Severity = (typeof SEVERITIES)[number];

export type InteractionPair = {
  a: string;
  b: string;
  severity: Severity;
  summary: string;
  advice?: string;
};

export type InteractionReport = {
  pairs: InteractionPair[];
  /** "provider" = licensed clinical database, "ai" = AI review fallback. */
  source: "provider" | "ai";
  sourceName: string;
  checkedAt: string;
  disclaimer: string;
};

export const INTERACTION_DISCLAIMER =
  "This check is for information only. It is not medical advice and may be incomplete. " +
  "Never stop, start or change a medicine on your own — always speak to your doctor or pharmacist first.";

export const SEVERITY_LABEL: Record<Severity, string> = {
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
  contraindicated: "Do not combine",
};

export const SEVERITY_HELP: Record<Severity, string> = {
  minor: "Usually not a problem. Good to know.",
  moderate: "Can matter. Mention it at your next visit.",
  major: "Important. Ask your doctor or pharmacist soon.",
  contraindicated: "These two are normally not taken together. Contact your doctor.",
};

export const SEVERITY_RANK: Record<Severity, number> = {
  minor: 1,
  moderate: 2,
  major: 3,
  contraindicated: 4,
};
