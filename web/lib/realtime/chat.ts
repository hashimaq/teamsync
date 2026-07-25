import type { ChatMessageWithSender } from "@/types";

export type ChatMessageRealtimePayload = {
  id: string;
  workspace_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

export const WORKSPACE_CHAT_CHANNEL = (workspaceId: string) =>
  `workspace-chat:${workspaceId}`;

export function mergeChatMessage(
  current: ChatMessageWithSender[],
  incoming: ChatMessageWithSender
): ChatMessageWithSender[] {
  if (current.some((message) => message.id === incoming.id)) {
    return current;
  }

  // Replace matching optimistic message from the same sender
  const optimisticIndex = current.findIndex(
    (message) =>
      message.pending &&
      message.sender_id === incoming.sender_id &&
      message.message === incoming.message &&
      (message.client_id || message.id.startsWith("temp-"))
  );

  if (optimisticIndex >= 0) {
    const next = [...current];
    next[optimisticIndex] = incoming;
    return next;
  }

  return [...current, incoming];
}

export function formatChatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
