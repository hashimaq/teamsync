import type {
  InvitationStatus,
  WorkspaceInvitationWithDetails,
  WorkspaceMemberWithProfile,
  WorkspaceRole,
} from "@/types";

export type WorkspaceMemberRealtimePayload = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at?: string;
};

export type WorkspaceInvitationRealtimePayload = {
  id: string;
  workspace_id: string;
  inviter_id: string;
  invitee_id: string;
  invitee_email: string;
  status: InvitationStatus;
  created_at?: string;
  responded_at?: string | null;
};

export type MemberLeftBroadcast = {
  user_id: string;
  display_name: string;
};

export function getMemberDisplayName(
  member: Pick<WorkspaceMemberWithProfile, "profile"> | null | undefined,
  fallback = "Someone"
): string {
  const name = member?.profile?.full_name?.trim();
  if (name) {
    return name.split(" ")[0] ?? name;
  }

  const email = member?.profile?.email?.trim();
  if (email) {
    return email.split("@")[0] ?? fallback;
  }

  return fallback;
}

export function getInvitationDisplayName(
  invitation: Pick<WorkspaceInvitationWithDetails, "invitee_email" | "inviter" | "invitee">,
  fallback = "Someone"
): string {
  const inviteeName = invitation.invitee?.full_name?.trim();
  if (inviteeName) {
    return inviteeName.split(" ")[0] ?? inviteeName;
  }

  const email = invitation.invitee_email?.trim();
  if (email) {
    const local = email.split("@")[0] ?? fallback;
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  return fallback;
}

export function roleDisplayLabel(role: WorkspaceRole): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

export function memberJoinedToast(name: string): string {
  return `${name} joined the workspace.`;
}

export function memberLeftToast(name: string): string {
  return `${name} left the workspace.`;
}

export function memberRemovedToast(name: string): string {
  return `${name} was removed.`;
}

export function youWereRemovedToast(): string {
  return "You have been removed from this workspace.";
}

export function invitationDeclinedToast(name: string): string {
  return `${name} declined your invitation.`;
}

export function roleChangedToast(name: string, role: WorkspaceRole): string {
  const label = roleDisplayLabel(role);
  const article = label === "Member" ? "a" : "an";
  return `${name} is now ${article} ${label}.`;
}

export function buildMemberRealtimeToast(params: {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  previousMembers: WorkspaceMemberWithProfile[];
  nextMembers: WorkspaceMemberWithProfile[];
  payload: {
    new?: WorkspaceMemberRealtimePayload | null;
    old?: WorkspaceMemberRealtimePayload | null;
  };
  currentUserId?: string | null;
  leftUserIds?: Set<string>;
}): string | null {
  const {
    eventType,
    previousMembers,
    nextMembers,
    payload,
    currentUserId,
    leftUserIds,
  } = params;

  if (eventType === "INSERT" && payload.new) {
    const joined =
      nextMembers.find((member) => member.id === payload.new?.id) ??
      nextMembers.find((member) => member.user_id === payload.new?.user_id);
    return memberJoinedToast(getMemberDisplayName(joined));
  }

  if (eventType === "DELETE") {
    const removedUserId = payload.old?.user_id;
    if (removedUserId && leftUserIds?.has(removedUserId)) {
      return null;
    }

    if (removedUserId && currentUserId && removedUserId === currentUserId) {
      return youWereRemovedToast();
    }

    const removedId = payload.old?.id;
    const removed =
      previousMembers.find((member) => member.id === removedId) ??
      previousMembers.find((member) => member.user_id === removedUserId);
    return memberRemovedToast(getMemberDisplayName(removed));
  }

  if (eventType === "UPDATE" && payload.new) {
    const previous =
      previousMembers.find((member) => member.id === payload.new?.id) ??
      previousMembers.find((member) => member.user_id === payload.new?.user_id);
    const next =
      nextMembers.find((member) => member.id === payload.new?.id) ??
      nextMembers.find((member) => member.user_id === payload.new?.user_id);

    const previousRole = payload.old?.role ?? previous?.role;
    const nextRole = payload.new.role ?? next?.role;

    if (!previousRole || !nextRole || previousRole === nextRole) {
      return null;
    }

    return roleChangedToast(getMemberDisplayName(next ?? previous), nextRole);
  }

  return null;
}

export function buildInvitationRealtimeToast(params: {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  previousInvitations: WorkspaceInvitationWithDetails[];
  payload: {
    new?: WorkspaceInvitationRealtimePayload | null;
    old?: WorkspaceInvitationRealtimePayload | null;
  };
  isOwnerView: boolean;
}): string | null {
  const { eventType, previousInvitations, payload, isOwnerView } = params;

  if (!isOwnerView || eventType !== "UPDATE" || !payload.new) {
    return null;
  }

  if (payload.new.status !== "declined") {
    return null;
  }

  const previous =
    previousInvitations.find((invite) => invite.id === payload.new?.id) ?? null;

  const name = getInvitationDisplayName({
    invitee_email: payload.new.invitee_email ?? previous?.invitee_email ?? "",
    inviter: previous?.inviter ?? null,
    invitee: previous?.invitee ?? null,
  });

  return invitationDeclinedToast(name);
}
