export function firstName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "Someone";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function truncate(text: string, max: number): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, Math.max(0, max - 1))}…`;
}

export function workspacePath(
  workspaceId: string,
  panel?: "chat" | "tasks" | "whiteboard" | "members" | "settings" | "notifications"
): string {
  if (!panel || panel === "chat") return `/workspace/${workspaceId}`;
  return `/workspace/${workspaceId}?panel=${panel}`;
}

export function absoluteWebUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function badgeText(messages: number, notifications: number): string {
  const total = messages + notifications;
  if (total <= 0) return "";
  return total > 99 ? "99+" : String(total);
}
