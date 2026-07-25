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
import { useNotifications } from "@/components/notifications/notification-provider";
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

export function WorkspaceNotificationsPanel() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 sm:px-6">
        <div>
          <h2 className="font-display text-base font-semibold">Notifications</h2>
          <p className="text-xs text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1 text-xs"
            onClick={() => void markAllAsRead()}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-6 [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto max-w-2xl">
          {isLoading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
          ) : notifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
              <Shield className="mx-auto h-8 w-8 text-muted-foreground/70" />
              <h3 className="mt-3 font-display text-base font-semibold">
                No notifications yet
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Invites, task updates, and team changes will show up here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((notification) => {
                const senderName = firstName(
                  notification.sender?.full_name,
                  "Someone"
                );
                const taskTitle =
                  typeof notification.metadata.task_title === "string"
                    ? notification.metadata.task_title
                    : null;

                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md",
                        !notification.is_read ? "bg-primary/[0.03]" : null
                      )}
                      onClick={() => {
                        if (!notification.is_read) {
                          void markAsRead(notification.id);
                        }
                        router.push(getNotificationHref(notification));
                      }}
                    >
                      <span className="relative shrink-0">
                        <Avatar className="h-10 w-10 border border-border/70">
                          {notification.sender?.avatar_url ? (
                            <AvatarImage
                              src={notification.sender.avatar_url}
                              alt=""
                            />
                          ) : null}
                          <AvatarFallback className="bg-muted text-xs font-medium">
                            {getInitials(notification.sender?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-card text-primary shadow-sm">
                          <NotificationTypeIcon type={notification.type} />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold">{senderName}</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground">
                              {formatNotificationTimeAgo(notification.created_at)}
                            </span>
                            {!notification.is_read ? (
                              <span className="h-2 w-2 rounded-full bg-primary" />
                            ) : null}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {notification.message}
                        </span>
                        {taskTitle ? (
                          <span className="mt-2 inline-flex rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium">
                            {taskTitle}
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
    </section>
  );
}
