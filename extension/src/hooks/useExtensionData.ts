import { useCallback, useEffect, useState } from "react";
import type {
  ExtensionDashboardStats,
  Profile,
  Task,
  WorkspaceWithMeta,
} from "@teamsync/shared";
import { getSupabase, getSession, signInWithPassword, signOut } from "@/lib/supabase";
import {
  clearBadgeField,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
} from "@/lib/storage";

export interface ExtensionUser {
  id: string;
  email: string | null;
  profile: Profile | null;
}

export function useExtensionSession() {
  const [user, setUser] = useState<ExtensionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getSession();
      if (!session?.user) {
        setUser(null);
        return;
      }
      const supabase = getSupabase();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email, created_at")
        .eq("id", session.user.id)
        .maybeSingle();

      setUser({
        id: session.user.id,
        email: session.user.email ?? null,
        profile: (profile as Profile | null) ?? null,
      });
      await chrome.runtime.sendMessage({ type: "EXT_START_REALTIME" }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const result = await signInWithPassword(email, password);
      if (result.error) {
        setError(result.error);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await signOut();
    await chrome.runtime.sendMessage({ type: "EXT_STOP_REALTIME" }).catch(() => undefined);
    setUser(null);
  }, []);

  return { user, loading, error, login, logout, refresh };
}

export function useWorkspaces(userId: string | null) {
  const [workspaces, setWorkspaces] = useState<WorkspaceWithMeta[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setWorkspaces([]);
      setWorkspaceId(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      const supabase = getSupabase();
      const active = await getActiveWorkspaceId();

      const { data: memberRows } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId);

      const ids = (memberRows ?? []).map((row) => row.workspace_id as string);
      if (ids.length === 0) {
        if (!cancelled) {
          setWorkspaces([]);
          setWorkspaceId(null);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from("workspaces")
        .select("id, owner_id, name, description, created_at")
        .in("id", ids)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      const list = (data ?? []) as WorkspaceWithMeta[];
      setWorkspaces(list);
      const preferred =
        (active && list.some((w) => w.id === active) ? active : list[0]?.id) ??
        null;
      setWorkspaceId(preferred);
      if (preferred) await setActiveWorkspaceId(preferred);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const selectWorkspace = useCallback(async (id: string) => {
    setWorkspaceId(id);
    await setActiveWorkspaceId(id);
    await chrome.runtime
      .sendMessage({ type: "EXT_WORKSPACE_CHANGED" })
      .catch(() => undefined);
  }, []);

  return { workspaces, workspaceId, loading, selectWorkspace };
}

export function useDashboardData(
  userId: string | null,
  workspaceId: string | null
) {
  const [stats, setStats] = useState<ExtensionDashboardStats>({
    unreadMessages: 0,
    pendingTasks: 0,
    unreadNotifications: 0,
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setStats({ unreadMessages: 0, pendingTasks: 0, unreadNotifications: 0 });
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();

      const [{ count: notifCount }, { data: taskRows }] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId)
          .eq("is_read", false),
        workspaceId
          ? supabase
              .from("tasks")
              .select("*")
              .eq("workspace_id", workspaceId)
              .eq("assignee_id", userId)
              .neq("status", "done")
              .order("updated_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] as Task[] }),
      ]);

      // Unread messages approximate: unread badge storage + open queries are limited;
      // use notifications + assigned open tasks as primary dashboard metrics.
      const assigned = (taskRows ?? []) as Task[];
      const stored = await chrome.storage.local.get([
        "teamsync.unreadMessages",
        "teamsync.unreadNotifications",
      ]);

      setTasks(assigned);
      setStats({
        unreadMessages: Number(stored["teamsync.unreadMessages"] ?? 0) || 0,
        pendingTasks: assigned.length,
        unreadNotifications:
          typeof notifCount === "number"
            ? notifCount
            : Number(stored["teamsync.unreadNotifications"] ?? 0) || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [userId, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onMessage = (message: { type?: string }) => {
      if (message?.type === "EXT_REFRESH") void refresh();
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [refresh]);

  const createTask = useCallback(
    async (title: string) => {
      if (!userId || !workspaceId || !title.trim()) return false;
      const supabase = getSupabase();
      const { error: insertError } = await supabase.from("tasks").insert({
        workspace_id: workspaceId,
        title: title.trim(),
        description: null,
        priority: "medium",
        status: "todo",
        due_date: null,
        created_by: userId,
        assignee_id: userId,
        updated_by: userId,
      });
      if (insertError) {
        setError(insertError.message);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh, userId, workspaceId]
  );

  const completeTask = useCallback(
    async (taskId: string) => {
      if (!userId) return false;
      const supabase = getSupabase();
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ status: "done", updated_by: userId })
        .eq("id", taskId);
      if (updateError) {
        setError(updateError.message);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh, userId]
  );

  const clearMessageBadge = useCallback(async () => {
    await clearBadgeField("messages");
    await refresh();
  }, [refresh]);

  const clearNotificationBadge = useCallback(async () => {
    await clearBadgeField("notifications");
    const supabase = getSupabase();
    if (userId) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", userId)
        .eq("is_read", false);
    }
    await refresh();
  }, [refresh, userId]);

  return {
    stats,
    tasks,
    loading,
    error,
    refresh,
    createTask,
    completeTask,
    clearMessageBadge,
    clearNotificationBadge,
  };
}
