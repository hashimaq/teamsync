/**
 * Chat toast helpers — grouping, previews, active-conversation detection.
 */

export const CHAT_TOAST_GROUP_MS = 2_500;
export const CHAT_MESSAGE_PREVIEW_MAX = 60;

export function truncateChatPreview(
  message: string,
  max = CHAT_MESSAGE_PREVIEW_MAX
): string {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function chatWorkspaceHref(workspaceId: string): string {
  return `/workspace/${workspaceId}`;
}

export function parseWorkspaceIdFromPath(
  pathname: string | null | undefined
): string | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/workspace\/([^/]+)/);
  return match?.[1] ?? null;
}

/**
 * True when the user is looking at this workspace's Chat panel
 * (default panel — URL has no `panel`, or `panel=chat`).
 */
export function isViewingWorkspaceChat(
  pathname: string,
  panelParam: string | null,
  workspaceId: string
): boolean {
  const currentId = parseWorkspaceIdFromPath(pathname);
  if (!currentId || currentId !== workspaceId) return false;
  if (!panelParam || panelParam === "chat") return true;
  return false;
}

export function chatToastGroupKey(
  workspaceId: string,
  senderId: string
): string {
  return `chat-toast:${workspaceId}:${senderId}`;
}

export function firstNameFromFullName(
  fullName: string | null | undefined
): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "Someone";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}
