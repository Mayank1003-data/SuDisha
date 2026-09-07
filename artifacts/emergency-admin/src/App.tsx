import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Siren,
  TriangleAlert,
  UserRound,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  auth,
  firebaseConfigured,
  isAdminUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from '@/lib/firebase';
import {
  acknowledgeAlert,
  resolveAlert,
  subscribeToAlerts,
  type AlertStatus,
  type EmergencyAlert,
} from '@/lib/alerts';
import { Router as WouterRouter, Route, Switch, useLocation } from 'wouter';

const queryClient = new QueryClient();

type AuthState = 'loading' | 'signed-out' | 'signed-in' | 'forbidden' | 'error';

function formatTime(value: Date | string | undefined | null) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function getInitials(email: string) {
  const local = email.split('@')[0] || 'admin';
  return local.slice(0, 2).toUpperCase();
}

let alarmContext: AudioContext | null = null;
let alarmInterval: number | null = null;

function getAlarmContext() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    alarmContext ??= new AudioContextClass();
    return alarmContext;
  } catch {
    return;
  }
}

function playAlertTone() {
  try {
    const context = getAlarmContext();
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.11);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.26);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.28);
  } catch {
    // Audio can be blocked until the operator interacts with the page.
  }
}

function startAlertAlarm() {
  stopAlertAlarm();
  playAlertTone();
  alarmInterval = window.setInterval(playAlertTone, 1200);
}

function stopAlertAlarm() {
  if (alarmInterval !== null) {
    window.clearInterval(alarmInterval);
    alarmInterval = null;
  }
}

async function unlockAlertSound() {
  const context = getAlarmContext();
  if (!context) return false;
  try {
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  } catch {
    return false;
  }
}

function ConfigNotice() {
  return (
    <div className="noise flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
      <main className="w-full max-w-xl rounded-2xl border border-card-border bg-card p-8 shadow-md sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar text-sidebar-foreground">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-primary">Sentinel / control</p>
            <p className="text-sm font-semibold text-foreground">Emergency operations</p>
          </div>
        </div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <AlertCircle size={25} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Connect your Firebase project</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          This console is ready, but the browser Firebase environment is missing. Add the VITE_FIREBASE_* values to enable admin sign-in and live alert streaming.
        </p>
        <div className="mt-7 rounded-xl border border-border bg-muted/60 p-4 font-mono text-xs leading-6 text-muted-foreground">
          VITE_FIREBASE_API_KEY<br />
          VITE_FIREBASE_AUTH_DOMAIN<br />
          VITE_FIREBASE_PROJECT_ID<br />
          VITE_FIREBASE_APP_ID
        </div>
      </main>
    </div>
  );
}

function LoginScreen({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (!auth) throw new Error('Firebase is not configured.');
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!(await isAdminUser(credential.user))) {
        await signOut(auth);
        throw new Error('This account is not on the Sentinel admin roster.');
      }
      onSignedIn(credential.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed. Check your credentials and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="noise min-h-[100dvh] bg-background lg:grid lg:grid-cols-[minmax(380px,0.92fr)_1.08fr]">
      <section className="relative hidden overflow-hidden bg-sidebar px-12 py-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full border border-sidebar-border/70" />
        <div className="absolute -right-12 -top-12 h-[265px] w-[265px] rounded-full border border-sidebar-border/60" />
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <Siren size={23} strokeWidth={2.3} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-sidebar-primary">Sentinel</p>
              <p className="text-sm font-semibold">Emergency operations</p>
            </div>
          </div>
          <div className="mt-28 max-w-md">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-sidebar-primary">Quiet until it matters</p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-[-0.055em]">
              Keep a clear head.
              <span className="mt-2 block text-sidebar-primary">Move quickly.</span>
            </h1>
            <p className="mt-7 max-w-sm text-sm leading-7 text-sidebar-foreground/70">
              A focused operations desk for the moments when an Android user needs your team to hear them.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-sidebar-foreground/55">
          <span className="h-2 w-2 rounded-full bg-sidebar-primary" />
          <span>Private admin console</span>
          <span className="text-sidebar-border">/</span>
          <span>Live Firestore channel</span>
        </div>
      </section>
      <section className="flex min-h-[100dvh] items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar text-sidebar-foreground">
              <Siren size={21} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Sentinel / control</p>
              <p className="text-sm font-semibold">Emergency operations</p>
            </div>
          </div>
          <div className="mb-9">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary">Authorized access</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-foreground">Sign in to control room</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Use your approved admin account to monitor incoming alerts.</p>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Admin email</span>
              <input
                data-testid="input-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="operator@yourteam.org"
                className="h-13 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <label className="block">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Password</span>
                <span className="font-mono text-[10px] text-muted-foreground">FIREBASE AUTH</span>
              </div>
              <input
                data-testid="input-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="h-13 w-full rounded-xl border border-input bg-card px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>
            {error && (
              <div data-testid="status-login-error" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm leading-5 text-destructive">
                <TriangleAlert size={17} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <button
              data-testid="button-sign-in"
              type="submit"
              disabled={submitting}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-sidebar px-5 text-sm font-bold text-sidebar-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-primary disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? <RefreshCw size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
              {submitting ? 'Verifying access…' : 'Enter control room'}
            </button>
          </form>
          <div className="mt-12 flex items-start gap-3 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
            <Wifi size={15} className="mt-0.5 shrink-0 text-primary" />
            <span>Your session is secured by Firebase Authentication. Only accounts with an admins record can enter.</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const styles: Record<AlertStatus, string> = {
    active: 'border-accent/25 bg-accent/10 text-accent',
    acknowledged: 'border-primary/20 bg-primary/10 text-primary',
    resolved: 'border-border bg-muted text-muted-foreground',
    safe: 'border-primary/20 bg-primary/10 text-primary',
  };
  const labels: Record<AlertStatus, string> = { active: 'Needs response', acknowledged: 'Acknowledged', resolved: 'Resolved', safe: 'User marked safe' };
  return (
    <span data-testid={`status-alert-${status}`} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-accent' : status === 'acknowledged' || status === 'safe' ? 'bg-primary' : 'bg-muted-foreground'}`} />
      {labels[status]}
    </span>
  );
}

function AlertRow({
  alert,
  onAcknowledge,
  onResolve,
  busyId,
}: {
  alert: EmergencyAlert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  busyId: string | null;
}) {
  const isActive = alert.status === 'active';
  return (
    <article
      data-testid={`card-alert-${alert.id}`}
      className={`rise-in relative overflow-hidden rounded-2xl border bg-card transition duration-200 hover:shadow-sm ${isActive ? 'border-accent/35 shadow-[0_5px_24px_hsl(17_77%_55%_/_0.08)]' : 'border-card-border'}`}
    >
      {isActive && <div className="absolute inset-y-0 left-0 w-1 bg-accent" />}
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
           <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-accent/12 text-accent alert-pulse' : alert.status === 'acknowledged' || alert.status === 'safe' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {isActive ? <Bell size={20} /> : alert.status === 'acknowledged' ? <CheckCircle2 size={20} /> : alert.status === 'safe' ? <ShieldCheck size={20} /> : <Check size={20} />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge status={alert.status} />
              {isActive && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">Live incident</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p data-testid={`text-user-${alert.id}`} className="truncate font-mono text-sm font-medium text-foreground">User {alert.userId}</p>
              <span className="text-xs text-muted-foreground">Alert {alert.id.slice(0, 8)}</span>
            </div>
            <p data-testid={`text-created-${alert.id}`} className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 size={13} /> Received {formatDate(alert.createdAt)} at {formatTime(alert.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:pl-6">
          {alert.status === 'active' && (
            <button
              data-testid={`button-acknowledge-${alert.id}`}
              onClick={() => onAcknowledge(alert.id)}
              disabled={busyId === alert.id}
              className="flex h-10 items-center gap-2 rounded-lg border border-primary/25 bg-primary/8 px-3.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-foreground disabled:cursor-wait disabled:opacity-50"
            >
              {busyId === alert.id ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              Acknowledge
            </button>
          )}
          {alert.status !== 'resolved' && (
            <button
              data-testid={`button-resolve-${alert.id}`}
              onClick={() => onResolve(alert.id)}
              disabled={busyId === alert.id}
              className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3.5 text-xs font-bold text-foreground transition hover:border-destructive/30 hover:bg-destructive/8 hover:text-destructive disabled:cursor-wait disabled:opacity-50"
            >
              <CheckCircle2 size={14} /> Resolve
            </button>
          )}
        </div>
      </div>
      {alert.status === 'acknowledged' && alert.acknowledgedAt && (
        <div className="border-t border-border/70 bg-primary/[0.025] px-5 py-2.5 text-[11px] text-muted-foreground sm:px-6">
          Acknowledged at {formatTime(alert.acknowledgedAt)}
        </div>
      )}
      {alert.status === 'resolved' && alert.resolvedAt && (
        <div className="border-t border-border/70 bg-muted/50 px-5 py-2.5 text-[11px] text-muted-foreground sm:px-6">
          Resolved at {formatTime(alert.resolvedAt)}
        </div>
      )}
      {alert.status === 'safe' && alert.safeAt && (
        <div className="border-t border-border/70 bg-primary/[0.025] px-5 py-2.5 text-[11px] text-muted-foreground sm:px-6">
          User marked safe at {formatTime(alert.safeAt)}
        </div>
      )}
    </article>
  );
}

function SummaryCard({ label, value, tone, icon: Icon }: { label: string; value: number; tone: 'accent' | 'primary' | 'muted'; icon: typeof Bell }) {
  const toneStyles = {
    accent: 'bg-accent/10 text-accent',
    primary: 'bg-primary/10 text-primary',
    muted: 'bg-muted text-muted-foreground',
  };
  return (
    <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneStyles[tone]}`}><Icon size={16} /></div>
      </div>
      <p data-testid={`summary-${label.toLowerCase()}`} className="display-number mt-4 text-3xl font-medium text-foreground">{value}</p>
    </div>
  );
}

function Dashboard({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenerError, setListenerError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundPending, setSoundPending] = useState(false);
  const [alarmActive, setAlarmActive] = useState(false);
  const knownAlertIds = useRef<Set<string> | null>(null);
  const soundEnabledRef = useRef(false);
  const alarmActiveRef = useRef(false);
  const [now, setNow] = useState(new Date());

  const setAlarmState = useCallback((active: boolean) => {
    alarmActiveRef.current = active;
    setAlarmActive(active);
    if (!active) {
      setSoundPending(false);
      stopAlertAlarm();
    }
  }, []);

  const enableSound = useCallback(async () => {
    const enabled = await unlockAlertSound();
    if (!enabled) {
      setActionError('Browser audio is still blocked. Click Enable sound again after interacting with this page.');
      return;
    }
    soundEnabledRef.current = true;
    setSoundEnabled(true);
    setSoundPending(false);
    if (alarmActiveRef.current) startAlertAlarm();
    else playAlertTone();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAlerts((nextAlerts) => {
      if (knownAlertIds.current) {
        const newIncident = nextAlerts.some((alert) => alert.status === 'active' && !knownAlertIds.current?.has(alert.id));
        if (newIncident) {
          setAlarmState(true);
          if (soundEnabledRef.current) startAlertAlarm();
          else setSoundPending(true);
        }
      }
      knownAlertIds.current = new Set(nextAlerts.map((alert) => alert.id));
      setAlerts(nextAlerts);
      setLoading(false);
      setListenerError('');
    }, (error) => {
      setLoading(false);
      setListenerError(error.message || 'Live alert channel unavailable.');
    });
    return unsubscribe;
  }, [setAlarmState]);

  useEffect(() => () => stopAlertAlarm(), []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const activeCount = useMemo(() => alerts.filter((alert) => alert.status === 'active').length, [alerts]);
  const acknowledgedCount = useMemo(() => alerts.filter((alert) => alert.status === 'acknowledged').length, [alerts]);
  const resolvedCount = useMemo(() => alerts.filter((alert) => alert.status === 'resolved').length, [alerts]);
  const safeCount = useMemo(() => alerts.filter((alert) => alert.status === 'safe').length, [alerts]);

  const action = useCallback(async (id: string, kind: 'acknowledge' | 'resolve') => {
    setBusyId(id);
    setActionError('');
    try {
      if (kind === 'acknowledge') await acknowledgeAlert(id);
      else await resolveAlert(id);
      if (kind === 'acknowledge') setAlarmState(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The update could not be saved.');
    } finally {
      setBusyId(null);
    }
  }, [setAlarmState]);

  return (
    <div className="noise min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[244px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Siren size={21} /></div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.23em] text-sidebar-primary">Sentinel</p>
            <p className="text-xs font-semibold text-sidebar-foreground/80">Control room</p>
          </div>
        </div>
        <div className="mt-14">
          <p className="px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/40">Workspace</p>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-sidebar-accent px-3 py-3 text-sm font-semibold text-sidebar-accent-foreground">
            <Activity size={17} className="text-sidebar-primary" /> Live alerts
          </div>
        </div>
        <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-sidebar-primary" /> Channel online</div>
          <p className="mt-2 text-[11px] leading-5 text-sidebar-foreground/50">Listening for Android buzzer alerts in real time.</p>
        </div>
        <div className="mt-5 border-t border-sidebar-border pt-5">
          <button data-testid="button-sign-out-sidebar" onClick={onSignOut} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-xs font-semibold text-sidebar-foreground/65 transition hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main className="min-h-[100dvh] lg:pl-[244px]">
        <header className="border-b border-border/80 bg-background/90 px-5 py-5 backdrop-blur-md sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground"><Siren size={18} /></div>
              <div><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Sentinel</p><p className="text-xs font-bold">Control room</p></div>
            </div>
            <div className="hidden lg:block">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Operations / monitoring</p>
              <p className="mt-1 text-sm font-semibold text-foreground">Live alert desk</p>
            </div>
            <div className="flex items-center gap-3">
              {!soundEnabled ? (
                <button
                  data-testid="button-enable-sound"
                  onClick={() => void enableSound()}
                  className="hidden items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent transition hover:bg-accent hover:text-accent-foreground sm:flex"
                >
                  <Volume2 size={13} /> Enable sound
                </button>
              ) : alarmActive ? (
                <button
                  data-testid="button-stop-alarm"
                  onClick={() => setAlarmState(false)}
                  className="hidden items-center gap-2 rounded-full border border-accent/30 bg-accent px-3 py-1.5 text-[11px] font-bold text-accent-foreground transition hover:brightness-95 sm:flex"
                >
                  <VolumeX size={13} /> Stop alarm
                </button>
              ) : (
                <span className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold text-primary sm:flex">
                  <Volume2 size={13} /> Sound enabled
                </span>
              )}
              <div className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold text-primary sm:flex">
                <Wifi size={13} /> Live channel
              </div>
              <div className="flex items-center gap-2.5 border-l border-border pl-3">
                <div data-testid="avatar-admin" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{getInitials(user.email || '')}</div>
                <div className="hidden min-w-0 sm:block"><p data-testid="text-admin-email" className="max-w-[190px] truncate text-xs font-bold">{user.email}</p><p className="text-[10px] text-muted-foreground">Authorized admin</p></div>
                <button data-testid="button-sign-out" onClick={onSignOut} aria-label="Sign out" className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"><LogOut size={16} /></button>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" /> {formatTime(now)} local time</div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.05em] text-foreground sm:text-4xl">Good to have you here.</h1>
              <p className="mt-2 text-sm text-muted-foreground">Stay close to the signal. The desk is watching.</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="font-mono">{alerts.length}</span> total alerts received</div>
          </section>

          <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Active" value={activeCount} tone="accent" icon={Bell} />
            <SummaryCard label="Acknowledged" value={acknowledgedCount} tone="primary" icon={Check} />
            <SummaryCard label="Resolved" value={resolvedCount} tone="muted" icon={CheckCircle2} />
            <SummaryCard label="Safe" value={safeCount} tone="primary" icon={ShieldCheck} />
          </section>

          {activeCount > 0 && (
            <div data-testid="banner-active-alerts" className="mt-7 flex items-center gap-3 rounded-xl border border-accent/25 bg-accent/8 px-4 py-3 text-sm text-accent">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><Bell size={14} /></div>
              <span><strong>{activeCount} active {activeCount === 1 ? 'alert' : 'alerts'}</strong> need a response from the desk.</span>
            </div>
          )}
          {(alarmActive || soundPending) && (
            <div data-testid="banner-alarm-status" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
              <span className="flex items-center gap-2">
                {soundPending ? <Volume2 size={16} /> : <VolumeX size={16} />}
                {soundPending ? 'New SOS detected. Enable sound to hear the response alarm.' : 'Emergency alarm is active for the new SOS.'}
              </span>
              {soundPending ? (
                <button onClick={() => void enableSound()} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">
                  Enable sound
                </button>
              ) : (
                <button onClick={() => setAlarmState(false)} className="rounded-lg border border-accent/30 px-3 py-1.5 text-xs font-bold hover:bg-accent/15">
                  Mute / stop alarm
                </button>
              )}
            </div>
          )}

          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="text-base font-extrabold tracking-tight">Incoming alerts</h2><p className="mt-1 text-xs text-muted-foreground">Newest signals appear first</p></div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${listenerError ? 'bg-destructive' : 'bg-primary'}`} /> {listenerError ? 'Channel issue' : 'Streaming'}</div>
            </div>
            {listenerError && (
              <div data-testid="status-alert-error" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                <span className="flex items-center gap-2"><WifiOff size={16} /> {listenerError}</span>
                <button data-testid="button-retry-alerts" onClick={() => window.location.reload()} className="flex items-center gap-1.5 rounded-lg border border-destructive/20 px-3 py-1.5 text-xs font-bold hover:bg-destructive/10"><RefreshCw size={13} /> Retry channel</button>
              </div>
            )}
            {actionError && (
              <div data-testid="status-action-error" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                <span className="flex items-center gap-2"><TriangleAlert size={16} /> {actionError}</span>
                <button data-testid="button-dismiss-error" onClick={() => setActionError('')} className="rounded p-1 hover:bg-destructive/10"><X size={15} /></button>
              </div>
            )}
            {loading ? (
              <div className="space-y-3" data-testid="state-alerts-loading">
                {[1, 2, 3].map((item) => <div key={item} className="h-[126px] rounded-2xl border border-card-border bg-card p-5"><div className="flex gap-4"><div className="skeleton h-11 w-11 rounded-xl" /><div className="flex-1 space-y-3"><div className="skeleton h-4 w-28 rounded" /><div className="skeleton h-4 w-48 rounded" /><div className="skeleton h-3 w-36 rounded" /></div></div></div>)}
              </div>
            ) : alerts.length === 0 ? (
              <div data-testid="state-alerts-empty" className="rounded-2xl border border-dashed border-card-border bg-card/50 px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary"><CircleDot size={26} /></div>
                <h3 className="mt-5 text-sm font-extrabold">No alerts on the desk</h3>
                <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-muted-foreground">When an Android user presses the buzzer, their signal will appear here instantly.</p>
                <div className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Listening now</div>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => <AlertRow key={alert.id} alert={alert} onAcknowledge={(id) => void action(id, 'acknowledge')} onResolve={(id) => void action(id, 'resolve')} busyId={busyId} />)}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function DashboardRoute() {
  const [authState, setAuthState] = useState<AuthState>(firebaseConfigured ? 'loading' : 'error');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setAuthState('signed-out');
        return;
      }
      try {
        const allowed = await isAdminUser(nextUser);
        if (!allowed) {
          if (auth) await signOut(auth);
          setUser(null);
          setAuthState('forbidden');
        } else {
          setUser(nextUser);
          setAuthState('signed-in');
        }
      } catch {
        setAuthState('error');
      }
    });
  }, []);

  if (!firebaseConfigured) return <ConfigNotice />;
  if (authState === 'loading') return <LoadingScreen />;
  if (authState === 'signed-out' || authState === 'forbidden') {
    return <LoginScreen onSignedIn={(nextUser) => { setUser(nextUser); setAuthState('signed-in'); }} />;
  }
  if (authState === 'error') return <ConfigNotice />;
  if (!user) return <LoadingScreen />;
  return <Dashboard user={user} onSignOut={() => { if (auth) void signOut(auth); }} />;
}

function LoadingScreen() {
  return (
    <div data-testid="state-auth-loading" className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div className="text-center"><div className="mx-auto h-10 w-10 rounded-xl bg-sidebar skeleton" /><div className="skeleton mx-auto mt-5 h-3 w-36 rounded" /><div className="skeleton mx-auto mt-2 h-2 w-24 rounded" /></div>
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={DashboardRoute} />
        <Route component={DashboardRoute} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;