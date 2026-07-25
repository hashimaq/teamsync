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
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  collectOnlineUserIds,
  WORKSPACE_PRESENCE_CHANNEL,
  type WorkspacePresenceMeta,
} from "@/lib/realtime/presence";

interface UseWorkspacePresenceOptions {
  workspaceId: string;
  userId: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  enabled?: boolean;
}

export interface WorkspacePresenceApi {
  onlineUserIds: Set<string>;
  onlineCount: number;
  isOnline: (userId: string) => boolean;
  isConnected: boolean;
  error: string | null;
}

export function useWorkspacePresence({
  workspaceId,
  userId,
  fullName = null,
  avatarUrl = null,
  enabled = true,
}: UseWorkspacePresenceOptions): WorkspacePresenceApi {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !workspaceId || !userId) {
      setOnlineUserIds(new Set());
      setIsConnected(false);
      return;
    }

    const supabase = createClient();
    const channelName = WORKSPACE_PRESENCE_CHANNEL(workspaceId);

    const existing = supabase
      .getChannels()
      .find((channel) => channel.topic === `realtime:${channelName}`);
    if (existing) {
      void supabase.removeChannel(existing);
    }

    const syncPresence = (channel: RealtimeChannel) => {
      const state = channel.presenceState<WorkspacePresenceMeta>();
      setOnlineUserIds(collectOnlineUserIds(state));
    };

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        syncPresence(channel);
      })
      .on("presence", { event: "join" }, () => {
        syncPresence(channel);
      })
      .on("presence", { event: "leave" }, () => {
        syncPresence(channel);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setError(null);

          const meta: WorkspacePresenceMeta = {
            user_id: userId,
            full_name: fullName,
            avatar_url: avatarUrl,
            online_at: new Date().toISOString(),
          };

          await channel.track(meta);
          syncPresence(channel);
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsConnected(false);
          setError("Presence connection interrupted. Reconnecting…");
          return;
        }

        if (status === "CLOSED") {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && channel.state === "joined") {
        void channel.track({
          user_id: userId,
          full_name: fullName,
          avatar_url: avatarUrl,
          online_at: new Date().toISOString(),
        } satisfies WorkspacePresenceMeta);
      }
    };

    const handlePageHide = () => {
      void channel.untrack();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      setIsConnected(false);

      const active = channelRef.current;
      channelRef.current = null;

      if (active) {
        void active.untrack().finally(() => {
          void supabase.removeChannel(active);
        });
      }
    };
  }, [avatarUrl, enabled, fullName, userId, workspaceId]);

  const isOnline = useMemo(() => {
    return (memberUserId: string) => onlineUserIds.has(memberUserId);
  }, [onlineUserIds]);

  return useMemo(
    () => ({
      onlineUserIds,
      onlineCount: onlineUserIds.size,
      isOnline,
      isConnected,
      error,
    }),
    [error, isConnected, isOnline, onlineUserIds]
  );
}

/** Alias matching the requested hook naming. */
export const usePresence = useWorkspacePresence;

interface WorkspacePresenceContextValue extends WorkspacePresenceApi {
  memberCount: number;
  setMemberCount: (count: number) => void;
}

const WorkspacePresenceContext = createContext<WorkspacePresenceContextValue | null>(
  null
);

interface WorkspacePresenceProviderProps {
  workspaceId: string;
  userId: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  initialMemberCount: number;
  children: ReactNode;
}

export function WorkspacePresenceProvider({
  workspaceId,
  userId,
  fullName = null,
  avatarUrl = null,
  initialMemberCount,
  children,
}: WorkspacePresenceProviderProps) {
  const [memberCount, setMemberCountState] = useState(initialMemberCount);
  const presence = useWorkspacePresence({
    workspaceId,
    userId,
    fullName,
    avatarUrl,
    enabled: Boolean(userId),
  });

  useEffect(() => {
    setMemberCountState(initialMemberCount);
  }, [initialMemberCount, workspaceId]);

  const setMemberCount = useCallback((count: number) => {
    setMemberCountState(count);
  }, []);

  const value = useMemo(
    () => ({
      ...presence,
      memberCount,
      setMemberCount,
    }),
    [memberCount, presence, setMemberCount]
  );

  return (
    <WorkspacePresenceContext.Provider value={value}>
      {children}
    </WorkspacePresenceContext.Provider>
  );
}

export function useWorkspacePresenceContext(): WorkspacePresenceContextValue {
  const context = useContext(WorkspacePresenceContext);
  if (!context) {
    throw new Error(
      "useWorkspacePresenceContext must be used within WorkspacePresenceProvider"
    );
  }
  return context;
}

export function useOptionalWorkspacePresence(): WorkspacePresenceContextValue | null {
  return useContext(WorkspacePresenceContext);
}
