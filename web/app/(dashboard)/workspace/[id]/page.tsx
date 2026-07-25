import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getWorkspaceMessages } from "@/actions/messages";
import { getTasks } from "@/actions/tasks";
import {
  getCurrentWorkspaceRole,
  getWorkspaceMembers,
  getWorkspacePendingInvitations,
} from "@/actions/members";
import { getWorkspace } from "@/actions/workspaces";
import { getCachedProfile, getCachedUser, getCachedWorkspaces } from "@/lib/data";
import { WorkspaceAppShell } from "@/components/workspace/workspace-app-shell";

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: WorkspacePageProps): Promise<Metadata> {
  const { id } = await params;
  const workspace = await getWorkspace(id);
  return {
    title: workspace?.name ?? "Workspace",
  };
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = await params;
  const workspace = await getWorkspace(id);

  if (!workspace) {
    notFound();
  }

  const [tasks, role, user, profile, members, workspaces] = await Promise.all([
    getTasks(workspace.id),
    getCurrentWorkspaceRole(workspace.id),
    getCachedUser(),
    getCachedProfile(),
    getWorkspaceMembers(workspace.id),
    getCachedWorkspaces(),
  ]);

  const isOwner =
    (!!user && workspace.owner_id === user.id) || role === "owner";
  const canLeave = !!user && !!role && role !== "owner";

  const [pendingInvitations, messages] = await Promise.all([
    isOwner ? getWorkspacePendingInvitations(workspace.id) : Promise.resolve([]),
    getWorkspaceMessages(workspace.id),
  ]);

  return (
    <WorkspaceAppShell
      workspace={workspace}
      workspaces={workspaces}
      members={members}
      pendingInvitations={pendingInvitations}
      tasks={tasks}
      messages={messages}
      isOwner={isOwner}
      canLeave={canLeave}
      currentUserId={user?.id ?? null}
      currentUserName={profile?.full_name ?? null}
      currentUserAvatar={profile?.avatar_url ?? null}
    />
  );
}
