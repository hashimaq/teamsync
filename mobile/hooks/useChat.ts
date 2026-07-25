import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatMessageWithSender } from "@teamsync/shared";
import { queryKeys } from "@/lib/query-client";
import { freshChannel } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import * as messageService from "@/services/messages";

export function useChat(workspaceId: string) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const typing = useTypingIndicator({
    workspaceId,
    userId: user?.id,
    userName: profile?.full_name,
    enabled: Boolean(workspaceId && user?.id),
  });

  const query = useQuery({
    queryKey: queryKeys.messages(workspaceId),
    queryFn: () => messageService.listMessages(workspaceId),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    if (!workspaceId) return;

    const channel = freshChannel(`workspace-chat:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            workspace_id: string;
            sender_id: string;
            message: string;
            created_at: string;
          };

          const { data: sender } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", row.sender_id)
            .maybeSingle();

          const next: ChatMessageWithSender = {
            ...row,
            sender: sender
              ? {
                  id: sender.id,
                  full_name: sender.full_name,
                  avatar_url: sender.avatar_url,
                }
              : null,
          };

          queryClient.setQueryData<ChatMessageWithSender[]>(
            queryKeys.messages(workspaceId),
            (current = []) => {
              if (current.some((m) => m.id === next.id)) return current;
              return [...current.filter((m) => m.client_id !== next.id), next];
            }
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, queryClient]);

  const send = useMutation({
    mutationFn: (text: string) => messageService.sendMessage(workspaceId, text),
    onMutate: async (text) => {
      typing.stopTyping();
      if (!user) return;
      const optimistic: ChatMessageWithSender = {
        id: `temp-${Date.now()}`,
        client_id: `temp-${Date.now()}`,
        workspace_id: workspaceId,
        sender_id: user.id,
        message: text.trim(),
        created_at: new Date().toISOString(),
        pending: true,
        sender: {
          id: user.id,
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        },
      };
      queryClient.setQueryData<ChatMessageWithSender[]>(
        queryKeys.messages(workspaceId),
        (current = []) => [...current, optimistic]
      );
    },
  });

  return {
    ...query,
    send,
    typingLabel: typing.typingLabel,
    onTypingActivity: typing.onTypingActivity,
    stopTyping: typing.stopTyping,
  };
}
