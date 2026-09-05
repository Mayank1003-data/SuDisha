import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db, firebaseConfigured } from './firebase';

let inFlight = false;
let lastSentAt = 0;
const DUPLICATE_WINDOW_MS = 4000;

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