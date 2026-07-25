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
import { useRealtimeLifecycle } from "@/hooks/use-realtime-lifecycle";
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

async function ensureRealtimeAuth() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    await supabase.realtime.setAuth(session.access_token);
  }
  return supabase;
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
  const [reconnectKey, setReconnectKey] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const seenIdsRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const isConnectedRef = useRef(false);
  const syncInFlightRef = useRef(false);

  const syncFromServer = useCallback(
    async (options?: { announceNew?: boolean }) => {
      if (!userId) {
        setNotifications([]);
        setIsLoading(false);
        return;
      }
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;

      try {
        const rows = await getMyNotifications();
        if (!mountedRef.current) return;

        const previousSeen = seenIdsRef.current;
        const incoming = sortNotificationsNewestFirst(rows);
        const brandNew = incoming.filter((row) => !previousSeen.has(row.id));

        seenIdsRef.current = new Set(incoming.map((row) => row.id));
        setNotifications(incoming);
        setError(null);

        if (options?.announceNew) {
          for (const row of brandNew) {
            if (
              row.sender_id !== userId &&
              shouldShowRealtimeToast(`notification:${row.id}`)
            ) {
              showNotificationToast(row);
            }
          }
        }
      } catch (refreshError: unknown) {
        if (!mountedRef.current) return;
        const message =
          refreshError instanceof Error
            ? refreshError.message
            : "Failed to load notifications";
        setError(message);
      } finally {
        syncInFlightRef.current = false;
        if (mountedRef.current) setIsLoading(false);
      }
    },
    [userId]
  );

  const refresh = useCallback(async () => {
    await syncFromServer({ announceNew: false });
  }, [syncFromServer]);

  const resumeRealtime = useCallback(() => {
    void (async () => {
      await syncFromServer({ announceNew: true });
      if (!isConnectedRef.current) {
        setReconnectKey((key) => key + 1);
      }
    })();
  }, [syncFromServer]);

  useEffect(() => {
    mountedRef.current = true;
    void syncFromServer({ announceNew: false });
    return () => {
      mountedRef.current = false;
    };
  }, [syncFromServer]);

  useRealtimeLifecycle({
    enabled: Boolean(userId),
    onResume: resumeRealtime,
    pollIntervalMs: 10_000,
  });

  useEffect(() => {
    if (!userId) {
      setIsConnected(false);
      isConnectedRef.current = false;
      return;
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;

    const setup = async () => {
      const supabase = await ensureRealtimeAuth();
      if (cancelled) return;

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

        if (
          shouldShowRealtimeToast(`notification:${row.id}`) &&
          row.sender_id !== userId
        ) {
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
        .channel(CHANNEL_NAME(userId))
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
          if (!mountedRef.current || cancelled) return;
          if (status === "SUBSCRIBED") {
            isConnectedRef.current = true;
            setIsConnected(true);
            setError(null);
            // Catch anything missed while the socket was down
            void syncFromServer({ announceNew: true });
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            isConnectedRef.current = false;
            setIsConnected(false);
            setError("Notifications reconnecting…");
            if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
            reconnectTimer = window.setTimeout(() => {
              if (mountedRef.current) setReconnectKey((key) => key + 1);
            }, 1500);
            return;
          }
          if (status === "CLOSED") {
            isConnectedRef.current = false;
            setIsConnected(false);
          }
        });

      channelRef.current = channel;
    };

    void setup();

    return () => {
      cancelled = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      const supabase = createClient();
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      isConnectedRef.current = false;
      setIsConnected(false);
    };
  }, [userId, reconnectKey, syncFromServer]);

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
