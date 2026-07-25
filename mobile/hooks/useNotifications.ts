import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@teamsync/shared";
import { queryKeys } from "@/lib/query-client";
import { freshChannel } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import * as notificationService from "@/services/notifications";

export function useNotificationsFeed() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.notifications(userId),
    queryFn: () => notificationService.listNotifications(),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (!userId) return;

    const channel = freshChannel(`notifications-user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Notification;
          queryClient.setQueryData<Notification[]>(
            queryKeys.notifications(userId),
            (current = []) =>
              current.some((n) => n.id === row.id) ? current : [row, ...current]
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
          const row = payload.new as Notification;
          queryClient.setQueryData<Notification[]>(
            queryKeys.notifications(userId),
            (current = []) =>
              current.map((n) => (n.id === row.id ? { ...n, ...row } : n))
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const markRead = useMutation({
    mutationFn: notificationService.markNotificationRead,
    onMutate: async (id) => {
      queryClient.setQueryData<Notification[]>(
        queryKeys.notifications(userId),
        (current = []) =>
          current.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    },
  });

  const markAll = useMutation({
    mutationFn: notificationService.markAllNotificationsRead,
    onMutate: async () => {
      queryClient.setQueryData<Notification[]>(
        queryKeys.notifications(userId),
        (current = []) => current.map((n) => ({ ...n, is_read: true }))
      );
    },
  });

  const unreadCount = (query.data ?? []).filter((n) => !n.is_read).length;

  return { ...query, markRead, markAll, unreadCount };
}
