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

export function WorkspaceActivityRealtimeProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const [activity, setActivity] = useState<WorkspaceActivityItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const seenIdsRef = useRef(new Set<string>());

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

  useEffect(() => {
    if (!workspaceId) return;

    const supabase = createClient();
    const channelName = `workspace-activity:${workspaceId}`;

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(channelName)
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
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [workspaceId]);

  const pushLocalActivity = useCallback((message: string) => {
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
  }, [workspaceId]);

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
