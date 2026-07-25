"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Check, Loader2, MessageSquare, Send, Smile } from "lucide-react";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { useWorkspaceChat } from "@/hooks/use-workspace-chat";
import { formatChatTimestamp } from "@/lib/realtime/chat";
import type { ChatMessageWithSender } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils";

const EMOJI_PRESET = [
  "👍",
  "🎉",
  "✅",
  "🔥",
  "👀",
  "🙌",
  "💡",
  "❤️",
  "😄",
  "🚀",
  "📌",
  "✨",
];

function getInitials(name: string | null | undefined) {
  const source = name?.trim() || "U";
  return source
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/70" />
      <span className="typing-dot typing-dot-delay-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/70" />
      <span className="typing-dot typing-dot-delay-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/70" />
    </span>
  );
}

type MessageGroup = {
  key: string;
  senderId: string;
  messages: ChatMessageWithSender[];
};

function groupMessages(messages: ChatMessageWithSender[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    if (last && last.senderId === message.sender_id) {
      last.messages.push(message);
    } else {
      groups.push({
        key: message.client_id ?? message.id,
        senderId: message.sender_id,
        messages: [message],
      });
    }
  }
  return groups;
}

function ChatMessageGroup({
  group,
  isOwn,
}: {
  group: MessageGroup;
  isOwn: boolean;
}) {
  const first = group.messages[0];
  const name = first.sender?.full_name?.trim() || "Unknown";

  return (
    <div
      className={cn(
        "flex gap-3 px-1 py-1.5",
        isOwn ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className="mt-0.5 h-9 w-9 shrink-0 border border-border/60">
        {first.sender?.avatar_url ? (
          <AvatarImage src={first.sender.avatar_url} alt={name} />
        ) : null}
        <AvatarFallback className="bg-muted text-[10px] font-medium">
          {getInitials(first.sender?.full_name)}
        </AvatarFallback>
      </Avatar>

      <div className={cn("min-w-0 max-w-[min(100%,28rem)]", isOwn && "items-end")}>
        <div
          className={cn(
            "mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          <span
            className={cn(
              "text-sm font-semibold",
              isOwn ? "text-primary" : "text-foreground"
            )}
          >
            {isOwn ? "You" : name}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatChatTimestamp(first.created_at)}
          </span>
        </div>
        <div className={cn("space-y-1", isOwn ? "flex flex-col items-end" : null)}>
          {group.messages.map((message) => (
            <div
              key={message.client_id ?? message.id}
              className={cn(
                "group/msg text-[13px] leading-relaxed whitespace-pre-wrap break-words",
                message.pending ? "opacity-70" : null,
                message.failed ? "text-destructive" : "text-foreground"
              )}
            >
              <span
                className={cn(
                  "inline-flex max-w-full items-end gap-2",
                  isOwn ? "flex-row-reverse" : "flex-row"
                )}
              >
                <span
                  className={cn(
                    "rounded-2xl px-3 py-1.5 shadow-sm",
                    isOwn
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-muted/70 text-foreground",
                    message.failed ? "ring-1 ring-destructive/40" : null
                  )}
                >
                  {message.message}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground opacity-70">
                  {message.pending ? (
                    "Sending"
                  ) : message.failed ? (
                    "Failed"
                  ) : (
                    <>
                      <Check className="h-3 w-3" aria-hidden />
                      Sent
                    </>
                  )}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface WorkspaceChatProps {
  workspaceId: string;
  currentUserId: string | null;
  currentUserName: string | null;
  currentUserAvatar: string | null;
  initialMessages: ChatMessageWithSender[];
}

export function WorkspaceChat({
  workspaceId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  initialMessages,
}: WorkspaceChatProps) {
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { typingLabel, onTypingActivity, stopTyping } = useTypingIndicator({
    workspaceId,
    userId: currentUserId,
    userName: currentUserName,
    enabled: Boolean(currentUserId),
  });

  const { messages, isConnected, isSending, error, sendMessage } = useWorkspaceChat({
    workspaceId,
    currentUserId,
    currentUserName,
    currentUserAvatar,
    initialMessages,
  });

  const groups = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typingLabel]);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    const value = draft;
    if (!value.trim() || isSending || !currentUserId) return;

    stopTyping();
    setEmojiOpen(false);
    setDraft("");
    const ok = await sendMessage(value);
    if (!ok) setDraft(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (value.trim()) {
      onTypingActivity();
    } else {
      stopTyping();
    }
  }

  function insertEmoji(emoji: string) {
    const next = `${draft}${emoji}`;
    setDraft(next);
    onTypingActivity();
    setEmojiOpen(false);
    textareaRef.current?.focus();
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/80 bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
        <div>
          <h2 className="font-display text-base font-semibold">Chat</h2>
          <p className="text-xs text-muted-foreground">
            {isConnected ? "Live · messages sync instantly" : "Connecting…"}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-5 [-webkit-overflow-scrolling:touch]">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-4 text-center">
            <div className="rounded-2xl border border-dashed border-border bg-card/70 p-8 shadow-sm">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-display text-base font-semibold">
                Welcome to the channel
              </h3>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                Share updates, ask questions, and keep everyone aligned — messages
                appear for the whole workspace in realtime.
              </p>
            </div>
          </div>
        ) : (
          groups.map((group) => (
            <ChatMessageGroup
              key={group.key}
              group={group}
              isOwn={!!currentUserId && group.senderId === currentUserId}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className={cn(
          "overflow-hidden px-4 transition-all duration-300 sm:px-5",
          typingLabel ? "max-h-10 py-1.5 opacity-100" : "max-h-0 opacity-0"
        )}
        aria-live="polite"
      >
        {typingLabel ? (
          <div className="flex items-center gap-2">
            <TypingDots />
            <p className="text-[11px] text-muted-foreground">{typingLabel}</p>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="sticky bottom-0 border-t border-border/80 bg-background/95 p-3 backdrop-blur sm:p-4"
      >
        <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
          <div className="relative">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0 rounded-xl"
              aria-label="Insert emoji"
              aria-expanded={emojiOpen}
              disabled={!currentUserId}
              onClick={() => setEmojiOpen((open) => !open)}
            >
              <Smile className="h-4 w-4" />
            </Button>
            {emojiOpen ? (
              <div className="absolute bottom-11 left-0 z-20 grid w-52 grid-cols-6 gap-1 rounded-xl border border-border bg-card p-2 shadow-xl">
                {EMOJI_PRESET.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-lg p-1.5 text-base transition hover:bg-muted"
                    onClick={() => insertEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => handleDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => stopTyping()}
            placeholder="Message this workspace…"
            rows={1}
            disabled={!currentUserId || isSending}
            className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            aria-label="Chat message"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!currentUserId || isSending || !draft.trim()}
            className="h-9 w-9 shrink-0 rounded-xl"
            aria-label="Send message"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {error ? (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Enter to send · Shift + Enter for a new line
          </p>
        )}
      </form>
    </section>
  );
}

export function WorkspaceChatSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-full min-h-[240px] w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  );
}
