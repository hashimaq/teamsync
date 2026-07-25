"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  firstName,
  formatTypingIndicator,
  TYPING_IDLE_MS,
  TYPING_STALE_MS,
  TYPING_START_EVENT,
  TYPING_STOP_EVENT,
  WORKSPACE_TYPING_CHANNEL,
  type TypingStartPayload,
  type TypingStopPayload,
  type TypingUser,
} from "@/lib/realtime/typing";

interface UseTypingIndicatorOptions {
  workspaceId: string;
  userId: string | null;
  userName?: string | null;
  enabled?: boolean;
}

interface UseTypingIndicatorResult {
  typingUsers: TypingUser[];
  typingLabel: string | null;
  isConnected: boolean;
  /** Call on each input change while draft has content. */
  onTypingActivity: () => void;
  /** Broadcast typing_stop (send / clear / blur / unmount). */
  stopTyping: () => void;
}

export function useTypingIndicator({
  workspaceId,
  userId,
  userName = null,
  enabled = true,
}: UseTypingIndicatorOptions): UseTypingIndicatorResult {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const remoteTimersRef = useRef<Map<string, number>>(new Map());
  const idleTimerRef = useRef<number | null>(null);
  /** True after we broadcast typing_start until we broadcast typing_stop. */
  const hasBroadcastStartRef = useRef(false);
  const userNameRef = useRef(firstName(userName));

  useEffect(() => {
    userNameRef.current = firstName(userName);
  }, [userName]);

  const clearRemoteTimers = useCallback(() => {
    for (const timer of remoteTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    remoteTimersRef.current.clear();
  }, []);

  const removeRemoteTyper = useCallback((remoteUserId: string) => {
    const timer = remoteTimersRef.current.get(remoteUserId);
    if (timer) {
      window.clearTimeout(timer);
      remoteTimersRef.current.delete(remoteUserId);
    }
    setTypingUsers((current) =>
      current.filter((user) => user.userId !== remoteUserId)
    );
  }, []);

  const addRemoteTyper = useCallback(
    (payload: TypingStartPayload) => {
      if (!payload.userId || payload.userId === userId) return;
      if (payload.workspaceId !== workspaceId) return;

      setTypingUsers((current) => {
        const without = current.filter((user) => user.userId !== payload.userId);
        return [
          ...without,
          {
            userId: payload.userId,
            userName: payload.userName || "Someone",
          },
        ];
      });

      const existing = remoteTimersRef.current.get(payload.userId);
      if (existing) window.clearTimeout(existing);

      const timer = window.setTimeout(() => {
        removeRemoteTyper(payload.userId);
      }, TYPING_STALE_MS);

      remoteTimersRef.current.set(payload.userId, timer);
    },
    [removeRemoteTyper, userId, workspaceId]
  );

  const sendTypingStart = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !userId || channel.state !== "joined") return;
    if (hasBroadcastStartRef.current) return;

    hasBroadcastStartRef.current = true;

    const payload: TypingStartPayload = {
      type: "typing_start",
      workspaceId,
      userId,
      userName: userNameRef.current,
    };

    await channel.send({
      type: "broadcast",
      event: TYPING_START_EVENT,
      payload,
    });
  }, [userId, workspaceId]);

  const sendTypingStop = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !userId) return;
    if (!hasBroadcastStartRef.current) return;

    hasBroadcastStartRef.current = false;

    const payload: TypingStopPayload = {
      type: "typing_stop",
      workspaceId,
      userId,
    };

    if (channel.state === "joined") {
      await channel.send({
        type: "broadcast",
        event: TYPING_STOP_EVENT,
        payload,
      });
    }
  }, [userId, workspaceId]);

  const stopTyping = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    void sendTypingStop();
  }, [sendTypingStop]);

  const onTypingActivity = useCallback(() => {
    if (!userId || !enabled) return;

    void sendTypingStart();

    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null;
      void sendTypingStop();
    }, TYPING_IDLE_MS);
  }, [enabled, sendTypingStart, sendTypingStop, userId]);

  useEffect(() => {
    if (!enabled || !workspaceId || !userId) {
      setTypingUsers([]);
      setIsConnected(false);
      return;
    }

    const supabase = createClient();
    const channelName = WORKSPACE_TYPING_CHANNEL(workspaceId);

    const existing = supabase
      .getChannels()
      .find((channel) => channel.topic === `realtime:${channelName}`);
    if (existing) {
      void supabase.removeChannel(existing);
    }

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    channel
      .on("broadcast", { event: TYPING_START_EVENT }, ({ payload }) => {
        const data = payload as TypingStartPayload | null;
        if (!data || data.type !== "typing_start") return;
        addRemoteTyper(data);
      })
      .on("broadcast", { event: TYPING_STOP_EVENT }, ({ payload }) => {
        const data = payload as TypingStopPayload | null;
        if (!data || data.type !== "typing_stop") return;
        if (data.userId === userId) return;
        if (data.workspaceId !== workspaceId) return;
        removeRemoteTyper(data.userId);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setIsConnected(false);
          // Drop remote typers on connection loss to avoid stale UI
          clearRemoteTimers();
          setTypingUsers([]);
        }
      });

    channelRef.current = channel;

    const handlePageHide = () => {
      void sendTypingStop();
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);

      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }

      clearRemoteTimers();
      setTypingUsers([]);
      setIsConnected(false);

      const active = channelRef.current;
      channelRef.current = null;

      if (active) {
        // Best-effort stop before removing channel
        if (hasBroadcastStartRef.current && active.state === "joined") {
          void active.send({
            type: "broadcast",
            event: TYPING_STOP_EVENT,
            payload: {
              type: "typing_stop",
              workspaceId,
              userId,
            } satisfies TypingStopPayload,
          });
          hasBroadcastStartRef.current = false;
        }
        void supabase.removeChannel(active);
      }
    };
  }, [
    addRemoteTyper,
    clearRemoteTimers,
    enabled,
    removeRemoteTyper,
    sendTypingStop,
    userId,
    workspaceId,
  ]);

  const typingLabel = useMemo(
    () => formatTypingIndicator(typingUsers),
    [typingUsers]
  );

  return {
    typingUsers,
    typingLabel,
    isConnected,
    onTypingActivity,
    stopTyping,
  };
}
