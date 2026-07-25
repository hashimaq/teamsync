export const WORKSPACE_TYPING_CHANNEL = (workspaceId: string) =>
  `workspace-typing:${workspaceId}`;

export const TYPING_START_EVENT = "typing_start";
export const TYPING_STOP_EVENT = "typing_stop";

export type TypingStartPayload = {
  type: "typing_start";
  workspaceId: string;
  userId: string;
  userName: string;
};

export type TypingStopPayload = {
  type: "typing_stop";
  workspaceId: string;
  userId: string;
};

export type TypingUser = {
  userId: string;
  userName: string;
};

/** Local idle window before broadcasting typing_stop. */
export const TYPING_IDLE_MS = 1_500;

/**
 * Absolute safety TTL if typing_stop never arrives (crash / disconnect).
 * Kept long because typing_start is only sent once per typing session.
 */
export const TYPING_STALE_MS = 60_000;

export function formatTypingIndicator(users: TypingUser[]): string | null {
  if (users.length === 0) return null;

  const names = users.map((user) => user.userName);

  if (names.length === 1) {
    return `${names[0]} is typing...`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing...`;
  }

  const others = names.length - 2;
  return `${names[0]}, ${names[1]} and ${others} ${
    others === 1 ? "other" : "others"
  } are typing...`;
}

export function firstName(
  fullName: string | null | undefined,
  fallback = "Someone"
): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return fallback;
  return trimmed.split(" ")[0] ?? trimmed;
}
