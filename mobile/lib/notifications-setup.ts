/**
 * Push notification scaffolding — Expo Go safe.
 *
 * Remote push via `expo-notifications` is NOT supported in Expo Go on Android
 * (SDK 53+). This module keeps the integration surface without importing that
 * native API at runtime, so the app runs in Expo Go.
 *
 * Wire a development build + `expo-notifications` later for real push tokens.
 */

export async function registerForPushNotifications(): Promise<string | null> {
  // Intentionally a no-op in Expo Go / default builds.
  return null;
}

export function getPushNotificationsStatus(): "unsupported_in_expo_go" | "ready_for_dev_build" {
  return "unsupported_in_expo_go";
}
