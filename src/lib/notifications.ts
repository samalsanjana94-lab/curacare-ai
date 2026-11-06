/**
 * Browser notifications & reminder audio for CuraCare
 */

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function playReminderSound(): void {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = ctx.currentTime;
    
    // Pleasant dual chime (880Hz -> 1320Hz, A5 to E6)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.2);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(440, now);
    osc2.frequency.exponentialRampToValueAtTime(660, now + 0.25);

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.8);
    osc2.stop(now + 0.8);
  } catch {
    // Audio context not allowed or failed, fallback gracefully
  }
}

export function showDoseNotification({
  medicineName,
  dosage,
  instructions,
  onOpen,
}: {
  medicineName: string;
  dosage: string;
  instructions: string;
  onOpen?: () => void;
}): void {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  try {
    const notification = new Notification(`Time to take ${medicineName}`, {
      body: `${dosage} · ${instructions}. Tap to open CuraCare.`,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: `curacare-dose-${medicineName}`,
      requireInteraction: true,
    });

    notification.onclick = (e) => {
      e.preventDefault();
      window.focus();
      if (onOpen) onOpen();
    };

    playReminderSound();
  } catch (err) {
    console.warn("Notification error:", err);
  }
}
