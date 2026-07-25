import type { Notification, NotificationType } from "@/types";

export type NotificationMetadata = Record<string, string | number | boolean | null>;

export type CreateNotificationInput = {
  workspaceId?: string | null;
  recipientId: string;
  senderId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
};

export function firstName(
  fullName: string | null | undefined,
  fallback = "Someone"
): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function formatNotificationTimeAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const diffMs = Math.max(0, now - then);
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 45) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function notificationIconKind(
  type: NotificationType
):
  | "invite"
  | "accept"
  | "join"
  | "task"
  | "task_done"
  | "task_update"
  | "task_delete"
  | "role"
  | "remove"
  | "rename"
  | "welcome"
  | "default" {
  switch (type) {
    case "invitation_received":
      return "invite";
    case "invitation_accepted":
      return "accept";
    case "member_joined":
      return "join";
    case "task_assigned":
      return "task";
    case "task_completed":
      return "task_done";
    case "task_updated":
      return "task_update";
    case "task_deleted":
      return "task_delete";
    case "role_changed":
      return "role";
    case "member_removed":
      return "remove";
    case "workspace_renamed":
      return "rename";
    case "welcome":
    case "chat_mention":
      return "welcome";
    default:
      return "default";
  }
}

export function getNotificationHref(notification: Notification): string {
  const workspaceId = notification.workspace_id;
  const panelForType = (type: NotificationType): string | null => {
    switch (type) {
      case "invitation_received":
        return null;
      case "task_assigned":
      case "task_completed":
      case "task_updated":
      case "task_deleted":
        return "tasks";
      case "member_joined":
      case "member_removed":
      case "role_changed":
      case "invitation_accepted":
        return "members";
      case "workspace_renamed":
        return "settings";
      default:
        return "chat";
    }
  };

  if (notification.type === "invitation_received") {
    return "/dashboard";
  }

  if (!workspaceId) return "/dashboard";

  const panel = panelForType(notification.type);
  if (!panel) return `/workspace/${workspaceId}`;
  return `/workspace/${workspaceId}?panel=${panel}`;
}

export function sortNotificationsNewestFirst(
  notifications: Notification[]
): Notification[] {
  return [...notifications].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function countUnread(notifications: Notification[]): number {
  return notifications.reduce((count, item) => (item.is_read ? count : count + 1), 0);
}

export function quotedTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  return trimmed ? `“${trimmed}”` : "a task";
}
