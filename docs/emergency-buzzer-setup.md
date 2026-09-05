# Emergency Buzzer System Setup

This project has two clients that share the same Firebase project:

- `artifacts/emergency-admin` — desktop admin dashboard
- `artifacts/emergency-user` — Expo Android app

The alert document shape is:

```text
alerts/{alertId}
  userId: string
  createdAt: timestamp
  status: "active" | "acknowledged" | "resolved"
  acknowledgedAt: timestamp | null
  resolvedAt: timestamp | null
```

## 1. Create the Firebase project

1. Open the Firebase Console and create a project.
2. Add a Web app to the project.
3. Copy the Web app configuration values into:
   - `artifacts/emergency-admin/.env.local` using the `VITE_FIREBASE_*` names.
   - `artifacts/emergency-user/.env` using the same values with the `EXPO_PUBLIC_*` names.
4. Enable **Authentication → Sign-in method → Email/Password**.
5. Enable **Authentication → Sign-in method → Anonymous**.
6. Create a Firestore database in production mode.
7. Deploy `firestore.rules` from the Firebase Console Rules tab, or with the Firebase CLI:

   ```bash
   firebase deploy --only firestore
   ```

## 2. Create the first admin

1. In Firebase Authentication, add an email/password user.
2. Copy that user's UID.
3. In Firestore, create a document at `admins/{uid}` using the UID as the document ID.
4. The document can contain `{ "role": "admin" }`.
5. Use the same email and password in the web dashboard login.

Admin users can read all alerts and change alert status. Android users sign in anonymously and can create alerts only for their own anonymous UID. Alert documents cannot be deleted from either client.

## 3. Run the clients

From the project root:

```bash
pnpm --filter @workspace/emergency-admin run dev
pnpm --filter @workspace/emergency-user run start
```

Use the Replit preview for the admin dashboard. For the phone app, scan the Expo QR code with Expo Go while the phone and development machine can reach the Expo dev server.

## 4. Test the end-to-end flow

1. Open the admin dashboard in a desktop browser.
2. Sign in with the Firebase admin account.
3. Open the Expo app on an Android phone.
4. Tap **EMERGENCY BUZZER** once.
5. Confirm the phone shows `Emergency alert sent.`.
6. Confirm a new red active alert appears in the desktop dashboard and the browser plays its short notification sound when audio is allowed.
7. Click **Acknowledge**, then **Resolve**. Both changes should appear without refreshing.

Firebase web configuration values are client-safe identifiers, not admin credentials. Never put a Firebase Admin SDK service-account JSON file or a password in the client apps.