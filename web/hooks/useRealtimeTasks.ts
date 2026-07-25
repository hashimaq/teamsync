"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  rememberRealtimeToast,
  shouldShowRealtimeToast,
} from "@/lib/realtime/toast-dedupe";
import {
  buildTaskActivityMessage,
  countTasksByStatus,
  detectTaskUpdateActivity,
  removeTaskById,
  upsertTask,
  WORKSPACE_TASKS_CHANNEL,
  type TaskActivityItem,
  type TaskCounters,
} from "@/lib/realtimeTasks";
import type { Task } from "@/types";

export type TaskMemberLookup = Record<
  string,
  { full_name: string | null; avatar_url: string | null }
>;

interface UseRealtimeTasksOptions {
  workspaceId: string;
  initialTasks: Task[];
  currentUserId: string | null;
  memberLookup?: TaskMemberLookup;
  showToasts?: boolean;
  enabled?: boolean;
}

interface UseRealtimeTasksResult {
  tasks: Task[];
  counters: TaskCounters;
  activity: TaskActivityItem[];
  isConnected: boolean;
  error: string | null;
  upsertLocalTask: (task: Task) => void;
  removeLocalTask: (taskId: string) => void;
  /** Suppress duplicate toasts when the local user just mutated. */
  noteLocalMutation: (taskId: string, event: "insert" | "update" | "delete") => void;
  recordActivity: (
    item: Omit<TaskActivityItem, "id" | "createdAt"> & {
      id?: string;
      createdAt?: string;
    }
  ) => void;
}

function firstName(lookup: TaskMemberLookup, userId: string | null | undefined) {
  if (!userId) return "Someone";
  const name = lookup[userId]?.full_name?.trim();
  if (!name) return "Someone";
  return name.split(/\s+/)[0] ?? name;
}

function statusToastLabel(status: Task["status"]) {
  if (status === "done") return "Done";
  if (status === "in_progress") return "In Progress";
  return "Todo";
}

export function useRealtimeTasks({
  workspaceId,
  initialTasks,
  currentUserId,
  memberLookup = {},
  showToasts = true,
  enabled = true,
}: UseRealtimeTasksOptions): UseRealtimeTasksResult {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activity, setActivity] = useState<TaskActivityItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tasksRef = useRef(tasks);
  const memberLookupRef = useRef(memberLookup);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const seenIdsRef = useRef(new Set(initialTasks.map((task) => task.id)));
  const localMuteRef = useRef(new Map<string, number>());

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    memberLookupRef.current = memberLookup;
  }, [memberLookup]);

  useEffect(() => {
    setTasks(initialTasks);
    seenIdsRef.current = new Set(initialTasks.map((task) => task.id));
  }, [initialTasks, workspaceId]);

  const isLocallyMuted = useCallback((key: string) => {
    const until = localMuteRef.current.get(key);
    if (!until) return false;
    if (until <= Date.now()) {
      localMuteRef.current.delete(key);
      return false;
    }
    return true;
  }, []);

  const noteLocalMutation = useCallback(
    (taskId: string, event: "insert" | "update" | "delete") => {
      const key = `task:${event}:${taskId}`;
      localMuteRef.current.set(key, Date.now() + 5_000);
      rememberRealtimeToast(key, 5_000);
      if (event === "insert") {
        seenIdsRef.current.add(taskId);
      }
      if (event === "delete") {
        seenIdsRef.current.delete(taskId);
      }
    },
    []
  );

  const pushActivity = useCallback(
    (
      item: Omit<TaskActivityItem, "id" | "createdAt"> & {
        id?: string;
        createdAt?: string;
      }
    ) => {
      const entry: TaskActivityItem = {
        id: item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: item.kind,
        message: item.message,
        createdAt: item.createdAt ?? new Date().toISOString(),
        taskId: item.taskId,
      };
      setActivity((current) => [entry, ...current].slice(0, 40));
    },
    []
  );

  const upsertLocalTask = useCallback((task: Task) => {
    seenIdsRef.current.add(task.id);
    setTasks((current) => upsertTask(current, task));
  }, []);

  const removeLocalTask = useCallback((taskId: string) => {
    seenIdsRef.current.delete(taskId);
    setTasks((current) => removeTaskById(current, taskId));
  }, []);

  useEffect(() => {
    if (!enabled || !workspaceId) return;

    const supabase = createClient();
    const channelName = WORKSPACE_TASKS_CHANNEL(workspaceId);

    const existing = supabase
      .getChannels()
      .find((channel) => channel.topic === `realtime:${channelName}`);
    if (existing) {
      void supabase.removeChannel(existing);
    }

    const handleChange = (payload: RealtimePostgresChangesPayload<Task>) => {
      const eventType = payload.eventType;
      if (eventType !== "INSERT" && eventType !== "UPDATE" && eventType !== "DELETE") {
        return;
      }

      const lookup = memberLookupRef.current;

      if (eventType === "INSERT") {
        const row = payload.new as Task;
        if (!row?.id) return;

        const muted = isLocallyMuted(`task:insert:${row.id}`);
        const alreadyKnown = seenIdsRef.current.has(row.id);
        seenIdsRef.current.add(row.id);
        setTasks((current) => upsertTask(current, row));

        if (muted || alreadyKnown) return;

        const actor = firstName(lookup, row.created_by);
        pushActivity({
          kind: "created",
          message: buildTaskActivityMessage({
            kind: "created",
            actorName: actor,
            taskTitle: row.title,
          }),
          taskId: row.id,
        });

        if (
          showToasts &&
          row.created_by !== currentUserId &&
          shouldShowRealtimeToast(`task:insert:${row.id}`)
        ) {
          toast.message(`${actor} created a new task`);
        }
        return;
      }

      if (eventType === "UPDATE") {
        const row = payload.new as Task;
        if (!row?.id) return;

        const previous = tasksRef.current.find((task) => task.id === row.id);
        const muted = isLocallyMuted(`task:update:${row.id}`);
        setTasks((current) => upsertTask(current, row));

        if (muted) return;

        const kind = detectTaskUpdateActivity(previous, row);
        const actorId = row.updated_by ?? null;
        const actor = firstName(lookup, actorId);
        const actorLabel =
          actorId && actorId === currentUserId ? "You" : actor === "Someone" ? "A teammate" : actor;

        pushActivity({
          kind,
          message: buildTaskActivityMessage({
            kind,
            actorName: actorLabel,
            taskTitle: row.title,
            status: row.status,
            priority: row.priority,
            assigneeName: row.assignee_id
              ? firstName(lookup, row.assignee_id)
              : null,
          }),
          taskId: row.id,
        });

        if (!showToasts) return;

        if (
          kind === "status_changed" &&
          shouldShowRealtimeToast(`task:status:${row.id}:${row.status}`)
        ) {
          if (actorId !== currentUserId) {
            toast.message(
              `${actorLabel === "A teammate" ? "A teammate" : actor} moved a task to ${statusToastLabel(row.status)}`
            );
          }
        } else if (
          kind === "assigned" &&
          row.assignee_id &&
          previous?.assignee_id !== row.assignee_id
        ) {
          if (
            row.assignee_id === currentUserId &&
            shouldShowRealtimeToast(`task:assign:${row.id}:${row.assignee_id}`)
          ) {
            toast.message(
              `${actorLabel === "You" ? "A teammate" : actorLabel} assigned you a task`
            );
          } else if (
            actorId !== currentUserId &&
            shouldShowRealtimeToast(`task:assign:${row.id}:${row.assignee_id}`)
          ) {
            toast.message(
              `${actorLabel} assigned a task to ${firstName(lookup, row.assignee_id)}`
            );
          }
        } else if (
          kind === "priority_changed" &&
          actorId !== currentUserId &&
          shouldShowRealtimeToast(`task:priority:${row.id}:${row.priority}`)
        ) {
          toast.message(`${actorLabel} changed a task priority`);
        } else if (
          kind === "updated" &&
          actorId !== currentUserId &&
          shouldShowRealtimeToast(`task:update:${row.id}:${row.updated_at}`)
        ) {
          toast.message(`${actorLabel} updated a task`);
        }
        return;
      }

      // DELETE
      const oldRow = payload.old as Task;
      const taskId = oldRow?.id;
      if (!taskId) return;

      const previous = tasksRef.current.find((task) => task.id === taskId);
      const muted = isLocallyMuted(`task:delete:${taskId}`);
      seenIdsRef.current.delete(taskId);
      setTasks((current) => removeTaskById(current, taskId));

      if (muted) return;

      pushActivity({
        kind: "deleted",
        message: buildTaskActivityMessage({
          kind: "deleted",
          actorName: "A teammate",
          taskTitle: previous?.title ?? oldRow.title,
        }),
        taskId,
      });

      if (showToasts && shouldShowRealtimeToast(`task:delete:${taskId}`)) {
        toast.message("A teammate deleted a task");
      }
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          handleChange(payload as RealtimePostgresChangesPayload<Task>);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setError(null);
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsConnected(false);
          setError("Task board reconnecting…");
          return;
        }
        if (status === "CLOSED") {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      setIsConnected(false);
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    currentUserId,
    enabled,
    isLocallyMuted,
    pushActivity,
    showToasts,
    workspaceId,
  ]);

  const counters = useMemo(() => countTasksByStatus(tasks), [tasks]);

  return {
    tasks,
    counters,
    activity,
    isConnected,
    error,
    upsertLocalTask,
    removeLocalTask,
    noteLocalMutation,
    recordActivity: pushActivity,
  };
}
