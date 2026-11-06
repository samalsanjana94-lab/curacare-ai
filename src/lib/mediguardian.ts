export type MedTime = "Morning" | "Afternoon" | "Evening" | "Night";

export type Medicine = {
  id: string;
  name: string;
  dosage: string;
  type: "Tablet" | "Capsule" | "Syrup" | "Injection" | "Drops";
  times: MedTime[];
  food: "Before food" | "After food" | "Anytime";
  frequency: "Daily" | "Alternate days" | "Weekly";
  quantity: number;
  color: string;
  notes?: string;
  /** Warn when this many days of stock (or fewer) remain. */
  refillDays?: number;
  /** Where this medicine is usually bought. */
  pharmacy?: string;
  lastRefilledAt?: string;
  /** yyyy-mm-dd printed on the strip or bottle. */
  expiryDate?: string;
  /** Custom spoken reminder for this medicine. Supports {name} {medicine} {dosage}. */
  reminderText?: string;
};

export type InventoryStatus = "ok" | "low" | "critical" | "empty";

/** Units consumed per day, accounting for how often the medicine is taken. */
export function dosesPerDay(m: Medicine) {
  const perDose = m.times.length || 1;
  if (m.frequency === "Alternate days") return perDose / 2;
  if (m.frequency === "Weekly") return perDose / 7;
  return perDose;
}

export function daysLeft(m: Medicine) {
  const perDay = dosesPerDay(m);
  if (perDay <= 0) return Infinity;
  return Math.floor(m.quantity / perDay);
}

export function refillThreshold(m: Medicine) {
  return m.refillDays ?? 7;
}

export function inventoryStatus(m: Medicine): InventoryStatus {
  if (m.quantity <= 0) return "empty";
  const left = daysLeft(m);
  const threshold = refillThreshold(m);
  if (left <= Math.ceil(threshold / 2)) return "critical";
  if (left <= threshold) return "low";
  return "ok";
}

export function runOutDate(m: Medicine) {
  const left = daysLeft(m);
  if (!Number.isFinite(left)) return null;
  return todayPlus(left);
}

/** Whole days until the printed expiry date (negative when already expired). */
export function daysToExpiry(m: Medicine): number | null {
  if (!m.expiryDate) return null;
  const end = new Date(`${m.expiryDate}T00:00:00`).getTime();
  if (Number.isNaN(end)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end - today.getTime()) / 86_400_000);
}

export type ExpiryStatus = "none" | "fine" | "soon" | "expired";

export function expiryStatus(m: Medicine): ExpiryStatus {
  const d = daysToExpiry(m);
  if (d === null) return "none";
  if (d < 0) return "expired";
  if (d <= 30) return "soon";
  return "fine";
}

export const INVENTORY_LABEL: Record<InventoryStatus, string> = {
  ok: "Stocked",
  low: "Refill soon",
  critical: "Refill now",
  empty: "Out of stock",
};

export type DoseLog = {
  id: string; // medicineId|date|time
  medicineId: string;
  date: string; // yyyy-mm-dd
  time: MedTime;
  status: "taken" | "skipped";
  at: string;
};

export type Appointment = {
  id: string;
  doctor: string;
  hospital: string;
  department: string;
  date: string;
  time: string;
  notes?: string;
};

export type Vital = {
  id: string;
  date: string;
  bp: string;
  sugar: string;
  weight: string;
  pulse: string;
  mood: string;
  note?: string;
};

export type Settings = {
  patientName: string;
  role: "patient" | "caregiver";
  language: string;
  voice: "female" | "male";
  rate: number;
  volume: number;
  repeatEvery: 5 | 10 | 15 | 30;
  textSize: "normal" | "large" | "xlarge";
  highContrast: boolean;
  darkMode: boolean;
  caregiverName: string;
  caregiverPhone: string;
  /** Second person to call if the caregiver does not answer. */
  altContactName?: string;
  altContactPhone?: string;
  /** Medical profile shown on the emergency screen. */
  bloodGroup?: string;
  allergies?: string;
  conditions?: string;
  doctorName?: string;
  doctorPhone?: string;
  /** Default spoken reminder template. Supports {name} {medicine} {dosage} {food} {time}. */
  reminderTemplate: string;
  /** Simplified UI mode with extra-large buttons and minimal steps for seniors */
  seniorSimpleMode?: boolean;
  /** Which events notify the caregiver. */
  alertPrefs?: import("./alert-prefs").AlertPrefs;
};

export const TIME_SLOTS: { key: MedTime; at: string; hour: number }[] = [
  { key: "Morning", at: "08:00", hour: 8 },
  { key: "Afternoon", at: "13:30", hour: 13 },
  { key: "Evening", at: "18:00", hour: 18 },
  { key: "Night", at: "21:30", hour: 21 },
];

export const LANGUAGES = [
  { label: "English", code: "en-IN" },
  { label: "हिन्दी (Hindi)", code: "hi-IN" },
];

export const PILL_COLORS = [
  "var(--mint)",
  "var(--lavender)",
  "var(--peach)",
  "var(--secondary)",
  "var(--accent)",
];

export const defaultSettings: Settings = {
  patientName: "Elder Patient",
  role: "patient",
  seniorSimpleMode: false,
  language: "en-IN",
  voice: "female",
  rate: 0.9,
  volume: 1,
  repeatEvery: 10,
  textSize: "normal",
  highContrast: false,
  darkMode: false,
  caregiverName: "Priya (daughter)",
  caregiverPhone: "+91 90000 00000",
  altContactName: "",
  altContactPhone: "",
  bloodGroup: "",
  allergies: "",
  conditions: "",
  doctorName: "",
  doctorPhone: "",
  reminderTemplate: "Hello {name}. It is time for your {medicine}. Please take {dosage} {food}.",
};

export const seedMedicines: Medicine[] = [
  {
    id: "m1",
    name: "Paracetamol",
    dosage: "1 tablet (500mg)",
    type: "Tablet",
    times: ["Morning", "Night"],
    food: "After food",
    frequency: "Daily",
    quantity: 24,
    color: "var(--mint)",
  },
  {
    id: "m2",
    name: "Amlodipine",
    dosage: "1 tablet (5mg)",
    type: "Tablet",
    times: ["Morning"],
    food: "Before food",
    frequency: "Daily",
    quantity: 8,
    color: "var(--lavender)",
    notes: "Blood pressure",
  },
  {
    id: "m3",
    name: "Vitamin D3 syrup",
    dosage: "10 ml",
    type: "Syrup",
    times: ["Afternoon"],
    food: "After food",
    frequency: "Daily",
    quantity: 15,
    color: "var(--peach)",
  },
  {
    id: "m4",
    name: "Metformin",
    dosage: "1 tablet (500mg)",
    type: "Tablet",
    times: ["Evening", "Night"],
    food: "After food",
    frequency: "Daily",
    quantity: 30,
    color: "var(--secondary)",
    notes: "Sugar control",
  },
];

export const seedAppointments: Appointment[] = [
  {
    id: "a1",
    doctor: "Dr. Meera Shah",
    hospital: "Sunrise Care Hospital",
    department: "Cardiology",
    date: todayPlus(3),
    time: "11:00",
    notes: "Carry last ECG report",
  },
  {
    id: "a2",
    doctor: "Dr. Anil Kumar",
    hospital: "City Neuro Centre",
    department: "Neurology",
    date: todayPlus(12),
    time: "09:30",
  },
];

export function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  if (h < 21) return "Good Evening";
  return "Good Night";
}

export function dosesForDate(meds: Medicine[]) {
  return TIME_SLOTS.flatMap((slot) =>
    meds
      .filter((m) => m.times.includes(slot.key))
      .map((m) => ({ medicine: m, slot }))
      .sort((a, b) => a.medicine.name.localeCompare(b.medicine.name)),
  );
}

export function logKey(medId: string, date: string, time: MedTime) {
  return `${medId}|${date}|${time}`;
}

export function reminderSentence(
  name: string,
  med: Medicine,
  custom?: string,
  lang?: string,
): string {
  const template = (med.reminderText?.trim() || custom?.trim()) ?? "";
  if (template) {
    return template
      .replaceAll("{name}", name)
      .replaceAll("{medicine}", med.name)
      .replaceAll("{dosage}", med.dosage)
      .replaceAll("{food}", med.food.toLowerCase())
      .replaceAll("{time}", med.times.join(" and "));
  }
  if (lang?.startsWith("hi")) {
    const foodHindi =
      med.food === "Before food"
        ? "खाने से पहले"
        : med.food === "After food"
          ? "खाने के बाद"
          : "समय पर";
    return `नमस्ते ${name} जी। दवा लेने का समय हो गया है। कृपया ${foodHindi} ${med.name} की खुराक ${med.dosage} लें।`;
  }
  return `Hello ${name}. It is time to take your medicine. Please take ${med.dosage} of ${med.name} ${med.food.toLowerCase()}.`;
}

export const HEALTH_TIPS = [
  "Drink a glass of water with every dose — it helps absorption.",
  "A 10 minute morning walk improves balance and mood.",
  "Keep your medicines in the same place every day.",
  "Sit upright for 20 minutes after taking tablets.",
  "Sleep and wake at the same time to steady your blood pressure.",
];

export type Alert = {
  id: string;
  kind: "sos" | "missed" | "refill" | "note";
  title: string;
  detail: string;
  at: string;
  acknowledged: boolean;
};

export type VoiceNote = {
  id: string;
  /** data URL of the recording, or empty when it is a text-only note. */
  audio: string;
  from: string;
  role: "Doctor" | "Family" | "Caregiver";
  medicineId?: string;
  transcript?: string;
  durationSec: number;
  at: string;
};

/* ---------------------------------------------------------------------------
 * Missed-dose escalation
 * ------------------------------------------------------------------------ */

export type RiskLevel = "none" | "watch" | "alert" | "high";

/** True when every dose due on `date` was confirmed as taken. */
export function dayFullyTaken(
  meds: Medicine[],
  logs: Record<string, DoseLog>,
  date: string,
): boolean {
  const doses = dosesForDate(meds);
  if (!doses.length) return true;
  return doses.every((d) => logs[logKey(d.medicine.id, date, d.slot.key)]?.status === "taken");
}

/** Medicines with an unconfirmed dose on `date`. */
export function missedOnDate(
  meds: Medicine[],
  logs: Record<string, DoseLog>,
  date: string,
): { medicine: Medicine; slot: MedTime }[] {
  return dosesForDate(meds)
    .filter((d) => logs[logKey(d.medicine.id, date, d.slot.key)]?.status !== "taken")
    .map((d) => ({ medicine: d.medicine, slot: d.slot.key }));
}

/** Consecutive completed days (ending yesterday) with at least one unconfirmed dose. */
export function missedStreak(
  meds: Medicine[],
  logs: Record<string, DoseLog>,
  from = new Date(),
): number {
  let streak = 0;
  for (let i = 1; i <= 14; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() - i);
    if (dayFullyTaken(meds, logs, toKey(d))) break;
    streak++;
  }
  return streak;
}

export function riskFromStreak(days: number): RiskLevel {
  if (days >= 3) return "high";
  if (days === 2) return "alert";
  if (days === 1) return "watch";
  return "none";
}

export const RISK_COPY: Record<RiskLevel, { label: string; action: string }> = {
  none: { label: "On track", action: "No action needed — doses are being confirmed." },
  watch: {
    label: "Day 1 — reminders repeating",
    action: "Reminders are repeating on the patient's device. No caregiver call needed yet.",
  },
  alert: {
    label: "Day 2 — caregiver notified",
    action: "Please call and remind them today.",
  },
  high: {
    label: "Day 3+ — HIGH RISK",
    action: "Call or visit immediately. Three or more days of medicine have been missed.",
  },
};

export function escalationMessage(patient: string, days: number, medicines: string[]) {
  const list = medicines.slice(0, 3).join(", ") || "their medicines";
  if (days >= 3) {
    return `${patient} has missed ${list} for ${days} consecutive days. Please call or visit them immediately.`;
  }
  if (days === 2) {
    return `${patient} missed ${list} yesterday and the day before. Please call and remind them.`;
  }
  return `${patient} missed ${list} yesterday. Reminders are repeating today.`;
}
