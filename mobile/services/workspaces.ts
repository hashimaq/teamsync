import { supabase } from "@/lib/supabase";
import type {
  Workspace,
  WorkspaceActivityItem,
  WorkspaceInvitationWithDetails,
  WorkspaceMemberWithProfile,
  WorkspaceWithMeta,
} from "@teamsync/shared";

function mapWorkspaceRow(row: {
  workspaces:
    | (Workspace & {
        tasks?: Array<{ count: number }> | { count: number } | null;
        workspace_members?: Array<{ count: number }> | { count: number } | null;
      })
    | Array<
        Workspace & {
          tasks?: Array<{ count: number }> | { count: number } | null;
          workspace_members?:
            | Array<{ count: number }>
            | { count: number }
            | null;
        }
      >
    | null;
}): WorkspaceWithMeta | null {
  const workspace = Array.isArray(row.workspaces)
    ? row.workspaces[0]
    : row.workspaces;
  if (!workspace) return null;

  const taskCount = Array.isArray(workspace.tasks)
    ? workspace.tasks[0]?.count
    : workspace.tasks?.count;
  const memberCount = Array.isArray(workspace.workspace_members)
    ? workspace.workspace_members[0]?.count
    : workspace.workspace_members?.count;

  return {
    id: workspace.id,
    owner_id: workspace.owner_id,
    name: workspace.name,
    description: workspace.description,
    created_at: workspace.created_at,
    task_count: taskCount ?? 0,
    member_count: memberCount ?? 0,
  };
}

export async function listWorkspaces(userId: string): Promise<WorkspaceWithMeta[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      `
      workspaces (
        id,
        owner_id,
        name,
        description,
        created_at,
        tasks(count),
        workspace_members(count)
      )
    `
    )
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => mapWorkspaceRow(row as never))
    .filter((row): row is WorkspaceWithMeta => Boolean(row))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, owner_id, name, description, created_at")
    .eq("id", workspaceId)
    .single();

  if (error) throw new Error(error.message);
  return data as Workspace;
}

export async function createWorkspace(input: {
  name: string;
  description?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_workspace", {
    p_name: input.name.trim(),
    p_description: input.description?.trim() || null,
  });

  if (!error && data) {
    if (typeof data === "string") return data;
    if (typeof data === "object" && data && "id" in data) {
      return String((data as { id: string }).id);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error(error?.message ?? "Not signed in");

  const { data: created, error: insertError } = await supabase
    .from("workspaces")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);
  return created.id as string;
}

export async function listMembers(
  workspaceId: string
): Promise<WorkspaceMemberWithProfile[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      `
      id,
      workspace_id,
      user_id,
      role,
      created_at,
      profile:profiles!workspace_members_user_id_fkey (
        id,
        full_name,
        avatar_url,
        email
      )
    `
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
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
    } as WorkspaceMemberWithProfile;
  });
}

export async function listPendingInvitations(
  userId: string
): Promise<WorkspaceInvitationWithDetails[]> {
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
      workspace:workspaces!workspace_invitations_workspace_id_fkey (
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
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const workspace = Array.isArray(row.workspace)
      ? row.workspace[0]
      : row.workspace;
    const inviter = Array.isArray(row.inviter) ? row.inviter[0] : row.inviter;
    return {
      ...row,
      workspace: workspace ?? null,
      inviter: inviter
        ? {
            id: inviter.id,
            full_name: inviter.full_name,
            avatar_url: inviter.avatar_url,
            email: inviter.email ?? null,
          }
        : null,
    } as WorkspaceInvitationWithDetails;
  });
}

export async function acceptInvitation(invitationId: string) {
  const { error } = await supabase.rpc("accept_workspace_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) throw new Error(error.message);
}

export async function declineInvitation(invitationId: string) {
  const { error } = await supabase.rpc("decline_workspace_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) throw new Error(error.message);
}

export async function inviteMember(workspaceId: string, email: string) {
  const { error } = await supabase.rpc("invite_workspace_member", {
    p_workspace_id: workspaceId,
    p_email: email.trim().toLowerCase(),
  });
  if (error) throw new Error(error.message);
}

export async function leaveWorkspace(workspaceId: string) {
  const { error } = await supabase.rpc("leave_workspace", {
    p_workspace_id: workspaceId,
  });
  if (error) throw new Error(error.message);
}

export async function updateWorkspace(
  workspaceId: string,
  input: { name: string; description?: string | null }
) {
  const { error } = await supabase
    .from("workspaces")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
    })
    .eq("id", workspaceId);

  if (error) throw new Error(error.message);
}

export async function listActivity(
  workspaceId: string
): Promise<WorkspaceActivityItem[]> {
  const { data, error } = await supabase
    .from("workspace_activity")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) throw new Error(error.message);
  return (data ?? []) as WorkspaceActivityItem[];
}

export async function getWhiteboardStatus(workspaceId: string) {
  const { data, error } = await supabase
    .from("whiteboards")
    .select("id, updated_at, created_by")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as { id: string; updated_at: string; created_by: string } | null;
}
