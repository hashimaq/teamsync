"use client";

/**
 * Compatibility shim — prefer NotificationProvider + useNotifications from
 * components/notifications/notification-provider.
 */
export {
  useNotifications,
  useNotificationsOptional,
  NotificationProvider,
} from "@/components/notifications/notification-provider";
