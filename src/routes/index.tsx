import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  BellRing,
  CalendarHeart,
  ChevronRight,
  Clock,
  Heart,
  HeartPulse,
  Mic,
  Pill,
  ScanLine,
  Shield,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Users,
  Volume2,
  AlertTriangle,
  BarChart3,
  Lock,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")(  {
  head: () => ({
    meta: [
      { title: "CuraCare — Never Miss a Medicine Again" },
      {
        name: "description",
        content:
          "CuraCare helps elderly people and their families manage medicines with talking reminders, caregiver alerts, prescription scanning and emergency SOS.",
      },
      { property: "og:title", content: "CuraCare — Never Miss a Medicine Again" },
      {
        property: "og:description",
        content:
          "Elderly-friendly medicine reminders with voice alerts, caregiver monitoring, prescription scanning and emergency SOS.",
      },
    ],
  }),
  component: Landing,
});

/* ─── feature data ─── */
const FEATURES = [
  {
    icon: Bell,
    title: "Smart Medicine Reminders",
    body: "Set reminders for morning, afternoon, evening and night. The app speaks the medicine name, dosage and instructions aloud.",
    tone: "bg-gradient-mint",
    color: "text-primary",
  },
  {
    icon: Users,
    title: "Caregiver Monitoring",
    body: "Family members receive alerts when a dose is missed. Track your loved one's medicine schedule from anywhere.",
    tone: "bg-gradient-sky",
    color: "text-primary",
  },
  {
    icon: ScanLine,
    title: "Prescription Scanning",
    body: "Photograph a prescription and let OCR extract medicine names and dosages. Review and edit before saving.",
    tone: "bg-gradient-mint",
    color: "text-primary",
  },
  {
    icon: Mic,
    title: "Family Voice Reminders",
    body: "Record a personal voice message for your loved one. Hear a familiar voice saying 'time for your medicine'.",
    tone: "bg-gradient-warm",
    color: "text-primary",
  },
  {
    icon: AlertTriangle,
    title: "Emergency SOS",
    body: "One-tap SOS button to call emergency contacts instantly. Shares location with caregivers when needed.",
    tone: "bg-gradient-lav",
    color: "text-destructive",
  },
  {
    icon: BarChart3,
    title: "Health Dashboard",
    body: "Track blood pressure, sugar, pulse and weight. View weekly and monthly adherence reports with charts.",
    tone: "bg-gradient-sky",
    color: "text-primary",
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Add Your Medicines",
    desc: "Type the medicine name or scan a prescription. Set the time, dosage and instructions.",
    icon: Pill,
  },
  {
    step: "2",
    title: "Get Reminded",
    desc: "The app plays a voice reminder at the right time. Large buttons make it easy to confirm.",
    icon: Volume2,
  },
  {
    step: "3",
    title: "Family Stays Informed",
    desc: "If a dose is missed, your caregiver gets an alert automatically. Everyone stays connected.",
    icon: Heart,
  },
];

const BENEFITS = [
  { icon: Clock, label: "Never miss a dose" },
  { icon: Shield, label: "Private and secure" },
  { icon: Smartphone, label: "Works on any device" },
  { icon: Stethoscope, label: "Doctor-friendly reports" },
];

/* ─── component ─── */
function Landing() {
  return (
    <div className="min-h-dvh">
      {/* ━━━ NAVIGATION ━━━ */}
      <header className="sticky top-0 z-40 glass rounded-b-3xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 md:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary">
              <ShieldCheck className="size-5 text-primary-foreground" aria-hidden />
            </span>
            <span className="font-display text-xl font-extrabold tracking-tight">CuraCare</span>
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <Link
              to="/auth"
              className="rounded-2xl px-4 py-2 font-semibold text-muted-foreground transition hover:bg-muted"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              className="rounded-2xl bg-primary px-5 py-2.5 font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition hover:opacity-90"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* ━━━ HERO ━━━ */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 md:grid-cols-2 md:px-8 md:pb-24 md:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-mint px-4 py-1.5 text-sm font-bold text-mint-foreground">
              <CalendarHeart className="size-4" aria-hidden /> Designed for elderly care
            </p>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.15] tracking-tight md:text-5xl lg:text-6xl">
              Never miss a{" "}
              <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                medicine
              </span>{" "}
              again.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              CuraCare speaks each reminder aloud, keeps repeating until the dose is confirmed, and
              quietly tells family if something is missed. Big buttons, calm colours, no confusion.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-3xl bg-primary px-7 py-4 text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
              >
                Start Free <ChevronRight className="size-5" aria-hidden />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-3xl border border-border bg-card px-7 py-4 text-lg font-bold transition-transform hover:-translate-y-0.5"
              >
                See Dashboard
              </Link>
            </div>

            {/* Stats row */}
            <dl className="mt-10 grid grid-cols-3 gap-3 text-center">
              {[
                ["2", "languages"],
                ["3 taps", "to confirm"],
                ["24/7", "caregiver watch"],
              ].map(([big, small]) => (
                <div key={small} className="soft-card px-3 py-4">
                  <dt className="font-display text-2xl font-extrabold text-primary">{big}</dt>
                  <dd className="text-sm text-muted-foreground">{small}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Hero visual — Medicine reminder card */}
          <div className="relative flex items-center justify-center">
            {/* Background blob */}
            <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-mint opacity-40 blur-3xl" />
            <div className="animate-float glass mx-auto w-full max-w-sm rounded-[2.5rem] p-7">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/10">
                  <Bell className="size-6 text-primary" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Now — 8:00 AM</p>
                  <h2 className="font-display text-2xl font-extrabold">Time for Paracetamol</h2>
                </div>
              </div>
              <p className="mt-3 text-muted-foreground">1 tablet (500 mg) · after food</p>
              <div className="mt-5 grid gap-3">
                <div className="rounded-3xl bg-success px-5 py-4 text-center text-lg font-bold text-success-foreground">
                  ✅ Taken
                </div>
                <div className="rounded-3xl bg-peach px-5 py-4 text-center text-lg font-bold text-peach-foreground">
                  ⏰ Snooze 10 min
                </div>
                <div className="rounded-3xl bg-muted px-5 py-4 text-center text-lg font-bold text-muted-foreground">
                  ❌ Skip this dose
                </div>
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                <Volume2 className="size-4" aria-hidden /> "Hello, it is time to take your
                medicine."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ FEATURES ━━━ */}
      <section className="bg-card/50 py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="text-center">
            <p className="font-bold text-primary">Features</p>
            <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">
              Everything a family needs
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              CuraCare combines medicine reminders, caregiver monitoring, health tracking and
              emergency support in one simple platform.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body, tone, color }) => (
              <article key={title} className="soft-card p-7 transition hover:shadow-lg">
                <span className={`grid size-14 place-items-center rounded-2xl ${tone}`}>
                  <Icon className={`size-7 ${color}`} aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-bold">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ HOW IT WORKS ━━━ */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="text-center">
            <p className="font-bold text-primary">How It Works</p>
            <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Simple as 1, 2, 3</h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">
                  {step}
                </span>
                <div className="mx-auto mt-4 grid size-14 place-items-center rounded-2xl bg-gradient-mint">
                  <Icon className="size-7 text-primary" aria-hidden />
                </div>
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p className="mt-2 text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ SENIOR-FRIENDLY ━━━ */}
      <section className="bg-gradient-mint py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <p className="font-bold text-primary">Elderly-Friendly Design</p>
              <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">
                Built for grandparents, not engineers
              </h2>
              <ul className="mt-6 space-y-4">
                {[
                  "Extra-large text and buttons",
                  "Voice guidance in English and Hindi",
                  "Simple 3-tap confirmation",
                  "High contrast mode",
                  "Works offline when internet is slow",
                  "No confusing menus or settings",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-lg">
                    <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass rounded-[2.5rem] p-8 text-center">
              <p className="text-sm font-bold text-muted-foreground">Senior Simple Mode</p>
              <h3 className="mt-3 font-display text-3xl font-extrabold">Good Morning!</h3>
              <p className="mt-2 text-xl text-muted-foreground">You have 3 medicines today</p>
              <div className="mt-6 grid gap-4">
                <button className="min-h-16 rounded-3xl bg-primary text-xl font-bold text-primary-foreground">
                  💊 Take Medicine Now
                </button>
                <button className="min-h-16 rounded-3xl bg-destructive text-xl font-bold text-destructive-foreground">
                  🆘 Emergency SOS
                </button>
                <button className="min-h-16 rounded-3xl bg-card text-xl font-bold text-foreground">
                  📞 Call Family
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ BENEFITS ━━━ */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold md:text-4xl">Why families trust CuraCare</h2>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
            {BENEFITS.map(({ icon: Icon, label }) => (
              <div key={label} className="soft-card flex flex-col items-center gap-3 p-6 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-gradient-mint">
                  <Icon className="size-7 text-primary" aria-hidden />
                </span>
                <p className="font-bold">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ TRUST & PRIVACY ━━━ */}
      <section className="bg-card/50 py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="soft-card p-8 md:p-12">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-3">
                  <Lock className="size-8 text-primary" aria-hidden />
                  <h2 className="text-2xl font-extrabold md:text-3xl">
                    Your health data is private
                  </h2>
                </div>
                <ul className="mt-6 space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                    Data encrypted and stored securely
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                    Only you and your caregivers see your medicines
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                    No data sold to third parties
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                    Works offline — your data stays on your device
                  </li>
                </ul>
              </div>
              <div className="flex flex-col items-center gap-4 text-center">
                <ShieldCheck className="size-20 text-primary/20" aria-hidden />
                <p className="text-lg font-semibold text-muted-foreground">
                  Built with Supabase Row Level Security
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ CTA ━━━ */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 text-center md:px-8">
          <h2 className="text-3xl font-extrabold md:text-4xl">
            Start caring for your loved ones today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Free to use. No credit card required. Set up in under 2 minutes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-3xl bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
            >
              Create Free Account <ChevronRight className="size-5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━ FOOTER ━━━ */}
      <footer className="border-t border-border bg-card/50 py-12">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-primary">
                  <ShieldCheck className="size-4.5 text-primary-foreground" aria-hidden />
                </span>
                <span className="font-display text-lg font-extrabold">CuraCare</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                AI-powered elderly medicine reminder and caregiver platform.
              </p>
            </div>

            {/* Features */}
            <div>
              <h4 className="font-bold">Features</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/medicines" className="hover:text-primary">Medicine Manager</Link></li>
                <li><Link to="/scan" className="hover:text-primary">Prescription Scanner</Link></li>
                <li><Link to="/caregiver" className="hover:text-primary">Caregiver Dashboard</Link></li>
                <li><Link to="/health" className="hover:text-primary">Health Tracking</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-bold">Support</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/assistant" className="hover:text-primary">AI Assistant</Link></li>
                <li><Link to="/emergency" className="hover:text-primary">Emergency SOS</Link></li>
                <li><Link to="/settings" className="hover:text-primary">Settings</Link></li>
              </ul>
            </div>

            {/* Emergency */}
            <div>
              <h4 className="font-bold">Emergency</h4>
              <p className="mt-3 text-sm text-muted-foreground">
                For medical emergencies, call your local emergency number immediately.
              </p>
              <Link
                to="/emergency"
                className="mt-3 inline-block rounded-2xl bg-destructive px-5 py-2.5 text-sm font-bold text-destructive-foreground"
              >
                Emergency SOS
              </Link>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} CuraCare. Made with ❤️ for families.</p>
            <p>
              CuraCare supports medication routines. It is not a medical device and does not replace
              advice from your doctor.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
