# Emergency Buzzer System Setup

This project has two clients that share the same Firebase project:

- `artifacts/emergency-admin` — desktop admin dashboard
- `artifacts/emergency-user` — Expo Android app

The alert document shape is:

```text
alerts/{alertId}
  userId: string
  createdAt: timestamp
  status: "active" | "acknowledged" | "resolved" | "safe"
  acknowledgedAt: timestamp | null
  resolvedAt: timestamp | null
  safeAt: timestamp | null
  lastUpdatedAt: timestamp | null
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

Admin users can read all alerts and change alert status. Android users sign in anonymously, can create alerts only for their own anonymous UID, can read their own alert, and can update their own alert to `safe`. Alert documents cannot be deleted from either client.

The mobile app requests foreground location permission after an SOS and reads verified shelters from the `shelters` collection. It deliberately shows the unavailable state when there are no valid active/verified shelter documents rather than inventing a shelter or distance.

## 3. Add verified shelter locations

Shelters are maintained manually in the same Firebase project:

1. Open **Firebase Console → Firestore Database → Data**.
2. Click **Start collection** and enter `shelters` as the collection ID.
3. Create one document per shelter. Firebase can generate the document ID.
4. Add these fields with the exact types:

   ```text
   name: "Example Community Shelter"       string
   address: "Full street address"          string
   latitude: 25.123456                     number
   longitude: 85.654321                   number
   verified: true                          boolean
   active: true                            boolean
   source: "Approved authority name"       string (optional)
   ```

5. Set `verified` to `true` only after the location has been confirmed by the approved source.
6. Set `active` to `false` instead of deleting a shelter that is temporarily unavailable.

The Android app reads only documents where both `verified` and `active` are `true`, then calculates the nearest valid record using the phone's GPS coordinates. Deploy the updated `firestore.rules` and `firestore.indexes.json` before testing.

## 4. Run the clients

From the project root:

```bash
pnpm --filter @workspace/emergency-admin run dev
pnpm --filter @workspace/emergency-user run dev
```

Use the Replit preview for the admin dashboard. For the phone app, scan the Expo QR code with Expo Go while the phone and development machine can reach the Expo dev server.

## 5. Test the end-to-end flow

1. Open the admin dashboard in a desktop browser.
2. Sign in with the Firebase admin account.
3. Open the Expo app on an Android phone.
4. Tap **EMERGENCY BUZZER** once.
5. Confirm the app opens the Emergency Guidance screen with the alert ID and SOS status.
6. Confirm a new active alert appears in the desktop dashboard.
7. Click **Enable sound** in the dashboard when prompted, then confirm a new SOS starts the browser alarm.
8. Click **Acknowledge** and confirm the alarm stops.
9. Add at least one verified active shelter document using the steps above.
10. On the phone, review the nearest shelter name, address, and distance.
11. If no valid shelter documents exist, confirm the app shows the honest shelter-unavailable state and emergency DOs and DON'Ts.
12. Tap **I AM SAFE** and confirm the dashboard changes to `User marked safe` without refreshing.
13. Click **Resolve** from the dashboard. The status should become `Resolved`.

Firebase web configuration values are client-safe identifiers, not admin credentials. Never put a Firebase Admin SDK service-account JSON file or a password in the client apps.