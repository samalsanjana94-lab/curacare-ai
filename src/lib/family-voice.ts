export type FamilyVoiceReminder = {
  id: string;
  patient_id: string;
  caregiver_id: string;
  from_name: string;
  medicine_id: string | null;
  audio: string;
  duration_sec: number;
  active: boolean;
  created_at: string;
};

/**
 * Pick the family message to play with a medicine alert:
 * an active message for that exact medicine wins, otherwise an active
 * "any medicine" message; newest first in each group.
 */
export function pickFamilyMessage<T extends Pick<FamilyVoiceReminder, "medicine_id" | "active" | "created_at">>(
  messages: T[],
  medicineId: string,
): T | null {
  const active = messages
    .filter((m) => m.active)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return active.find((m) => m.medicine_id === medicineId) ?? active.find((m) => !m.medicine_id) ?? null;
}
