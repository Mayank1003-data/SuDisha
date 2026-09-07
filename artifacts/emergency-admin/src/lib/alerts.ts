import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'safe';
export type EmergencyAlert = {
  id: string;
  userId: string;
  createdAt: Date | string;
  status: AlertStatus;
  acknowledgedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  safeAt?: Date | string | null;
  lastUpdatedAt?: Date | string | null;
};

function toDate(value: unknown): Date | string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  if (value instanceof Date || typeof value === 'string') return value;
  return new Date();
}

function parseAlert(id: string, data: Record<string, unknown>): EmergencyAlert {
  return {
    id,
    userId: String(data.userId ?? 'unknown'),
    createdAt: toDate(data.createdAt),
    status: (data.status as AlertStatus) || 'active',
    acknowledgedAt: data.acknowledgedAt ? toDate(data.acknowledgedAt) : null,
    resolvedAt: data.resolvedAt ? toDate(data.resolvedAt) : null,
    safeAt: data.safeAt ? toDate(data.safeAt) : null,
    lastUpdatedAt: data.lastUpdatedAt ? toDate(data.lastUpdatedAt) : null,
  };
}

export function subscribeToAlerts(
  onAlerts: (alerts: EmergencyAlert[]) => void,
  onError: (error: Error) => void,
): () => void {
  if (!db) {
    onError(new Error('Firebase is not configured.'));
    return () => undefined;
  }
  const alertsQuery = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    alertsQuery,
    (snapshot) => onAlerts(snapshot.docs.map((item) => parseAlert(item.id, item.data()))),
    (error) => onError(error),
  );
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  await updateDoc(doc(db, 'alerts', alertId), {
    status: 'acknowledged',
    acknowledgedAt: serverTimestamp(),
    lastUpdatedAt: serverTimestamp(),
  });
}

export async function resolveAlert(alertId: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  await updateDoc(doc(db, 'alerts', alertId), {
    status: 'resolved',
    resolvedAt: serverTimestamp(),
    lastUpdatedAt: serverTimestamp(),
  });
}