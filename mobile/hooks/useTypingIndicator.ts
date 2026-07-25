import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
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
} from "@/lib/typing";

interface Options {
  workspaceId: string;
  userId: string | null | undefined;
  userName?: string | null;
  enabled?: boolean;
}

export function useTypingIndicator({
  workspaceId,
  userId,
  userName = null,
  enabled = true,
}: Options) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const remoteTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasBroadcastStartRef = useRef(false);
  const userNameRef = useRef(firstName(userName));
  const joinedRef = useRef(false);

  useEffect(() => {
    userNameRef.current = firstName(userName);
  }, [userName]);

  const clearRemoteTimers = useCallback(() => {
    for (const timer of remoteTimersRef.current.values()) {
      clearTimeout(timer);
    }
    remoteTimersRef.current.clear();
  }, []);

  const removeRemoteTyper = useCallback((remoteUserId: string) => {
    const timer = remoteTimersRef.current.get(remoteUserId);
    if (timer) {
      clearTimeout(timer);
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
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        removeRemoteTyper(payload.userId);
      }, TYPING_STALE_MS);

      remoteTimersRef.current.set(payload.userId, timer);
    },
    [removeRemoteTyper, userId, workspaceId]
  );

  const sendTypingStart = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !userId || !joinedRef.current) return;
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

    if (joinedRef.current) {
      await channel.send({
        type: "broadcast",
        event: TYPING_STOP_EVENT,
        payload: {
          type: "typing_stop",
          workspaceId,
          userId,
        } satisfies TypingStopPayload,
      });
    }
  }, [userId, workspaceId]);

  const stopTyping = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    void sendTypingStop();
  }, [sendTypingStop]);

  const onTypingActivity = useCallback(() => {
    if (!userId || !enabled) return;

    void sendTypingStart();

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      void sendTypingStop();
    }, TYPING_IDLE_MS);
  }, [enabled, sendTypingStart, sendTypingStop, userId]);

  useEffect(() => {
    if (!enabled || !workspaceId || !userId) {
      setTypingUsers([]);
      return;
    }

    const channelName = WORKSPACE_TYPING_CHANNEL(workspaceId);
    const topic = `realtime:${channelName}`;

    for (const existing of supabase.getChannels()) {
      if (existing.topic === topic) {
        void supabase.removeChannel(existing);
      }
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
        joinedRef.current = status === "SUBSCRIBED";
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          joinedRef.current = false;
          clearRemoteTimers();
          setTypingUsers([]);
        }
      });

    channelRef.current = channel;

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      clearRemoteTimers();
      setTypingUsers([]);
      joinedRef.current = false;

      const active = channelRef.current;
      channelRef.current = null;

      if (active) {
        if (hasBroadcastStartRef.current) {
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
    onTypingActivity,
    stopTyping,
  };
}
