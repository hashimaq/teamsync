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
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeLifecycle } from "@/hooks/use-realtime-lifecycle";

export type WorkspaceActivityItem = {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  event_type: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

interface WorkspaceActivityContextValue {
  activity: WorkspaceActivityItem[];
  isConnected: boolean;
  pushLocalActivity: (message: string) => void;
}

const WorkspaceActivityContext =
  createContext<WorkspaceActivityContextValue | null>(null);

async function loadInitialActivity(
  workspaceId: string
): Promise<WorkspaceActivityItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspace_activity")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];
  return data as WorkspaceActivityItem[];
}

async function ensureRealtimeAuth() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    await supabase.realtime.setAuth(session.access_token);
  }
  return supabase;
}

export function WorkspaceActivityRealtimeProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const [activity, setActivity] = useState<WorkspaceActivityItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const seenIdsRef = useRef(new Set<string>());
  const isConnectedRef = useRef(false);
  const syncInFlightRef = useRef(false);

  const syncFromServer = useCallback(async () => {
    if (!workspaceId || syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      const rows = await loadInitialActivity(workspaceId);
      const previousSeen = seenIdsRef.current;
      const brandNew = rows.filter((row) => !previousSeen.has(row.id));
      seenIdsRef.current = new Set(rows.map((row) => row.id));
      setActivity((current) => {
        if (brandNew.length === 0 && current.length === rows.length) {
          return current;
        }
        return rows;
      });
    } finally {
      syncInFlightRef.current = false;
    }
  }, [workspaceId]);

  const resumeRealtime = useCallback(() => {
    void (async () => {
      await syncFromServer();
      if (!isConnectedRef.current) {
        setReconnectKey((key) => key + 1);
      }
    })();
  }, [syncFromServer]);

  useEffect(() => {
    let cancelled = false;
    void loadInitialActivity(workspaceId).then((rows) => {
      if (cancelled) return;
      setActivity(rows);
      seenIdsRef.current = new Set(rows.map((row) => row.id));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useRealtimeLifecycle({
    enabled: Boolean(workspaceId),
    onResume: resumeRealtime,
    pollIntervalMs: 12_000,
  });

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;
    let reconnectTimer: number | null = null;

    const setup = async () => {
      const supabase = await ensureRealtimeAuth();
      if (cancelled) return;

      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase
        .channel(`workspace-activity:${workspaceId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "workspace_activity",
            filter: `workspace_id=eq.${workspaceId}`,
          },
          (payload: RealtimePostgresChangesPayload<WorkspaceActivityItem>) => {
            const row = payload.new as WorkspaceActivityItem | null;
            if (!row?.id) return;
            if (seenIdsRef.current.has(row.id)) return;
            seenIdsRef.current.add(row.id);
            setActivity((current) => [row, ...current].slice(0, 40));
          }
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            isConnectedRef.current = true;
            setIsConnected(true);
            void syncFromServer();
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            isConnectedRef.current = false;
            setIsConnected(false);
            if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
            reconnectTimer = window.setTimeout(() => {
              setReconnectKey((key) => key + 1);
            }, 1500);
            return;
          }
          if (status === "CLOSED") {
            isConnectedRef.current = false;
            setIsConnected(false);
          }
        });

      channelRef.current = channel;
    };

    void setup();

    return () => {
      cancelled = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      const supabase = createClient();
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      isConnectedRef.current = false;
      setIsConnected(false);
    };
  }, [workspaceId, reconnectKey, syncFromServer]);

  const pushLocalActivity = useCallback(
    (message: string) => {
      const entry: WorkspaceActivityItem = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        workspace_id: workspaceId,
        actor_id: null,
        event_type: "local",
        message,
        metadata: {},
        created_at: new Date().toISOString(),
      };
      seenIdsRef.current.add(entry.id);
      setActivity((current) => [entry, ...current].slice(0, 40));
    },
    [workspaceId]
  );

  const value = useMemo(
    () => ({ activity, isConnected, pushLocalActivity }),
    [activity, isConnected, pushLocalActivity]
  );

  return (
    <WorkspaceActivityContext.Provider value={value}>
      {children}
    </WorkspaceActivityContext.Provider>
  );
}

export function useWorkspaceActivityFeed() {
  const context = useContext(WorkspaceActivityContext);
  if (!context) {
    throw new Error(
      "useWorkspaceActivityFeed must be used within WorkspaceActivityRealtimeProvider"
    );
  }
  return context;
}

export function useWorkspaceActivityFeedOptional() {
  return useContext(WorkspaceActivityContext);
}
