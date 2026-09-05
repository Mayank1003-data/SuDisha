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
- `firestore.rules` — security rules for anonymous user creates and admin-only reads/updates
- `docs/emergency-buzzer-setup.md` — Firebase setup, admin provisioning, and manual test checklist
- `.env.example` — environment variable names for both clients

## Architecture decisions

- Firestore is the shared real-time backend so the browser and phone do not need a custom server hop.
- Android users authenticate anonymously; administrators use email/password plus an `admins/{uid}` roster document.
- Alert IDs are Firestore document IDs and are shown in the control room alongside the originating user ID.
- The mobile sender uses an in-flight and short time-window guard to prevent rapid duplicate alerts.

## Product

Android users can send one emergency buzzer alert and receive immediate confirmation. Authorized administrators can sign in, watch active and resolved alerts in real time, hear a browser notification tone for new active incidents, acknowledge alerts, and resolve them.

## User preferences

- Keep the first version focused on the buzzer-to-admin flow; do not add GPS, maps, push notifications, or detection without a new request.

## Gotchas

- The admin dashboard remains in configuration mode until `VITE_FIREBASE_*` values are present.
- The Firebase `admins/{uid}` document is required in addition to an Auth email/password account.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
