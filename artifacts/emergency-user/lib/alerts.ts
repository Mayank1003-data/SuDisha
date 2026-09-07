import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db, firebaseConfigured } from './firebase';

let inFlight = false;
let lastSentAt = 0;
const DUPLICATE_WINDOW_MS = 4000;

export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'safe';

export type UserAlert = {
  id: string;
  userId: string;
  createdAt: Date | string;
  status: AlertStatus;
  acknowledgedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  safeAt?: Date | string | null;
};

function toDate(value: unknown): Date | string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date || typeof value === 'string') return value;
  return new Date();
}

function parseAlert(id: string, data: Record<string, unknown>): UserAlert {
  return {
    id,
    userId: String(data.userId ?? ''),
    createdAt: toDate(data.createdAt),
    status: (data.status as AlertStatus) || 'active',
    acknowledgedAt: data.acknowledgedAt ? toDate(data.acknowledgedAt) : null,
    resolvedAt: data.resolvedAt ? toDate(data.resolvedAt) : null,
    safeAt: data.safeAt ? toDate(data.safeAt) : null,
  };
}

export async function ensureAnonymousUser() {
  if (!firebaseConfigured) {
    throw new Error('Firebase is not configured yet.');
  }

  if (!auth) {
    throw new Error('Firebase is not configured yet.');
  }

  if (auth.currentUser) {
    return auth.currentUser;
  }

  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function sendEmergencyAlert() {
  if (inFlight || Date.now() - lastSentAt < DUPLICATE_WINDOW_MS) {
    const duplicateError = new Error('Please wait before sending another alert.');
    duplicateError.name = 'DUPLICATE_GUARD';
    throw duplicateError;
  }

  inFlight = true;
  try {
    const user = await ensureAnonymousUser();
    if (!db) {
      throw new Error('Firebase is not configured yet.');
    }
    const alert = await addDoc(collection(db, 'alerts'), {
      userId: user.uid,
      createdAt: serverTimestamp(),
      status: 'active',
    });
    lastSentAt = Date.now();
    return { alertId: alert.id, userId: user.uid };
  } finally {
    inFlight = false;
  }
}

export function subscribeToAlert(
  alertId: string,
  onAlert: (alert: UserAlert) => void,
  onError: (error: Error) => void,
): () => void {
  if (!db) {
    onError(new Error('Firebase is not configured yet.'));
    return () => undefined;
  }

  return onSnapshot(
    doc(db, 'alerts', alertId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onError(new Error('This alert is no longer available.'));
        return;
      }
      onAlert(parseAlert(snapshot.id, snapshot.data()));
    },
    (error) => onError(error),
  );
}

export async function markAlertSafe(alertId: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured yet.');
  const { updateDoc } = await import('firebase/firestore');
  await updateDoc(doc(db, 'alerts', alertId), {
    status: 'safe',
    safeAt: serverTimestamp(),
    lastUpdatedAt: serverTimestamp(),
  });
}