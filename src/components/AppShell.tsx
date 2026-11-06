import { Link, useRouterState } from "@tanstack/react-router";
import {
  Boxes,
  CalendarDays,
  Check,
  CloudOff,
  HeartPulse,
  Home,
  MessageCircleHeart,
  MessageSquareText,
  Pill,
  RefreshCw,
  ScanLine,
  UserRound,
  Users,
  Settings as SettingsIcon,
  ShieldAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import logo from "@/assets/curacare-logo.png";
import { useStore } from "@/lib/store";

function SyncChip() {
  const { online, syncStatus, signedIn, pendingChanges, lastSyncedAt, syncNow } = useStore();
  const offline = !online;
  const label = offline
    ? "Offline — saved on this device"
    : !signedIn
      ? "Saved on this device"
      : syncStatus === "conflict"
        ? "Two copies — please choose"
        : syncStatus === "syncing"
          ? "Syncing…"
          : syncStatus === "error"
            ? "Sync paused — will retry"
            : pendingChanges
              ? "Saving…"
              : lastSyncedAt
                ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Synced";
  const Icon = offline ? CloudOff : syncStatus === "syncing" ? RefreshCw : signedIn ? Check : CloudOff;
  return (
    <button
      type="button"
      onClick={() => signedIn && syncNow()}
      title={label}
      className={cn(
        "hidden items-center gap-1 rounded-2xl px-3 py-2 text-xs font-bold sm:inline-flex",
        offline || syncStatus === "error" || syncStatus === "conflict"
          ? "bg-accent/50 text-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className={cn("size-4", syncStatus === "syncing" && "animate-spin")} aria-hidden />
      {label}
    </button>
  );
}

/** Shown when this device and the cloud both changed while offline. */
function ConflictBanner() {
  const { conflict, resolveConflict } = useStore();
  if (!conflict) return null;
  const when = conflict.cloudAt ? new Date(conflict.cloudAt).toLocaleString() : "another device";
  const line = (s: { medicines: number; appointments: number; vitals: number; notes: number }) =>
    `${s.medicines} medicines · ${s.appointments} visits · ${s.vitals} health notes · ${s.notes} voice notes`;
  return (
    <div className="mx-auto mt-4 max-w-6xl px-4 md:px-8">
      <div className="soft-card border-2 border-destructive/40 p-5">
        <h2 className="text-lg font-bold">Two different copies found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This device was changed while offline, and the cloud copy was also changed (saved {when}).
          Choose which one to keep — the other copy will be replaced.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-muted p-4">
            <p className="font-bold">This device</p>
            <p className="text-sm text-muted-foreground">{line(conflict.localSummary)}</p>
            <button
              onClick={() => resolveConflict("device")}
              className="mt-3 min-h-12 w-full rounded-2xl bg-primary font-bold text-primary-foreground"
            >
              Keep this device
            </button>
          </div>
          <div className="rounded-2xl bg-muted p-4">
            <p className="font-bold">Cloud copy</p>
            <p className="text-sm text-muted-foreground">{line(conflict.cloudSummary)}</p>
            <button
              onClick={() => resolveConflict("cloud")}
              className="mt-3 min-h-12 w-full rounded-2xl bg-secondary font-bold text-secondary-foreground"
            >
              Keep cloud copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


const NAV = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/medicines", label: "Medicines", icon: Pill },
  { to: "/scan", label: "Scan", icon: ScanLine },
  { to: "/caregiver", label: "Care", icon: Users },
  { to: "/appointments", label: "Visits", icon: CalendarDays },
  { to: "/health", label: "Health", icon: HeartPulse },
  { to: "/inventory", label: "Stock", icon: Boxes },
  { to: "/reminders", label: "Reminders", icon: MessageSquareText },
  { to: "/assistant", label: "Assistant", icon: MessageCircleHeart },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-dvh pb-28 md:pb-10">
      <header className="sticky top-0 z-30 glass rounded-b-3xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
          <Link to="/dashboard" className="flex min-w-0 shrink-0 items-center gap-2">
            <img src={logo} alt="" width={40} height={40} className="size-10 shrink-0" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-xl font-semibold">CuraCare</span>
              <span className="hidden text-xs text-muted-foreground sm:block">Care that remembers, wherever you go.</span>
            </span>
          </Link>
          <nav aria-label="Main" className="ml-auto hidden min-w-0 items-center gap-1 overflow-x-auto md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                title={label}
                aria-label={label}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition-colors",
                  pathname === to
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="hidden 2xl:inline">{label}</span>
              </Link>
            ))}
            <Link
              to="/auth"
              aria-label="Account"
              className="ml-1 grid size-11 place-items-center rounded-2xl text-muted-foreground hover:bg-muted"
            >
              <UserRound className="size-5" aria-hidden />
            </Link>
            <Link
              to="/settings"
              aria-label="Settings"
              className="grid size-11 place-items-center rounded-2xl text-muted-foreground hover:bg-muted"
            >
              <SettingsIcon className="size-5" aria-hidden />
            </Link>
          </nav>
          <SyncChip />
          <Link
            to="/emergency"
            className="ml-auto rounded-2xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground md:ml-2"
          >
            SOS
          </Link>
        </div>
      </header>

      <ConflictBanner />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold md:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>

      <nav
        aria-label="Bottom"
        className="fixed inset-x-0 bottom-0 z-30 glass rounded-t-3xl px-2 py-2 md:hidden"
      >
        <ul className="grid grid-cols-5 gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold",
                  pathname === to ? "bg-primary/12 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              to="/settings"
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold",
                pathname === "/settings" ? "bg-primary/12 text-primary" : "text-muted-foreground",
              )}
            >
              <SettingsIcon className="size-5" aria-hidden />
              Settings
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
