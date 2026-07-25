"use client";

import { useRouter } from "next/navigation";
import {
  CheckCheck,
  CheckCircle2,
  CircleCheck,
  ClipboardList,
  Crown,
  Mail,
  Pencil,
  Bell,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Sparkles,
} from "lucide-react";
import {
  firstName,
  formatNotificationTimeAgo,
  getNotificationHref,
  notificationIconKind,
} from "@/lib/notifications";
import type { Notification } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";

function getInitials(name: string | null | undefined) {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function NotificationTypeIcon({ type }: { type: Notification["type"] }) {
  const kind = notificationIconKind(type);
  const className = "h-3.5 w-3.5";

  switch (kind) {
    case "invite":
      return <Mail className={className} />;
    case "accept":
      return <CheckCircle2 className={className} />;
    case "join":
      return <UserPlus className={className} />;
    case "task":
      return <ClipboardList className={className} />;
    case "task_done":
      return <CircleCheck className={className} />;
    case "task_update":
      return <RefreshCw className={className} />;
    case "task_delete":
      return <Trash2 className={className} />;
    case "role":
      return <Crown className={className} />;
    case "remove":
      return <Trash2 className={className} />;
    case "rename":
      return <Pencil className={className} />;
    case "welcome":
      return <Sparkles className={className} />;
    default:
      return <Bell className={className} />;
  }
}

interface NotificationDropdownProps {
  notifications: Notification[];
  isLoading: boolean;
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

export function NotificationDropdown({
  notifications,
  isLoading,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationDropdownProps) {
  const router = useRouter();

  return (
    <div
      className="absolute right-0 z-50 mt-2 w-[min(100vw-1.5rem,24rem)] overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-xl backdrop-blur-md"
      role="dialog"
      aria-label="Notifications"
    >
      <div className="flex items-center justify-between border-b border-border/80 px-3.5 py-3">
        <div>
          <p className="text-sm font-semibold tracking-tight">Notifications</p>
          <p className="text-xs text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs"
            onClick={() => onMarkAllAsRead()}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all
          </Button>
        ) : null}
      </div>

      <div className="max-h-[22rem] overflow-y-auto">
        {isLoading ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : notifications.length === 0 ? (
          <div className="px-3 py-12 text-center">
            <Shield className="mx-auto h-7 w-7 text-muted-foreground/80" />
            <p className="mt-3 text-sm font-medium">No notifications yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Task updates, invites, and team changes appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {notifications.map((notification) => {
              const senderName = firstName(notification.sender?.full_name, "Someone");
              const taskTitle =
                typeof notification.metadata.task_title === "string"
                  ? notification.metadata.task_title
                  : null;
              const workspaceName =
                typeof notification.metadata.workspace_name === "string"
                  ? notification.metadata.workspace_name
                  : typeof notification.metadata.new_name === "string"
                    ? notification.metadata.new_name
                    : null;

              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full gap-3 px-3.5 py-3 text-left transition hover:bg-muted/50",
                      !notification.is_read ? "bg-primary/[0.04]" : null
                    )}
                    onClick={() => {
                      if (!notification.is_read) {
                        onMarkAsRead(notification.id);
                      }
                      onClose();
                      router.push(getNotificationHref(notification));
                    }}
                  >
                    <span className="relative shrink-0">
                      <Avatar className="h-9 w-9 border border-border/70">
                        {notification.sender?.avatar_url ? (
                          <AvatarImage
                            src={notification.sender.avatar_url}
                            alt=""
                          />
                        ) : null}
                        <AvatarFallback className="bg-muted text-[10px] font-medium">
                          {getInitials(notification.sender?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-card text-muted-foreground shadow-sm",
                          !notification.is_read
                            ? "text-primary"
                            : null
                        )}
                      >
                        <NotificationTypeIcon type={notification.type} />
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-snug text-foreground">
                          {senderName}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">
                            {formatNotificationTimeAgo(notification.created_at)}
                          </span>
                          {!notification.is_read ? (
                            <span
                              className="h-2 w-2 rounded-full bg-primary"
                              aria-label="Unread"
                            />
                          ) : null}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {notification.message}
                      </span>
                      {taskTitle || workspaceName ? (
                        <span className="mt-1.5 inline-flex max-w-full truncate rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">
                          {taskTitle ?? workspaceName}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
