"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import {
  getMyNotifications,
  getNotificationSenderProfile,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import { createClient } from "@/lib/supabase/client";
import {
  countUnread,
  sortNotificationsNewestFirst,
} from "@/lib/notifications";
import { shouldShowRealtimeToast } from "@/lib/realtime/toast-dedupe";
import { showNotificationToast } from "@/components/NotificationToast";
import type { Notification } from "@/types";

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const CHANNEL_NAME = (userId: string) => `notifications-user:${userId}`;

async function enrichSender(row: Notification): Promise<Notification> {
  if (row.sender || !row.sender_id) return row;
  const sender = await getNotificationSenderProfile(row.sender_id);
  return { ...row, sender };
}

/**
 * Single app-wide subscription for the current user's notifications.
 * Mount once under AppChrome — never create parallel useNotifications hooks.
 */
export function NotificationProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const seenIdsRef = useRef(new Set<string>());
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    try {
      const rows = await getMyNotifications();
      if (!mountedRef.current) return;
      setNotifications(sortNotificationsNewestFirst(rows));
      seenIdsRef.current = new Set(rows.map((row) => row.id));
      setError(null);
    } catch (refreshError: unknown) {
      if (!mountedRef.current) return;
      const message =
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to load notifications";
      setError(message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!userId) {
      setIsConnected(false);
      return;
    }

    const supabase = createClient();
    const channelName = CHANNEL_NAME(userId);

    // Do not steal foreign channels — only remove our own previous channel
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const handleInsert = async (
      payload: RealtimePostgresChangesPayload<Notification>
    ) => {
      const row = payload.new as Notification | null;
      if (!row?.id || row.recipient_id !== userId) return;
      if (seenIdsRef.current.has(row.id)) return;

      seenIdsRef.current.add(row.id);
      const enriched = await enrichSender(row);
      if (!mountedRef.current) return;

      setNotifications((current) =>
        sortNotificationsNewestFirst([enriched, ...current])
      );

      if (shouldShowRealtimeToast(`notification:${row.id}`) && row.sender_id !== userId) {
        showNotificationToast(enriched);
      }
    };

    const handleUpdate = (
      payload: RealtimePostgresChangesPayload<Notification>
    ) => {
      const row = payload.new as Notification | null;
      if (!row?.id || row.recipient_id !== userId) return;

      setNotifications((current) =>
        current.map((item) =>
          item.id === row.id
            ? { ...item, ...row, sender: item.sender }
            : item
        )
      );
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          void handleInsert(
            payload as RealtimePostgresChangesPayload<Notification>
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          handleUpdate(payload as RealtimePostgresChangesPayload<Notification>);
        }
      )
      .subscribe((status) => {
        if (!mountedRef.current) return;
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setError(null);
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsConnected(false);
          setError("Notifications reconnecting…");
          return;
        }
        if (status === "CLOSED") {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [userId]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item
        )
      );

      const result = await markNotificationRead(notificationId);
      if (!result.success) {
        setError(result.error);
        await refresh();
      }
    },
    [refresh]
  );

  const markAllAsRead = useCallback(async () => {
    setNotifications((current) =>
      current.map((item) => ({ ...item, is_read: true }))
    );

    const result = await markAllNotificationsRead();
    if (!result.success) {
      setError(result.error);
      await refresh();
    }
  }, [refresh]);

  const unreadCount = useMemo(
    () => countUnread(notifications),
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      isConnected,
      error,
      markAsRead,
      markAllAsRead,
      refresh,
    }),
    [
      notifications,
      unreadCount,
      isLoading,
      isConnected,
      error,
      markAsRead,
      markAllAsRead,
      refresh,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}

/** Safe hook when provider may be absent (e.g. auth pages). */
export function useNotificationsOptional(): NotificationContextValue | null {
  return useContext(NotificationContext);
}
