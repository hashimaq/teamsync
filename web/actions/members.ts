"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { inviteMemberSchema } from "@/lib/validations";
import type {
  ActionResult,
  WorkspaceInvitation,
  WorkspaceInvitationWithDetails,
  WorkspaceMember,
  WorkspaceMemberWithProfile,
  WorkspaceRole,
} from "@/types";

type MemberRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  profiles:
    | {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        email: string | null;
      }
    | {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        email: string | null;
      }[]
    | null;
};

type InvitationRow = {
  id: string;
  workspace_id: string;
  inviter_id: string;
  invitee_id: string;
  invitee_email: string;
  status: WorkspaceInvitation["status"];
  created_at: string;
  responded_at: string | null;
  workspaces:
    | { id: string; name: string; description: string | null }
    | { id: string; name: string; description: string | null }[]
    | null;
  inviter: MemberRow["profiles"];
  invitee?: MemberRow["profiles"];
};

function mapMemberRow(row: MemberRow): WorkspaceMemberWithProfile {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  return {
    id: row.id,
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    role: row.role,
    created_at: row.created_at,
    profile: profile
      ? {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          email: profile.email ?? null,
        }
      : null,
  };
}

function mapInvitationRow(row: InvitationRow): WorkspaceInvitationWithDetails {
  const workspace = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
  const inviter = Array.isArray(row.inviter) ? row.inviter[0] : row.inviter;

  return {
    id: row.id,
    workspace_id: row.workspace_id,
    inviter_id: row.inviter_id,
    invitee_id: row.invitee_id,
    invitee_email: row.invitee_email,
    status: row.status,
    created_at: row.created_at,
    responded_at: row.responded_at,
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
        }
      : null,
    inviter: inviter
      ? {
          id: inviter.id,
          full_name: inviter.full_name,
          avatar_url: inviter.avatar_url,
          email: inviter.email ?? null,
        }
      : null,
  };
}

async function fetchWorkspaceMemberRows(
  workspaceId: string,
  includeEmail: boolean
) {
  const supabase = await createClient();
  const profileFields = includeEmail
    ? "id, full_name, avatar_url, email"
    : "id, full_name, avatar_url";

  return supabase
    .from("workspace_members")
    .select(
      `
      id,
      workspace_id,
      user_id,
      role,
      created_at,
      profiles (
        ${profileFields}
      )
    `
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
}

export async function getWorkspaceMembers(
  workspaceId: string
): Promise<WorkspaceMemberWithProfile[]> {
  let { data, error } = await fetchWorkspaceMemberRows(workspaceId, true);

  if (error?.message?.includes("email")) {
    const fallback = await fetchWorkspaceMemberRows(workspaceId, false);
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) {
    console.error("Failed to load workspace members:", error?.message);
    return [];
  }

  const members = (data as MemberRow[]).map(mapMemberRow);

  return members.sort((a, b) => {
    if (a.role === "owner" && b.role !== "owner") return -1;
    if (a.role !== "owner" && b.role === "owner") return 1;
    return 0;
  });
}

export async function getMyPendingInvitations(): Promise<
  WorkspaceInvitationWithDetails[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("workspace_invitations")
    .select(
      `
      id,
      workspace_id,
      inviter_id,
      invitee_id,
      invitee_email,
      status,
      created_at,
      responded_at,
      workspaces (
        id,
        name,
        description
      ),
      inviter:profiles!workspace_invitations_inviter_id_fkey (
        id,
        full_name,
        avatar_url,
        email
      )
    `
    )
    .eq("invitee_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) {
    // Table may not exist yet before migration
    if (!error?.message?.includes("Could not find the table")) {
      console.error("Failed to load invitations:", error?.message);
    }
    return [];
  }

  return (data as InvitationRow[]).map(mapInvitationRow);
}

export async function getWorkspacePendingInvitations(
  workspaceId: string
): Promise<WorkspaceInvitationWithDetails[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspace_invitations")
    .select(
      `
      id,
      workspace_id,
      inviter_id,
      invitee_id,
      invitee_email,
      status,
      created_at,
      responded_at,
      workspaces (
        id,
        name,
        description
      ),
      inviter:profiles!workspace_invitations_inviter_id_fkey (
        id,
        full_name,
        avatar_url,
        email
      ),
      invitee:profiles!workspace_invitations_invitee_id_fkey (
        id,
        full_name,
        avatar_url,
        email
      )
    `
    )
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) {
    if (!error?.message?.includes("Could not find the table")) {
      console.error("Failed to load workspace invitations:", error?.message);
    }
    return [];
  }

  return (data as InvitationRow[]).map((row) => {
    const mapped = mapInvitationRow(row);
    const invitee = Array.isArray(row.invitee) ? row.invitee[0] : row.invitee;
    return {
      ...mapped,
      invitee_email: invitee?.email ?? row.invitee_email,
      invitee: invitee
        ? {
            id: invitee.id,
            full_name: invitee.full_name,
            avatar_url: invitee.avatar_url,
            email: invitee.email ?? null,
          }
        : null,
    };
  });
}

export async function inviteWorkspaceMember(
  workspaceId: string,
  formData: FormData
): Promise<ActionResult<WorkspaceInvitation>> {
  const parsed = inviteMemberSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid email address",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { data, error } = await supabase.rpc("invite_workspace_member", {
    p_workspace_id: workspaceId,
    p_email: parsed.data.email.trim().toLowerCase(),
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const invitation = data as WorkspaceInvitation;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  const { NotificationService } = await import(
    "@/lib/services/notification-service"
  );
  await NotificationService.notifyInvitationReceived({
    workspaceId,
    actorId: user.id,
    inviteeId: invitation.invitee_id,
    workspaceName: workspace?.name ?? "a workspace",
    invitationId: invitation.id,
  });

  revalidatePath(`/workspace/${workspaceId}`);
  revalidatePath("/dashboard");
  revalidatePath("/workspaces");

  return { success: true, data: invitation };
}

export async function acceptWorkspaceInvitation(
  invitationId: string
): Promise<ActionResult<WorkspaceMember>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { data: invitationRow } = await supabase
    .from("workspace_invitations")
    .select("id, workspace_id, inviter_id, invitee_id, status")
    .eq("id", invitationId)
    .maybeSingle();

  const { data, error } = await supabase.rpc("accept_workspace_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const member = data as WorkspaceMember;
  const workspaceId = member?.workspace_id ?? invitationRow?.workspace_id;

  if (workspaceId && user) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .maybeSingle();

    const { NotificationService } = await import(
      "@/lib/services/notification-service"
    );
    await NotificationService.notifyInvitationAccepted({
      workspaceId,
      actorId: user.id,
      inviterId: (invitationRow?.inviter_id as string) ?? user.id,
      workspaceName: workspace?.name ?? "the workspace",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/workspaces");
  if (workspaceId) {
    revalidatePath(`/workspace/${workspaceId}`);
  }

  return { success: true, data: member };
}

export async function declineWorkspaceInvitation(
  invitationId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { error } = await supabase.rpc("decline_workspace_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/workspaces");

  return { success: true, data: undefined };
}

export async function cancelWorkspaceInvitation(
  invitationId: string,
  workspaceId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { error } = await supabase.rpc("cancel_workspace_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/workspace/${workspaceId}`);
  revalidatePath("/dashboard");

  return { success: true, data: undefined };
}

export async function removeWorkspaceMember(
  workspaceId: string,
  memberId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return { success: false, error: "Workspace not found" };
  }

  if (workspace.owner_id !== user.id) {
    return {
      success: false,
      error: "Only the workspace owner can remove members",
    };
  }

  const { data: targetMember } = await supabase
    .from("workspace_members")
    .select("id, user_id")
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const { error } = await supabase.rpc("remove_workspace_member", {
    p_workspace_id: workspaceId,
    p_member_id: memberId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (targetMember?.user_id) {
    const { data: workspaceRow } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .maybeSingle();

    const { NotificationService } = await import(
      "@/lib/services/notification-service"
    );
    await NotificationService.notifyMemberRemoved({
      workspaceId,
      actorId: user.id,
      removedUserId: targetMember.user_id as string,
      workspaceName: workspaceRow?.name ?? "the workspace",
    });
  }

  revalidatePath(`/workspace/${workspaceId}`);
  revalidatePath("/dashboard");
  revalidatePath("/workspaces");

  return { success: true, data: undefined };
}

export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  role: "admin" | "member"
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("owner_id, name")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return { success: false, error: "Workspace not found" };
  }

  if (workspace.owner_id !== user.id) {
    return {
      success: false,
      error: "Only the workspace owner can change roles",
    };
  }

  const { data: targetMember } = await supabase
    .from("workspace_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!targetMember) {
    return { success: false, error: "Member not found" };
  }

  if (targetMember.role === "owner" || targetMember.user_id === workspace.owner_id) {
    return { success: false, error: "Cannot change the owner role" };
  }

  if (targetMember.role === role) {
    return { success: true, data: undefined };
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("id", memberId)
    .eq("workspace_id", workspaceId);

  if (error) {
    return { success: false, error: error.message };
  }

  const { NotificationService } = await import(
    "@/lib/services/notification-service"
  );
  await NotificationService.notifyRoleChanged({
    workspaceId,
    actorId: user.id,
    targetUserId: targetMember.user_id as string,
    role,
    workspaceName: workspace.name as string,
  });

  revalidatePath(`/workspace/${workspaceId}`);
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

export async function leaveWorkspace(workspaceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { error } = await supabase.rpc("leave_workspace", {
    p_workspace_id: workspaceId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/workspace/${workspaceId}`);
  revalidatePath("/dashboard");
  revalidatePath("/workspaces");

  return { success: true, data: undefined };
}

export async function getCurrentWorkspaceRole(
  workspaceId: string
): Promise<WorkspaceRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data.role as WorkspaceRole;
}
