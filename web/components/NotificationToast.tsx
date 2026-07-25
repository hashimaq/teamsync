"use client";

import { toast } from "sonner";
import { getNotificationHref } from "@/lib/notifications";
import type { Notification } from "@/types";

export function showNotificationToast(notification: Notification): void {
  toast(notification.title, {
    description: notification.message,
    duration: 5_000,
    action: {
      label: "Open",
      onClick: () => {
        if (typeof window !== "undefined") {
          window.location.assign(getNotificationHref(notification));
        }
      },
    },
  });
}
