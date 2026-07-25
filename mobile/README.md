# TeamSync Mobile (Expo)

Android/iOS client for the existing TeamSync Supabase backend.

## Setup

```bash
# from monorepo root
npm install
cp mobile/.env.example mobile/.env
# fill EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY (same as web)

npm run start:mobile
# or
cd mobile && npx expo start -c
```

Scan the QR code with **Expo Go** from the Play Store / App Store.

## Stack

- **Expo SDK 54** (React Native 0.81 / React 19.1) + Expo Router
- NativeWind + Tailwind v3 (mobile-local; root may have Tailwind v4 for web)
- Supabase JS (SecureStore session persistence)
- TanStack Query
- React Hook Form + Zod

## Expo Go (Play Store)

This app targets **Expo SDK 54** — the version currently shipped with Expo Go on the stores.

- Uses only Expo Go–supported modules (`expo-secure-store`, AsyncStorage, Router, etc.)
- No `react-native-vision-camera` / WebRTC / custom native modules
- Remote push is stubbed (throws in Expo Go on Android SDK 53+)
- In-app notification feed works via Supabase Realtime

Do **not** run `npx expo install --fix` — it can jump to SDK 55+ which store Expo Go cannot open.

## Same backend

Uses the same Supabase project as `web/` and `extension/`. No mock data.
