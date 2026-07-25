"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { sendWorkspaceMessage } from "@/actions/messages";
import { createClient } from "@/lib/supabase/client";
import {
  mergeChatMessage,
  WORKSPACE_CHAT_CHANNEL,
  type ChatMessageRealtimePayload,
} from "@/lib/realtime/chat";
import type { ChatMessageWithSender } from "@/types";

interface UseWorkspaceChatOptions {
  workspaceId: string;
  currentUserId: string | null;
  currentUserName: string | null;
  currentUserAvatar: string | null;
  initialMessages: ChatMessageWithSender[];
  enabled?: boolean;
}

interface UseWorkspaceChatResult {
  messages: ChatMessageWithSender[];
  setMessages: Dispatch<SetStateAction<ChatMessageWithSender[]>>;
  isConnected: boolean;
  isSending: boolean;
  error: string | null;
  sendMessage: (rawMessage: string) => Promise<boolean>;
}

export function useWorkspaceChat({
  workspaceId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  initialMessages,
  enabled = true,
}: UseWorkspaceChatOptions): UseWorkspaceChatResult {
  const [messages, setMessages] = useState(initialMessages);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesRef = useRef(messages);
  const seenIdsRef = useRef(new Set(initialMessages.map((message) => message.id)));
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setMessages(initialMessages);
    seenIdsRef.current = new Set(initialMessages.map((message) => message.id));
  }, [initialMessages, workspaceId]);

  const upsertMessage = useCallback((incoming: ChatMessageWithSender) => {
    if (seenIdsRef.current.has(incoming.id)) {
      setMessages((current) =>
        current.map((message) =>
          message.id === incoming.id ||
          (message.pending &&
            message.sender_id === incoming.sender_id &&
            message.message === incoming.message)
            ? { ...incoming, pending: false, failed: false }
            : message
        )
      );
      return;
    }

    seenIdsRef.current.add(incoming.id);
    setMessages((current) => mergeChatMessage(current, incoming));
  }, []);

  useEffect(() => {
    if (!enabled || !workspaceId) return;

    const supabase = createClient();
    const channelName = WORKSPACE_CHAT_CHANNEL(workspaceId);

    const handleInsert = async (
      payload: RealtimePostgresChangesPayload<ChatMessageRealtimePayload>
    ) => {
      const row = payload.new as ChatMessageRealtimePayload | null;
      if (!row?.id) return;

      if (seenIdsRef.current.has(row.id)) {
        setMessages((current) =>
          current.map((message) =>
            message.id === row.id ||
            (message.pending &&
              message.sender_id === row.sender_id &&
              message.message === row.message)
              ? {
                  ...message,
                  id: row.id,
                  created_at: row.created_at,
                  pending: false,
                  failed: false,
                  client_id: undefined,
                }
              : message
          )
        );
        return;
      }

      // Enrich with sender profile when possible
      const { data } = await supabase
        .from("messages")
        .select(
          `
          id,
          workspace_id,
          sender_id,
          message,
          created_at,
          profiles:sender_id (
            id,
            full_name,
            avatar_url
          )
        `
        )
        .eq("id", row.id)
        .maybeSingle();

      if (data) {
        const raw = data as {
          id: string;
          workspace_id: string;
          sender_id: string;
          message: string;
          created_at: string;
          profiles:
            | {
                id: string;
                full_name: string | null;
                avatar_url: string | null;
              }
            | {
                id: string;
                full_name: string | null;
                avatar_url: string | null;
              }[]
            | null;
        };

        const profile = Array.isArray(raw.profiles)
          ? raw.profiles[0] ?? null
          : raw.profiles;

        upsertMessage({
          id: raw.id,
          workspace_id: raw.workspace_id,
          sender_id: raw.sender_id,
          message: raw.message,
          created_at: raw.created_at,
          sender: profile
            ? {
                id: profile.id,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
              }
            : null,
        });
        return;
      }

      upsertMessage({
        id: row.id,
        workspace_id: row.workspace_id,
        sender_id: row.sender_id,
        message: row.message,
        created_at: row.created_at,
        sender: null,
      });
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          void handleInsert(
            payload as RealtimePostgresChangesPayload<ChatMessageRealtimePayload>
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setError(null);
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsConnected(false);
          setError("Chat connection interrupted. Reconnecting…");
          return;
        }

        if (status === "CLOSED") {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      setIsConnected(false);
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, upsertMessage, workspaceId]);

  const sendMessage = useCallback(
    async (rawMessage: string) => {
      const trimmed = rawMessage.trim();
      if (!trimmed || !currentUserId) return false;

      setIsSending(true);
      setError(null);

      const clientId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `temp-${Date.now()}`;

      const optimistic: ChatMessageWithSender = {
        id: `temp-${clientId}`,
        client_id: clientId,
        workspace_id: workspaceId,
        sender_id: currentUserId,
        message: trimmed,
        created_at: new Date().toISOString(),
        pending: true,
        sender: {
          id: currentUserId,
          full_name: currentUserName,
          avatar_url: currentUserAvatar,
        },
      };

      setMessages((current) => [...current, optimistic]);

      const result = await sendWorkspaceMessage(workspaceId, trimmed);

      if (!result.success) {
        setMessages((current) =>
          current.map((message) =>
            message.client_id === clientId
              ? { ...message, pending: false, failed: true }
              : message
          )
        );
        setError(result.error);
        setIsSending(false);
        return false;
      }

      seenIdsRef.current.add(result.data.id);
      setMessages((current) =>
        mergeChatMessage(
          current.filter((message) => message.client_id !== clientId),
          { ...result.data, pending: false, failed: false }
        )
      );
      setIsSending(false);
      return true;
    },
    [currentUserAvatar, currentUserId, currentUserName, workspaceId]
  );

  return {
    messages,
    setMessages,
    isConnected,
    isSending,
    error,
    sendMessage,
  };
}
