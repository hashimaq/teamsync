"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { getMyPendingInvitations } from "@/actions/members";
import { createClient } from "@/lib/supabase/client";
import { MY_INVITATIONS_CHANNEL } from "@/lib/realtime/broadcast";
import type { WorkspaceInvitationRealtimePayload } from "@/lib/realtime/messages";
import type { WorkspaceInvitationWithDetails } from "@/types";

interface UseInvitationRealtimeOptions {
  userId: string | null;
  initialInvitations: WorkspaceInvitationWithDetails[];
  enabled?: boolean;
}

interface UseInvitationRealtimeResult {
  invitations: WorkspaceInvitationWithDetails[];
  setInvitations: Dispatch<SetStateAction<WorkspaceInvitationWithDetails[]>>;
  isConnected: boolean;
  error: string | null;
  refreshInvitations: () => Promise<WorkspaceInvitationWithDetails[]>;
  removeInvitationLocally: (invitationId: string) => void;
}

export function useInvitationRealtime({
  userId,
  initialInvitations,
  enabled = true,
}: UseInvitationRealtimeOptions): UseInvitationRealtimeResult {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invitationsRef = useRef(invitations);
  const inFlightRef = useRef<Promise<WorkspaceInvitationWithDetails[]> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    invitationsRef.current = invitations;
  }, [invitations]);

  useEffect(() => {
    setInvitations(initialInvitations);
  }, [initialInvitations]);

  const refreshInvitations = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const request = getMyPendingInvitations()
      .then((next) => {
        setInvitations(next);
        setError(null);
        return next;
      })
      .catch((refreshError: unknown) => {
        const message =
          refreshError instanceof Error
            ? refreshError.message
            : "Failed to refresh invitations";
        setError(message);
        return invitationsRef.current;
      })
      .finally(() => {
        inFlightRef.current = null;
      });

    inFlightRef.current = request;
    return request;
  }, []);

  const removeInvitationLocally = useCallback((invitationId: string) => {
    setInvitations((current) => current.filter((invite) => invite.id !== invitationId));
  }, []);

  useEffect(() => {
    if (!enabled || !userId) return;

    const supabase = createClient();
    const channelName = MY_INVITATIONS_CHANNEL(userId);

    const handleChange = (
      payload: RealtimePostgresChangesPayload<WorkspaceInvitationRealtimePayload>
    ) => {
      const eventType = payload.eventType;
      if (eventType !== "INSERT" && eventType !== "UPDATE" && eventType !== "DELETE") {
        return;
      }

      const nextStatus = (payload.new as WorkspaceInvitationRealtimePayload | null)
        ?.status;
      const invitationId =
        (payload.new as WorkspaceInvitationRealtimePayload | null)?.id ??
        (payload.old as WorkspaceInvitationRealtimePayload | null)?.id;

      // Optimistic local sync for terminal statuses; always refetch for inserts
      if (
        eventType === "UPDATE" &&
        invitationId &&
        nextStatus &&
        nextStatus !== "pending"
      ) {
        removeInvitationLocally(invitationId);
      }

      void refreshInvitations();
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_invitations",
          filter: `invitee_id=eq.${userId}`,
        },
        (payload) => {
          handleChange(
            payload as RealtimePostgresChangesPayload<WorkspaceInvitationRealtimePayload>
          );
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
  }, [enabled, refreshInvitations, removeInvitationLocally, userId]);

  return {
    invitations,
    setInvitations,
    isConnected,
    error,
    refreshInvitations,
    removeInvitationLocally,
  };
}

/** Alias matching the requested hook naming. */
export const useMyInvitationsRealtime = useInvitationRealtime;
