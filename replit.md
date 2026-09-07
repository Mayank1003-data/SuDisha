# Emergency Buzzer System

An Android emergency buzzer and browser-based control room that share real-time Firestore alerts.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/emergency-admin run dev` — run the admin web dashboard
- `pnpm --filter @workspace/emergency-user run dev` — run the Android Expo app
- `pnpm run typecheck` — full typecheck across all packages
- `PORT=22966 BASE_PATH=/ pnpm --filter @workspace/emergency-admin run build` — production-build the dashboard locally
- Required Firebase client env values are documented in `.env.example`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Admin web: React + Vite + Tailwind CSS
- Android: Expo Router + React Native
- Backend: Firebase Authentication + Firestore real-time listeners

## Where things live

- `artifacts/emergency-admin` — signed-in admin dashboard and Firestore listener
- `artifacts/emergency-user` — single-screen Android buzzer with anonymous Firebase auth
- `firestore.rules` — security rules for anonymous user creates, owner SAFE updates, and admin reads/updates
- `docs/emergency-buzzer-setup.md` — Firebase setup, admin provisioning, and manual test checklist
- `.env.example` — environment variable names for both clients

## Architecture decisions

- Firestore is the shared real-time backend so the browser and phone do not need a custom server hop.
- Android users authenticate anonymously; administrators use email/password plus an `admins/{uid}` roster document.
- Alert IDs are Firestore document IDs and are shown in the control room alongside the originating user ID.
- The mobile sender uses an in-flight and short time-window guard to prevent rapid duplicate alerts.
- The mobile client can mark its own alert `safe`; the owner can read the same alert document so response status changes stream back to the guidance screen.
- Shelter lookup uses a real foreground GPS permission request and an explicit unavailable state until a verified shelter data source is connected.
- The admin alarm is session-based: a new active alert starts one alarm session, sound must be enabled by operator gesture when autoplay is blocked, and acknowledge/mute stops it.

## Product

Android users can send an emergency buzzer alert, receive an SOS guidance screen, view the alert status, mark themselves safe, and review emergency DOs and DON'Ts. Authorized administrators can sign in, watch active, acknowledged, resolved, and safe alerts in real time, enable or stop an alarm for new incidents, acknowledge alerts, and resolve them.

## User preferences

- GPS is used only after an SOS to request a verified nearest-shelter lookup. No shelter provider is configured yet, so the UI must show that shelter information is unavailable rather than inventing a location or distance.

## Gotchas

- The admin dashboard remains in configuration mode until `VITE_FIREBASE_*` values are present.
- The Firebase `admins/{uid}` document is required in addition to an Auth email/password account.
- After changing `firestore.rules`, publish the updated rules in Firebase Console before testing the mobile SAFE action.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
