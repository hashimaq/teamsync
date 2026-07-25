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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  CHAT_TOAST_GROUP_MS,
  chatToastGroupKey,
  chatWorkspaceHref,
  firstNameFromFullName,
  isViewingWorkspaceChat,
  truncateChatPreview,
} from "@/lib/realtime/chat-toast";
import type { ChatMessageRealtimePayload } from "@/lib/realtime/chat";
import { shouldShowRealtimeToast } from "@/lib/realtime/toast-dedupe";

interface ChatToastContextValue {
  /** Unread chat messages per workspace (toasts suppressed while viewing that chat). */
  unreadByWorkspace: Record<string, number>;
  totalUnread: number;
  clearWorkspaceUnread: (workspaceId: string) => void;
}

const ChatToastContext = createContext<ChatToastContextValue | null>(null);

type GroupBuffer = {
  workspaceId: string;
  workspaceName: string | null;
  senderId: string;
  senderName: string;
  count: number;
  latestPreview: string;
  toastId: string | number;
  timer: number | null;
};

type EnrichedMessage = {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  senderId: string;
  senderName: string;
  message: string;
};

async function enrichMessage(
  messageId: string,
  fallback: ChatMessageRealtimePayload
): Promise<EnrichedMessage> {
  const supabase = createClient();
  const { data } = await supabase
    .from("messages")
    .select(
      `
      id,
      workspace_id,
      sender_id,
      message,
      profiles:sender_id (
        full_name
      ),
      workspaces:workspace_id (
        name
      )
    `
    )
    .eq("id", messageId)
    .maybeSingle();

  if (!data) {
    return {
      id: fallback.id,
      workspaceId: fallback.workspace_id,
      workspaceName: null,
      senderId: fallback.sender_id,
      senderName: "Someone",
      message: fallback.message,
    };
  }

  const row = data as {
    id: string;
    workspace_id: string;
    sender_id: string;
    message: string;
    profiles:
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    workspaces: { name: string | null } | { name: string | null }[] | null;
  };

  const profile = Array.isArray(row.profiles)
    ? row.profiles[0] ?? null
    : row.profiles;
  const workspace = Array.isArray(row.workspaces)
    ? row.workspaces[0] ?? null
    : row.workspaces;

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: workspace?.name ?? null,
    senderId: row.sender_id,
    senderName: firstNameFromFullName(profile?.full_name),
    message: row.message,
  };
}

function buildDescription(group: GroupBuffer): string {
  const preview = truncateChatPreview(group.latestPreview);
  const where = group.workspaceName ? ` · ${group.workspaceName}` : "";
  if (group.count <= 1) {
    return `${group.senderName}${where}\n${preview}`;
  }
  return `${group.senderName} sent ${group.count} messages${where}\n${preview}`;
}

/**
 * App-wide listener for new chat messages.
 * Toasts every online member except the sender; suppressed while viewing that chat.
 */
export function ChatToastProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [unreadByWorkspace, setUnreadByWorkspace] = useState<
    Record<string, number>
  >({});

  const pathnameRef = useRef(pathname);
  const panelRef = useRef(searchParams.get("panel"));
  const userIdRef = useRef(userId);
  const groupsRef = useRef<Map<string, GroupBuffer>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);

  pathnameRef.current = pathname;
  panelRef.current = searchParams.get("panel");
  userIdRef.current = userId;

  const clearWorkspaceUnread = useCallback((workspaceId: string) => {
    setUnreadByWorkspace((current) => {
      if (!current[workspaceId]) return current;
      const next = { ...current };
      delete next[workspaceId];
      return next;
    });
  }, []);

  // Clear unread when user opens that workspace's chat
  useEffect(() => {
    const workspaceId = pathname.match(/^\/workspace\/([^/]+)/)?.[1];
    if (!workspaceId) return;
    if (isViewingWorkspaceChat(pathname, searchParams.get("panel"), workspaceId)) {
      clearWorkspaceUnread(workspaceId);
    }
  }, [pathname, searchParams, clearWorkspaceUnread]);

  const showOrUpdateGroupedToast = useCallback(
    (enriched: EnrichedMessage) => {
      const key = chatToastGroupKey(enriched.workspaceId, enriched.senderId);
      const existing = groupsRef.current.get(key);

      const openChat = () => {
        clearWorkspaceUnread(enriched.workspaceId);
        const group = groupsRef.current.get(key);
        if (group?.timer) window.clearTimeout(group.timer);
        groupsRef.current.delete(key);
        toast.dismiss(group?.toastId ?? key);
        router.push(chatWorkspaceHref(enriched.workspaceId));
      };

      if (existing) {
        existing.count += 1;
        existing.latestPreview = enriched.message;
        existing.senderName = enriched.senderName;
        existing.workspaceName = enriched.workspaceName;

        toast("💬 New Message", {
          id: existing.toastId,
          description: buildDescription(existing),
          duration: 8_000,
          action: {
            label: "Open Chat",
            onClick: openChat,
          },
          cancel: {
            label: "Dismiss",
            onClick: () => {
              if (existing.timer) window.clearTimeout(existing.timer);
              groupsRef.current.delete(key);
            },
          },
        });

        if (existing.timer) window.clearTimeout(existing.timer);
        existing.timer = window.setTimeout(() => {
          groupsRef.current.delete(key);
        }, CHAT_TOAST_GROUP_MS);
        return;
      }

      const toastId = key;
      const group: GroupBuffer = {
        workspaceId: enriched.workspaceId,
        workspaceName: enriched.workspaceName,
        senderId: enriched.senderId,
        senderName: enriched.senderName,
        count: 1,
        latestPreview: enriched.message,
        toastId,
        timer: null,
      };
      groupsRef.current.set(key, group);

      toast("💬 New Message", {
        id: toastId,
        description: buildDescription(group),
        duration: 8_000,
        action: {
          label: "Open Chat",
          onClick: openChat,
        },
        cancel: {
          label: "Dismiss",
          onClick: () => {
            if (group.timer) window.clearTimeout(group.timer);
            groupsRef.current.delete(key);
          },
        },
      });

      group.timer = window.setTimeout(() => {
        groupsRef.current.delete(key);
      }, CHAT_TOAST_GROUP_MS);
    },
    [clearWorkspaceUnread, router]
  );

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channelName = `chat-toasts:${userId}`;

    const existing = supabase
      .getChannels()
      .find((channel) => channel.topic === `realtime:${channelName}`);
    if (existing) {
      void supabase.removeChannel(existing);
    }

    const handleInsert = async (
      payload: RealtimePostgresChangesPayload<ChatMessageRealtimePayload>
    ) => {
      const row = payload.new as ChatMessageRealtimePayload | null;
      if (!row?.id) return;

      const me = userIdRef.current;
      if (!me || row.sender_id === me) return;

      // Deduplicate reconnect / double delivery
      if (!shouldShowRealtimeToast(`chat-msg:${row.id}`, 15_000)) return;

      if (
        isViewingWorkspaceChat(
          pathnameRef.current,
          panelRef.current,
          row.workspace_id
        )
      ) {
        return;
      }

      setUnreadByWorkspace((current) => ({
        ...current,
        [row.workspace_id]: (current[row.workspace_id] ?? 0) + 1,
      }));

      const enriched = await enrichMessage(row.id, row);

      // Re-check after async enrich — user may have opened chat
      if (
        isViewingWorkspaceChat(
          pathnameRef.current,
          panelRef.current,
          enriched.workspaceId
        )
      ) {
        setUnreadByWorkspace((current) => {
          const next = { ...current };
          const remaining = (next[enriched.workspaceId] ?? 1) - 1;
          if (remaining <= 0) delete next[enriched.workspaceId];
          else next[enriched.workspaceId] = remaining;
          return next;
        });
        return;
      }

      showOrUpdateGroupedToast(enriched);
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          void handleInsert(
            payload as RealtimePostgresChangesPayload<ChatMessageRealtimePayload>
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      for (const group of groupsRef.current.values()) {
        if (group.timer) window.clearTimeout(group.timer);
      }
      groupsRef.current.clear();
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [showOrUpdateGroupedToast, userId]);

  const totalUnread = useMemo(
    () =>
      Object.values(unreadByWorkspace).reduce((sum, count) => sum + count, 0),
    [unreadByWorkspace]
  );

  const value = useMemo(
    () => ({
      unreadByWorkspace,
      totalUnread,
      clearWorkspaceUnread,
    }),
    [unreadByWorkspace, totalUnread, clearWorkspaceUnread]
  );

  return (
    <ChatToastContext.Provider value={value}>
      {children}
    </ChatToastContext.Provider>
  );
}

export function useChatToasts(): ChatToastContextValue {
  const context = useContext(ChatToastContext);
  if (!context) {
    throw new Error("useChatToasts must be used within ChatToastProvider");
  }
  return context;
}

export function useChatToastsOptional(): ChatToastContextValue | null {
  return useContext(ChatToastContext);
}
