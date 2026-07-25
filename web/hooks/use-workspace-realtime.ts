"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  getWorkspaceMembers,
  getWorkspacePendingInvitations,
} from "@/actions/members";
import { createClient } from "@/lib/supabase/client";
import {
  MEMBER_LEFT_EVENT,
  WORKSPACE_SYNC_CHANNEL,
} from "@/lib/realtime/broadcast";
import { consumeLeavingWorkspace } from "@/lib/realtime/leave-intent";
import {
  buildInvitationRealtimeToast,
  buildMemberRealtimeToast,
  memberLeftToast,
  type MemberLeftBroadcast,
  type WorkspaceInvitationRealtimePayload,
  type WorkspaceMemberRealtimePayload,
} from "@/lib/realtime/messages";
import { shouldShowRealtimeToast } from "@/lib/realtime/toast-dedupe";
import type {
  WorkspaceInvitationWithDetails,
  WorkspaceMemberWithProfile,
} from "@/types";

interface UseWorkspaceRealtimeOptions {
  workspaceId: string;
  currentUserId: string | null;
  initialMembers: WorkspaceMemberWithProfile[];
  initialInvitations?: WorkspaceInvitationWithDetails[];
  isOwner: boolean;
  enabled?: boolean;
  onRemovedFromWorkspace?: () => void;
}

interface UseWorkspaceRealtimeResult {
  members: WorkspaceMemberWithProfile[];
  pendingInvitations: WorkspaceInvitationWithDetails[];
  isConnected: boolean;
  error: string | null;
  refreshMembers: () => Promise<WorkspaceMemberWithProfile[]>;
  refreshInvitations: () => Promise<WorkspaceInvitationWithDetails[]>;
}

export function useWorkspaceRealtime({
  workspaceId,
  currentUserId,
  initialMembers,
  initialInvitations = [],
  isOwner,
  enabled = true,
  onRemovedFromWorkspace,
}: UseWorkspaceRealtimeOptions): UseWorkspaceRealtimeResult {
  const [members, setMembers] = useState(initialMembers);
  const [pendingInvitations, setPendingInvitations] = useState(initialInvitations);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const membersRef = useRef(members);
  const invitationsRef = useRef(pendingInvitations);
  const leftUserIdsRef = useRef(new Set<string>());
  const membersInFlightRef = useRef<Promise<WorkspaceMemberWithProfile[]> | null>(null);
  const invitesInFlightRef = useRef<Promise<WorkspaceInvitationWithDetails[]> | null>(
    null
  );
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onRemovedRef = useRef(onRemovedFromWorkspace);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    invitationsRef.current = pendingInvitations;
  }, [pendingInvitations]);

  useEffect(() => {
    onRemovedRef.current = onRemovedFromWorkspace;
  }, [onRemovedFromWorkspace]);

  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  useEffect(() => {
    setPendingInvitations(initialInvitations);
  }, [initialInvitations]);

  const refreshMembers = useCallback(async () => {
    if (membersInFlightRef.current) return membersInFlightRef.current;

    const request = getWorkspaceMembers(workspaceId)
      .then((next) => {
        setMembers(next);
        return next;
      })
      .catch(() => membersRef.current)
      .finally(() => {
        membersInFlightRef.current = null;
      });

    membersInFlightRef.current = request;
    return request;
  }, [workspaceId]);

  const refreshInvitations = useCallback(async () => {
    if (!isOwner) {
      setPendingInvitations([]);
      return [];
    }

    if (invitesInFlightRef.current) return invitesInFlightRef.current;

    const request = getWorkspacePendingInvitations(workspaceId)
      .then((next) => {
        setPendingInvitations(next);
        return next;
      })
      .catch(() => invitationsRef.current)
      .finally(() => {
        invitesInFlightRef.current = null;
      });

    invitesInFlightRef.current = request;
    return request;
  }, [isOwner, workspaceId]);

  useEffect(() => {
    if (!enabled || !workspaceId) return;

    const supabase = createClient();
    const channelName = WORKSPACE_SYNC_CHANNEL(workspaceId);

    const handleMemberChange = async (
      payload: RealtimePostgresChangesPayload<WorkspaceMemberRealtimePayload>
    ) => {
      const eventType = payload.eventType;
      if (eventType !== "INSERT" && eventType !== "UPDATE" && eventType !== "DELETE") {
        return;
      }

      const previousMembers = membersRef.current;
      const nextMembers = await refreshMembers();

      const removedUserId =
        eventType === "DELETE"
          ? (payload.old as WorkspaceMemberRealtimePayload | null)?.user_id
          : undefined;

      if (
        eventType === "DELETE" &&
        removedUserId &&
        currentUserId &&
        removedUserId === currentUserId
      ) {
        const leftVoluntarily = consumeLeavingWorkspace(workspaceId);
        if (!leftVoluntarily) {
          const toastKey = `member:removed-self:${workspaceId}:${removedUserId}`;
          if (shouldShowRealtimeToast(toastKey)) {
            const message = buildMemberRealtimeToast({
              eventType,
              previousMembers,
              nextMembers,
              payload: {
                new: payload.new as WorkspaceMemberRealtimePayload | null,
                old: payload.old as WorkspaceMemberRealtimePayload | null,
              },
              currentUserId,
              leftUserIds: leftUserIdsRef.current,
            });
            if (message) toast.message(message);
          }
        }
        onRemovedRef.current?.();
        return;
      }

      // Leave vs remove: wait briefly for a member_left broadcast before toasting removal
      if (eventType === "DELETE" && removedUserId) {
        const dedupeId =
          (payload.old as WorkspaceMemberRealtimePayload | null)?.id ?? removedUserId;
        window.setTimeout(() => {
          if (leftUserIdsRef.current.has(removedUserId)) {
            return;
          }

          const toastKey = `member:DELETE:${workspaceId}:${dedupeId}`;
          if (!shouldShowRealtimeToast(toastKey)) return;

          const message = buildMemberRealtimeToast({
            eventType: "DELETE",
            previousMembers,
            nextMembers,
            payload: {
              new: null,
              old: payload.old as WorkspaceMemberRealtimePayload | null,
            },
            currentUserId,
            leftUserIds: leftUserIdsRef.current,
          });

          if (message) toast.message(message);
        }, 450);
        return;
      }

      const dedupeId =
        (payload.new as WorkspaceMemberRealtimePayload | null)?.id ??
        (payload.old as WorkspaceMemberRealtimePayload | null)?.id ??
        "unknown";
      const toastKey = `member:${eventType}:${workspaceId}:${dedupeId}:${
        (payload.new as WorkspaceMemberRealtimePayload | null)?.role ??
        (payload.old as WorkspaceMemberRealtimePayload | null)?.role ??
        ""
      }`;

      if (!shouldShowRealtimeToast(toastKey)) return;

      const message = buildMemberRealtimeToast({
        eventType,
        previousMembers,
        nextMembers,
        payload: {
          new: payload.new as WorkspaceMemberRealtimePayload | null,
          old: payload.old as WorkspaceMemberRealtimePayload | null,
        },
        currentUserId,
        leftUserIds: leftUserIdsRef.current,
      });

      if (message) toast.message(message);
    };

    const handleInvitationChange = async (
      payload: RealtimePostgresChangesPayload<WorkspaceInvitationRealtimePayload>
    ) => {
      const eventType = payload.eventType;
      if (eventType !== "INSERT" && eventType !== "UPDATE" && eventType !== "DELETE") {
        return;
      }

      const previousInvitations = invitationsRef.current;
      await refreshInvitations();

      if (!isOwner) return;

      const invitationId =
        (payload.new as WorkspaceInvitationRealtimePayload | null)?.id ??
        (payload.old as WorkspaceInvitationRealtimePayload | null)?.id ??
        "unknown";
      const status =
        (payload.new as WorkspaceInvitationRealtimePayload | null)?.status ?? "";
      const toastKey = `invite:${eventType}:${workspaceId}:${invitationId}:${status}`;

      if (!shouldShowRealtimeToast(toastKey)) return;

      const message = buildInvitationRealtimeToast({
        eventType,
        previousInvitations,
        payload: {
          new: payload.new as WorkspaceInvitationRealtimePayload | null,
          old: payload.old as WorkspaceInvitationRealtimePayload | null,
        },
        isOwnerView: true,
      });

      if (message) toast.message(message);
    };

    const handleMemberLeftBroadcast = (payload: { payload?: MemberLeftBroadcast }) => {
      const data = payload.payload;
      if (!data?.user_id) return;

      leftUserIdsRef.current.add(data.user_id);
      window.setTimeout(() => {
        leftUserIdsRef.current.delete(data.user_id);
      }, 8_000);

      const toastKey = `member:left:${workspaceId}:${data.user_id}`;
      if (shouldShowRealtimeToast(toastKey)) {
        toast.message(memberLeftToast(data.display_name || "Someone"));
      }

      void refreshMembers();
    };

    const channel = supabase
      .channel(channelName, {
        config: { broadcast: { self: false } },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          void handleMemberChange(
            payload as RealtimePostgresChangesPayload<WorkspaceMemberRealtimePayload>
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_invitations",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          void handleInvitationChange(
            payload as RealtimePostgresChangesPayload<WorkspaceInvitationRealtimePayload>
          );
        }
      )
      .on("broadcast", { event: MEMBER_LEFT_EVENT }, (payload) => {
        handleMemberLeftBroadcast(payload as { payload?: MemberLeftBroadcast });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setError(null);
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsConnected(false);
          setError("Realtime connection interrupted. Reconnecting…");
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
    isOwner,
    refreshInvitations,
    refreshMembers,
    workspaceId,
  ]);

  return {
    members,
    pendingInvitations,
    isConnected,
    error,
    refreshMembers,
    refreshInvitations,
  };
}
