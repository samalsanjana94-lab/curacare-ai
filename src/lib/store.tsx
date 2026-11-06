import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  defaultSettings,
  seedAppointments,
  seedMedicines,
  toKey,
  logKey,
  type Appointment,
  type DoseLog,
  type Medicine,
  type MedTime,
  type Settings,
  type Vital,
  type Alert,
  type VoiceNote,
} from "./mediguardian";
import { supabase } from "@/integrations/supabase/client";
import { loadCloudState, saveCloudState } from "./sync.functions";
import {
  acknowledgeCareAlert,
  clearCareAlerts,
  listCareAlerts,
  pushCareAlert,
  type CloudAlert,
} from "./alerts.functions";

export type SyncStatus = "local" | "offline" | "syncing" | "synced" | "error" | "conflict";

/** Details of an offline edit clash between this device and the cloud copy. */
export type SyncConflict = {
  cloudAt: string | null;
  cloudSummary: { medicines: number; appointments: number; vitals: number; notes: number };
  localSummary: { medicines: number; appointments: number; vitals: number; notes: number };
};

type Store = {
  ready: boolean;
  medicines: Medicine[];
  logs: Record<string, DoseLog>;
  appointments: Appointment[];
  vitals: Vital[];
  alerts: Alert[];
  voiceNotes: VoiceNote[];
  settings: Settings;
  online: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  pendingChanges: boolean;
  conflict: SyncConflict | null;
  resolveConflict: (keep: "device" | "cloud") => void;
  syncNow: () => void;
  signedIn: boolean;
  addMedicine: (m: Omit<Medicine, "id">) => void;
  removeMedicine: (id: string) => void;
  updateMedicine: (id: string, patch: Partial<Medicine>) => void;
  refillMedicine: (id: string, units: number) => void;
  markDose: (medicineId: string, date: string, time: MedTime, status: "taken" | "skipped") => void;
  addAppointment: (a: Omit<Appointment, "id">) => void;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  removeAppointment: (id: string) => void;
  addVital: (v: Omit<Vital, "id">) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  addAlert: (a: Omit<Alert, "id" | "at" | "acknowledged">) => void;
  acknowledgeAlert: (id: string) => void;
  clearAlerts: () => void;
  addVoiceNote: (n: Omit<VoiceNote, "id" | "at">) => void;
  removeVoiceNote: (id: string) => void;
};

const KEY = "mediguardian.v1";
/** Fingerprint of the snapshot this device last agreed on with the cloud. */
const BASE_KEY = "mediguardian.v1.base";

/** Small, stable fingerprint of a snapshot — used to detect offline edit clashes. */
function fingerprint(value: unknown): string {
  const json = JSON.stringify(value ?? null);
  let h = 5381;
  for (let i = 0; i < json.length; i++) h = ((h << 5) + h + json.charCodeAt(i)) | 0;
  return `${json.length}:${(h >>> 0).toString(36)}`;
}

function summarise(s: Partial<Persisted> | null | undefined) {
  return {
    medicines: s?.medicines?.length ?? 0,
    appointments: s?.appointments?.length ?? 0,
    vitals: s?.vitals?.length ?? 0,
    notes: s?.voiceNotes?.length ?? 0,
  };
}

/** The parts of the snapshot that take part in clash detection (alerts stream live). */
function syncable(s: Partial<Persisted> | null | undefined) {
  return {
    medicines: s?.medicines ?? [],
    logs: s?.logs ?? {},
    appointments: s?.appointments ?? [],
    vitals: s?.vitals ?? [],
    voiceNotes: s?.voiceNotes ?? [],
    settings: s?.settings ?? null,
  };
}

const StoreContext = createContext<Store | null>(null);

type Persisted = {
  medicines: Medicine[];
  logs: Record<string, DoseLog>;
  appointments: Appointment[];
  vitals: Vital[];
  alerts: Alert[];
  voiceNotes: VoiceNote[];
  settings: Settings;
};

function seedLogs(meds: Medicine[]): Record<string, DoseLog> {
  const logs: Record<string, DoseLog> = {};
  for (let i = 1; i <= 6; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = toKey(d);
    meds.forEach((m) =>
      m.times.forEach((t) => {
        const status = Math.random() > 0.16 ? "taken" : "skipped";
        const id = logKey(m.id, date, t);
        logs[id] = { id, medicineId: m.id, date, time: t, status, at: date };
      }),
    );
  }
  return logs;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Persisted>(() => ({
    medicines: seedMedicines,
    logs: {},
    appointments: seedAppointments,
    vitals: [],
    alerts: [],
    voiceNotes: [],
    settings: defaultSettings,
  }));
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [conflict, setConflict] = useState<SyncConflict | null>(null);
  const stateRef = useRef<Persisted | null>(null);
  const userRef = useRef<string | null>(null);
  const pulledFor = useRef<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Fingerprint of the snapshot this device and the cloud last agreed on. */
  const baseHash = useRef<string | null>(null);
  /** The cloud snapshot waiting for the person to choose which copy to keep. */
  const cloudCopy = useRef<Partial<Persisted> | null>(null);

  const applyRemote = useCallback((cloud: Partial<Persisted>) => {
    setState((prev) => ({
      ...prev,
      ...cloud,
      alerts: cloud.alerts ?? [],
      voiceNotes: cloud.voiceNotes ?? [],
      settings: { ...prev.settings, ...(cloud.settings ?? {}) },
    }));
  }, []);

  const setBase = useCallback((hash: string | null) => {
    baseHash.current = hash;
    try {
      if (hash) localStorage.setItem(BASE_KEY, hash);
      else localStorage.removeItem(BASE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      baseHash.current = localStorage.getItem(BASE_KEY);
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Persisted>;
        setState((prev) => ({
          ...prev,
          ...saved,
          alerts: saved.alerts ?? [],
          voiceNotes: saved.voiceNotes ?? [],
          settings: { ...prev.settings, ...(saved.settings ?? {}) },
        }));
      } else {
        setState((prev) => ({ ...prev, logs: seedLogs(seedMedicines) }));
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    stateRef.current = state;
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, ready]);

  useEffect(() => {
    userRef.current = userId;
  }, [userId]);

  /** Push the current snapshot to the cloud immediately (used on reconnect / tab hide). */
  const flush = useCallback(async () => {
    const snapshot = stateRef.current;
    if (!snapshot || !userRef.current || pulledFor.current !== userRef.current) return;
    if (cloudCopy.current) return; // waiting for the person to resolve a clash
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus("offline");
      setPendingChanges(true);
      return;
    }
    setSyncStatus("syncing");
    try {
      // Another device may have written while this one was offline: compare the
      // cloud copy against the snapshot we last agreed on before overwriting it.
      const row = await loadCloudState();
      const cloud = row?.data as Partial<Persisted> | undefined;
      if (cloud && Array.isArray(cloud.medicines)) {
        const cloudHash = fingerprint(syncable(cloud));
        if (baseHash.current && cloudHash !== baseHash.current) {
          cloudCopy.current = cloud;
          setConflict({
            cloudAt: row?.updated_at ?? null,
            cloudSummary: summarise(cloud),
            localSummary: summarise(snapshot),
          });
          setSyncStatus("conflict");
          setPendingChanges(true);
          return;
        }
      }
      await saveCloudState({ data: { data: snapshot as unknown as Record<string, unknown> } });
      setBase(fingerprint(syncable(snapshot)));
      setSyncStatus("synced");
      setPendingChanges(false);
      setLastSyncedAt(new Date().toISOString());
    } catch {
      setSyncStatus("error");
      setPendingChanges(true);
    }
  }, [setBase]);

  /** Keep one copy and clear the clash. */
  const resolveConflict = useCallback(
    (keep: "device" | "cloud") => {
      const cloud = cloudCopy.current;
      cloudCopy.current = null;
      setConflict(null);
      if (keep === "cloud" && cloud) {
        applyRemote(cloud);
        setBase(fingerprint(syncable(cloud)));
        setSyncStatus("synced");
        setPendingChanges(false);
        setLastSyncedAt(new Date().toISOString());
        return;
      }
      // Keep this device: adopt the cloud fingerprint as the new baseline so the
      // next push overwrites it, then push straight away.
      if (cloud) setBase(fingerprint(syncable(cloud)));
      void flush();
    },
    [applyRemote, flush, setBase],
  );


  /* ---- connectivity ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  /* ---- who is signed in ---- */
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    void supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  /* ---- pull once per signed-in user ---- */
  useEffect(() => {
    if (!ready || !userId || !online) return;
    if (pulledFor.current === userId) return;
    pulledFor.current = userId;
    setSyncStatus("syncing");
    void loadCloudState()
      .then((row) => {
        const cloud = row?.data as Partial<Persisted> | undefined;
        const local = stateRef.current;
        if (!cloud || !Array.isArray(cloud.medicines)) {
          setSyncStatus("synced");
          return;
        }
        const cloudHash = fingerprint(syncable(cloud));
        const localHash = fingerprint(syncable(local));
        if (cloudHash === localHash) {
          setBase(cloudHash);
          setSyncStatus("synced");
          return;
        }
        // No baseline yet, or nothing changed on this device since the last sync:
        // the cloud copy is the newer truth.
        if (!baseHash.current || localHash === baseHash.current) {
          applyRemote(cloud);
          setBase(cloudHash);
          setSyncStatus("synced");
          setPendingChanges(false);
          setLastSyncedAt(new Date().toISOString());
          return;
        }
        // Both sides changed since the last agreed copy — ask the person.
        cloudCopy.current = cloud;
        setConflict({
          cloudAt: row?.updated_at ?? null,
          cloudSummary: summarise(cloud),
          localSummary: summarise(local),
        });
        setSyncStatus("conflict");
        setPendingChanges(true);
      })
      .catch(() => setSyncStatus("error"));
  }, [ready, userId, online, applyRemote, setBase]);

  /* ---- push (debounced) ---- */
  useEffect(() => {
    if (!ready || !userId) return;
    if (pulledFor.current !== userId) return;
    if (cloudCopy.current) return;
    if (!online) {
      setSyncStatus("offline");
      setPendingChanges(true);
      return;
    }
    setPendingChanges(true);
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      void flush();
    }, 1200);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [state, ready, userId, online, flush]);

  /* ---- flush the queue as soon as we are back online or the tab is hidden ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => void flush();
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  /* ---- live caregiver alerts ---- */
  const mergeCloudAlerts = useCallback((rows: CloudAlert[]) => {
    setState((s) => {
      const byId = new Map(s.alerts.map((a) => [a.id, a] as const));
      rows.forEach((r) =>
        byId.set(r.id, {
          id: r.id,
          kind: (r.kind as Alert["kind"]) ?? "note",
          title: r.title,
          detail: r.detail ?? "",
          at: r.created_at,
          acknowledged: r.acknowledged,
        }),
      );
      const alerts = Array.from(byId.values())
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 50);
      return { ...s, alerts };
    });
  }, []);

  useEffect(() => {
    if (!ready || !userId) return;
    if (online) {
      void listCareAlerts().then(mergeCloudAlerts).catch(() => undefined);
    }
    const channel = supabase
      .channel(`care_alerts:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "care_alerts", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as CloudAlert | undefined;
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old?.id) setState((s) => ({ ...s, alerts: s.alerts.filter((a) => a.id !== old.id) }));
            return;
          }
          if (row?.id) mergeCloudAlerts([row]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ready, userId, online, mergeCloudAlerts]);

  useEffect(() => {
    if (!userId) {
      pulledFor.current = null;
      setSyncStatus(online ? "local" : "offline");
    }
  }, [userId, online]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    el.dataset.textsize = state.settings.textSize;
    el.dataset.contrast = state.settings.highContrast ? "high" : "normal";
    el.classList.toggle("dark", state.settings.darkMode);
  }, [state.settings.textSize, state.settings.highContrast, state.settings.darkMode]);

  const addMedicine = useCallback((m: Omit<Medicine, "id">) => {
    setState((s) => ({ ...s, medicines: [...s.medicines, { ...m, id: crypto.randomUUID() }] }));
  }, []);

  const removeMedicine = useCallback((id: string) => {
    setState((s) => ({ ...s, medicines: s.medicines.filter((m) => m.id !== id) }));
  }, []);

  const updateMedicine = useCallback((id: string, patch: Partial<Medicine>) => {
    setState((s) => ({
      ...s,
      medicines: s.medicines.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }, []);

  const refillMedicine = useCallback((id: string, units: number) => {
    setState((s) => ({
      ...s,
      medicines: s.medicines.map((m) =>
        m.id === id
          ? {
              ...m,
              quantity: Math.max(0, m.quantity + units),
              lastRefilledAt: new Date().toISOString(),
            }
          : m,
      ),
    }));
  }, []);



  const markDose = useCallback(
    (medicineId: string, date: string, time: MedTime, status: "taken" | "skipped") => {
      const id = logKey(medicineId, date, time);
      setState((s) => ({
        ...s,
        logs: { ...s.logs, [id]: { id, medicineId, date, time, status, at: new Date().toISOString() } },
        medicines:
          status === "taken"
            ? s.medicines.map((m) =>
                m.id === medicineId ? { ...m, quantity: Math.max(0, m.quantity - 1) } : m,
              )
            : s.medicines,
      }));
    },
    [],
  );

  const addAppointment = useCallback((a: Omit<Appointment, "id">) => {
    setState((s) => ({ ...s, appointments: [...s.appointments, { ...a, id: crypto.randomUUID() }] }));
  }, []);

  const updateAppointment = useCallback((id: string, patch: Partial<Appointment>) => {
    setState((s) => ({
      ...s,
      appointments: s.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }, []);

  const removeAppointment = useCallback((id: string) => {
    setState((s) => ({ ...s, appointments: s.appointments.filter((a) => a.id !== id) }));
  }, []);

  const addVital = useCallback((v: Omit<Vital, "id">) => {
    setState((s) => ({ ...s, vitals: [{ ...v, id: crypto.randomUUID() }, ...s.vitals] }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const addAlert = useCallback((a: Omit<Alert, "id" | "at" | "acknowledged">) => {
    const local: Alert = {
      ...a,
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      acknowledged: false,
    };
    setState((s) => ({ ...s, alerts: [local, ...s.alerts].slice(0, 50) }));
    if (userRef.current && typeof navigator !== "undefined" && navigator.onLine) {
      void pushCareAlert({ data: { kind: a.kind, title: a.title, detail: a.detail } })
        .then((row) => {
          // replace the optimistic row with the stored one so every device agrees on the id
          setState((s) => ({
            ...s,
            alerts: s.alerts.map((x) =>
              x.id === local.id
                ? { ...x, id: row.id, at: row.created_at, acknowledged: row.acknowledged }
                : x,
            ),
          }));
        })
        .catch(() => undefined);
    }
  }, []);

  const acknowledgeAlert = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    }));
    if (userRef.current && /^[0-9a-f-]{36}$/i.test(id)) {
      void acknowledgeCareAlert({ data: { id } }).catch(() => undefined);
    }
  }, []);

  const clearAlerts = useCallback(() => {
    setState((s) => ({ ...s, alerts: [] }));
    if (userRef.current) void clearCareAlerts().catch(() => undefined);
  }, []);

  const addVoiceNote = useCallback((n: Omit<VoiceNote, "id" | "at">) => {
    setState((s) => ({
      ...s,
      voiceNotes: [{ ...n, id: crypto.randomUUID(), at: new Date().toISOString() }, ...s.voiceNotes],
    }));
  }, []);

  const removeVoiceNote = useCallback((id: string) => {
    setState((s) => ({ ...s, voiceNotes: s.voiceNotes.filter((n) => n.id !== id) }));
  }, []);

  const value = useMemo<Store>(
    () => ({
      ready,
      online,
      syncStatus,
      lastSyncedAt,
      pendingChanges,
      conflict,
      resolveConflict,
      syncNow: () => void flush(),
      signedIn: !!userId,
      ...state,
      addMedicine,
      removeMedicine,
      updateMedicine,
      refillMedicine,
      markDose,
      addAppointment,
      updateAppointment,
      removeAppointment,
      addVital,
      updateSettings,
      addAlert,
      acknowledgeAlert,
      clearAlerts,
      addVoiceNote,
      removeVoiceNote,
    }),
    [
      ready,
      online,
      syncStatus,
      lastSyncedAt,
      pendingChanges,
      conflict,
      resolveConflict,
      flush,
      userId,
      state,
      addMedicine,
      removeMedicine,
      updateMedicine,
      refillMedicine,
      markDose,
      addAppointment,
      updateAppointment,
      removeAppointment,
      addVital,
      updateSettings,
      addAlert,
      acknowledgeAlert,
      clearAlerts,
      addVoiceNote,
      removeVoiceNote,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
