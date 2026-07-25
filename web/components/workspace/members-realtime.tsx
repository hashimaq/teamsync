"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceMembersSection } from "@/components/workspace/members-section";
import { useWorkspacePresenceContext } from "@/hooks/use-workspace-presence";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";
import type {
  WorkspaceInvitationWithDetails,
  WorkspaceMemberWithProfile,
} from "@/types";

interface WorkspaceMembersRealtimeProps {
  workspaceId: string;
  currentUserId: string | null;
  initialMembers: WorkspaceMemberWithProfile[];
  pendingInvitations?: WorkspaceInvitationWithDetails[];
  isOwner: boolean;
}

export function WorkspaceMembersRealtime({
  workspaceId,
  currentUserId,
  initialMembers,
  pendingInvitations = [],
  isOwner,
}: WorkspaceMembersRealtimeProps) {
  const router = useRouter();
  const {
    onlineUserIds,
    onlineCount,
    setMemberCount,
    isConnected: presenceConnected,
    error: presenceError,
  } = useWorkspacePresenceContext();

  const handleRemoved = useCallback(() => {
    router.replace("/dashboard");
    router.refresh();
  }, [router]);

  const { members, pendingInvitations: liveInvitations, isConnected, error } =
    useWorkspaceRealtime({
      workspaceId,
      currentUserId,
      initialMembers,
      initialInvitations: pendingInvitations,
      isOwner,
      onRemovedFromWorkspace: handleRemoved,
    });

  useEffect(() => {
    setMemberCount(members.length);
  }, [members.length, setMemberCount]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <WorkspaceMembersSection
          workspaceId={workspaceId}
          members={members}
          pendingInvitations={liveInvitations}
          isOwner={isOwner}
          onlineUserIds={onlineUserIds}
          onlineCount={onlineCount}
        />
      </div>
      {error || presenceError ? (
        <p className="shrink-0 px-4 pb-2 text-xs text-muted-foreground" role="status">
          {error ?? presenceError}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {isConnected && presenceConnected
          ? "Live workspace sync and presence connected"
          : "Connecting to live updates"}
      </p>
    </div>
  );
}
