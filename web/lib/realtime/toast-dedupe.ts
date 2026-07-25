/**
 * Prevents duplicate realtime toasts across rapid reconnects / double events.
 */
const recentKeys = new Map<string, number>();

const DEFAULT_TTL_MS = 4_000;

export function shouldShowRealtimeToast(
  key: string,
  ttlMs: number = DEFAULT_TTL_MS
): boolean {
  const now = Date.now();

  for (const [existingKey, expiresAt] of recentKeys) {
    if (expiresAt <= now) {
      recentKeys.delete(existingKey);
    }
  }

  const existing = recentKeys.get(key);
  if (existing && existing > now) {
    return false;
  }

  recentKeys.set(key, now + ttlMs);
  return true;
}

export function rememberRealtimeToast(
  key: string,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  recentKeys.set(key, Date.now() + ttlMs);
}
