"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  colorForUserId,
  firstName,
  isValidSurface,
  isWhiteboardBroadcastEvent,
  mapPointToSurface,
  WB_EVENT,
  WORKSPACE_WHITEBOARD_CHANNEL,
  type WhiteboardBroadcastEvent,
  type WhiteboardCursorEvent,
  type WhiteboardPresenceMeta,
  type WhiteboardPresenceStatus,
  type WhiteboardSegmentEvent,
  type WhiteboardSurface,
} from "@/lib/whiteboard";

export interface WhiteboardPeerCursor {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  surface: WhiteboardSurface;
  updatedAt: number;
}

interface UseWhiteboardRealtimeOptions {
  workspaceId: string;
  userId: string | null;
  userName?: string | null;
  avatarUrl?: string | null;
  enabled?: boolean;
  /** Local CSS canvas size — used to map peer cursors */
  getLocalSurface?: () => WhiteboardSurface;
  onEvent: (event: WhiteboardBroadcastEvent) => void;
}

interface UseWhiteboardRealtimeResult {
  isConnected: boolean;
  peers: WhiteboardPresenceMeta[];
  cursors: WhiteboardPeerCursor[];
  sendEvent: (event: WhiteboardBroadcastEvent) => void;
  setLocalStatus: (status: WhiteboardPresenceStatus) => void;
  broadcastCursor: (x: number, y: number, surface: WhiteboardSurface) => void;
}

const CURSOR_THROTTLE_MS = 40;
const CURSOR_STALE_MS = 4000;
const PRESENCE_FALLBACK = "#64748b";
const MAX_QUEUE = 80;

/**
 * Supabase Broadcast + Presence channel: whiteboard:{workspaceId}
 */
export function useWhiteboardRealtime({
  workspaceId,
  userId,
  userName = null,
  avatarUrl = null,
  enabled = true,
  getLocalSurface,
  onEvent,
}: UseWhiteboardRealtimeOptions): UseWhiteboardRealtimeResult {
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<WhiteboardPresenceMeta[]>([]);
  const [cursors, setCursors] = useState<WhiteboardPeerCursor[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const getLocalSurfaceRef = useRef(getLocalSurface);
  getLocalSurfaceRef.current = getLocalSurface;

  const statusRef = useRef<WhiteboardPresenceStatus>("viewing");
  const lastCursorSentRef = useRef(0);
  const cursorTimersRef = useRef<Map<string, number>>(new Map());
  const sendQueueRef = useRef<WhiteboardBroadcastEvent[]>([]);

  const userColor = userId ? colorForUserId(userId) : PRESENCE_FALLBACK;

  const syncPeers = useCallback((channel: RealtimeChannel) => {
    const state = channel.presenceState<WhiteboardPresenceMeta>();
    const next: WhiteboardPresenceMeta[] = [];
    for (const metas of Object.values(state)) {
      if (!metas?.length) continue;
      const meta = metas[0];
      if (!meta?.userId) continue;
      next.push(meta);
    }
    setPeers(next);
  }, []);

  const trackPresence = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !userId || channel.state !== "joined") return;

    const payload: WhiteboardPresenceMeta = {
      userId,
      userName: firstName(userName),
      avatarUrl: avatarUrl ?? null,
      color: colorForUserId(userId),
      status: statusRef.current,
      onlineAt: new Date().toISOString(),
    };

    await channel.track(payload);
  }, [avatarUrl, userId, userName]);

  const flushQueue = useCallback(async (channel: RealtimeChannel) => {
    if (channel.state !== "joined") return;
    const queued = sendQueueRef.current;
    sendQueueRef.current = [];
    for (const event of queued) {
      await channel.send({
        type: "broadcast",
        event: WB_EVENT,
        payload: event,
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled || !workspaceId || !userId) {
      setIsConnected(false);
      setPeers([]);
      setCursors([]);
      return;
    }

    const supabase = createClient();
    const channelName = WORKSPACE_WHITEBOARD_CHANNEL(workspaceId);

    const existing = supabase
      .getChannels()
      .find((channel) => channel.topic === `realtime:${channelName}`);
    if (existing) {
      void supabase.removeChannel(existing);
    }

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: userId },
      },
    });

    channel
      .on("broadcast", { event: WB_EVENT }, ({ payload }) => {
        if (!isWhiteboardBroadcastEvent(payload)) return;
        if (
          "workspaceId" in payload &&
          payload.workspaceId &&
          payload.workspaceId !== workspaceId
        ) {
          return;
        }
        if ("userId" in payload && payload.userId === userId) return;

        if (payload.type === "cursor") {
          const cursor = payload as WhiteboardCursorEvent;
          const local =
            getLocalSurfaceRef.current?.() ??
            (isValidSurface(cursor.surface) ? cursor.surface : { w: 1, h: 1 });
          const from = isValidSurface(cursor.surface)
            ? cursor.surface
            : local;
          const mapped = mapPointToSurface(
            { x: cursor.x, y: cursor.y },
            from,
            local
          );

          setCursors((current) => {
            const without = current.filter((c) => c.userId !== cursor.userId);
            return [
              ...without,
              {
                userId: cursor.userId,
                userName: cursor.userName,
                color: cursor.color,
                x: mapped.x,
                y: mapped.y,
                surface: from,
                updatedAt: Date.now(),
              },
            ];
          });

          const prev = cursorTimersRef.current.get(cursor.userId);
          if (prev) window.clearTimeout(prev);
          cursorTimersRef.current.set(
            cursor.userId,
            window.setTimeout(() => {
              setCursors((current) =>
                current.filter((c) => c.userId !== cursor.userId)
              );
              cursorTimersRef.current.delete(cursor.userId);
            }, CURSOR_STALE_MS)
          );
          return;
        }

        onEventRef.current(payload);
      })
      .on("presence", { event: "sync" }, () => {
        syncPeers(channel);
      })
      .on("presence", { event: "join" }, () => {
        syncPeers(channel);
      })
      .on("presence", { event: "leave" }, () => {
        syncPeers(channel);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          channelRef.current = channel;
          setIsConnected(true);
          await trackPresence();
          await flushQueue(channel);
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsConnected(false);
        }
        if (status === "CLOSED") {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      for (const timer of cursorTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      cursorTimersRef.current.clear();
      sendQueueRef.current = [];
      void channel.untrack();
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
      setPeers([]);
      setCursors([]);
    };
  }, [enabled, flushQueue, syncPeers, trackPresence, userId, workspaceId]);

  const sendEvent = useCallback((event: WhiteboardBroadcastEvent) => {
    const channel = channelRef.current;
    if (!channel || channel.state !== "joined") {
      sendQueueRef.current = [...sendQueueRef.current.slice(-(MAX_QUEUE - 1)), event];
      return;
    }
    void channel.send({
      type: "broadcast",
      event: WB_EVENT,
      payload: event,
    });
  }, []);

  const setLocalStatus = useCallback(
    (status: WhiteboardPresenceStatus) => {
      if (statusRef.current === status) return;
      statusRef.current = status;
      void trackPresence();
    },
    [trackPresence]
  );

  const broadcastCursor = useCallback(
    (x: number, y: number, surface: WhiteboardSurface) => {
      if (!userId) return;
      const now = Date.now();
      if (now - lastCursorSentRef.current < CURSOR_THROTTLE_MS) return;
      lastCursorSentRef.current = now;

      const event: WhiteboardCursorEvent = {
        type: "cursor",
        userId,
        workspaceId,
        userName: firstName(userName),
        color: userColor,
        x,
        y,
        surface,
      };
      sendEvent(event);
    },
    [sendEvent, userColor, userId, userName, workspaceId]
  );

  return {
    isConnected,
    peers: peers.filter((p) => p.userId !== userId),
    cursors: cursors.filter((c) => c.userId !== userId),
    sendEvent,
    setLocalStatus,
    broadcastCursor,
  };
}

export function toSegmentEvent(
  partial: Omit<WhiteboardSegmentEvent, "type"> & { tool: "pencil" | "eraser" }
): WhiteboardSegmentEvent {
  return {
    ...partial,
    type: partial.tool === "eraser" ? "erase" : "draw",
  };
}
