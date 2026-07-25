import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { freshChannel } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import * as workspaceService from "@/services/workspaces";

export function useWorkspaces() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.workspaces(userId),
    queryFn: () => workspaceService.listWorkspaces(userId),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (!userId) return;
    const channel = freshChannel(`mobile-workspaces:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspace_members", filter: `user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(userId) });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}

export function useInvitations() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery({
    queryKey: queryKeys.invitations(userId),
    queryFn: () => workspaceService.listPendingInvitations(userId),
    enabled: Boolean(userId),
  });
}

export function useWorkspaceMembers(workspaceId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.members(workspaceId),
    queryFn: () => workspaceService.listMembers(workspaceId),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    if (!workspaceId) return;
    const channel = freshChannel(`mobile-members:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.members(workspaceId),
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, queryClient]);

  return query;
}

export function useWorkspaceActivity(workspaceId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.activity(workspaceId),
    queryFn: () => workspaceService.listActivity(workspaceId),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    if (!workspaceId) return;
    const channel = freshChannel(`mobile-activity:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "workspace_activity",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.activity(workspaceId),
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, queryClient]);

  return query;
}
