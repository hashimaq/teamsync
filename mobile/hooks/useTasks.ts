import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task } from "@teamsync/shared";
import { queryKeys } from "@/lib/query-client";
import { freshChannel } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import * as taskService from "@/services/tasks";

export function useTasks(workspaceId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.tasks(workspaceId),
    queryFn: () => taskService.listTasks(workspaceId),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    if (!workspaceId) return;

    const channel = freshChannel(`workspace-tasks:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          queryClient.setQueryData<Task[]>(
            queryKeys.tasks(workspaceId),
            (current = []) => {
              if (payload.eventType === "DELETE") {
                const oldId = (payload.old as { id?: string }).id;
                return current.filter((task) => task.id !== oldId);
              }
              const row = payload.new as Task;
              const exists = current.some((task) => task.id === row.id);
              if (!exists) return [row, ...current];
              return current.map((task) => (task.id === row.id ? row : task));
            }
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, queryClient]);

  const create = useMutation({
    mutationFn: taskService.createTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks(workspaceId),
      });
    },
  });

  const update = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof taskService.updateTask>[1];
    }) => taskService.updateTask(id, patch),
  });

  const remove = useMutation({
    mutationFn: taskService.deleteTask,
  });

  return { ...query, create, update, remove };
}
