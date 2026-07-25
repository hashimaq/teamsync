"use client";

import { PendingInvitations } from "@/components/workspace/pending-invitations";
import { useInvitationRealtime } from "@/hooks/use-invitation-realtime";
import type { WorkspaceInvitationWithDetails } from "@/types";

interface PendingInvitationsRealtimeProps {
  userId: string | null;
  initialInvitations: WorkspaceInvitationWithDetails[];
}

export function PendingInvitationsRealtime({
  userId,
  initialInvitations,
}: PendingInvitationsRealtimeProps) {
  const { invitations, removeInvitationLocally, isConnected, error } =
    useInvitationRealtime({
      userId,
      initialInvitations,
    });

  return (
    <div className="space-y-2">
      <PendingInvitations
        invitations={invitations}
        onInvitationResolved={removeInvitationLocally}
      />
      {error ? (
        <p className="text-xs text-muted-foreground" role="status">
          {error}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {isConnected
          ? "Live invitation updates connected"
          : "Connecting to invitation updates"}
      </p>
    </div>
  );
}
