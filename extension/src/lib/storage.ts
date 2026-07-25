import type { ExtensionBadgeCounts } from "@teamsync/shared";
import { STORAGE_KEYS, badgeText } from "@teamsync/shared";

export async function getActiveWorkspaceId(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.workspaceId);
  const value = result[STORAGE_KEYS.workspaceId];
  return typeof value === "string" ? value : null;
}

export async function setActiveWorkspaceId(workspaceId: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.workspaceId]: workspaceId });
}

export async function getBadgeCounts(): Promise<ExtensionBadgeCounts> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.unreadMessages,
    STORAGE_KEYS.unreadNotifications,
  ]);
  return {
    messages: Number(result[STORAGE_KEYS.unreadMessages] ?? 0) || 0,
    notifications: Number(result[STORAGE_KEYS.unreadNotifications] ?? 0) || 0,
  };
}

export async function setBadgeCounts(
  counts: Partial<ExtensionBadgeCounts>
): Promise<ExtensionBadgeCounts> {
  const current = await getBadgeCounts();
  const next: ExtensionBadgeCounts = {
    messages:
      typeof counts.messages === "number" ? counts.messages : current.messages,
    notifications:
      typeof counts.notifications === "number"
        ? counts.notifications
        : current.notifications,
  };
  await chrome.storage.local.set({
    [STORAGE_KEYS.unreadMessages]: next.messages,
    [STORAGE_KEYS.unreadNotifications]: next.notifications,
  });
  await applyBadge(next);
  return next;
}

export async function incrementBadge(
  field: keyof ExtensionBadgeCounts,
  by = 1
): Promise<ExtensionBadgeCounts> {
  const current = await getBadgeCounts();
  return setBadgeCounts({ [field]: Math.max(0, current[field] + by) });
}

export async function clearBadgeField(
  field: keyof ExtensionBadgeCounts
): Promise<void> {
  await setBadgeCounts({ [field]: 0 });
}

export async function applyBadge(counts?: ExtensionBadgeCounts): Promise<void> {
  const value = counts ?? (await getBadgeCounts());
  const text = badgeText(value.messages, value.notifications);
  await chrome.action.setBadgeBackgroundColor({ color: "#1d4ed8" });
  await chrome.action.setBadgeText({ text });
}
