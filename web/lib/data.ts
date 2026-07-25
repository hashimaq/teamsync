import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Workspace, WorkspaceWithMeta } from "@/types";

export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCachedProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return null;
  return data as Profile | null;
});

type WorkspaceEmbed = Workspace & {
  tasks: Array<{ count: number }> | null;
  workspace_members: Array<{ count: number }> | null;
};

export const getCachedWorkspaces = cache(async (): Promise<WorkspaceWithMeta[]> => {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) return [];

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
        tasks (count),
        workspace_members (count)
      )
    `
    )
    .eq("user_id", user.id);

  if (error || !data) return [];

  const workspaces: WorkspaceWithMeta[] = [];

  for (const row of data) {
    const raw = row.workspaces as WorkspaceEmbed | WorkspaceEmbed[] | null;
    const workspace = Array.isArray(raw) ? raw[0] : raw;
    if (!workspace) continue;

    workspaces.push({
      id: workspace.id,
      owner_id: workspace.owner_id,
      name: workspace.name,
      description: workspace.description,
      created_at: workspace.created_at,
      task_count: workspace.tasks?.[0]?.count ?? 0,
      member_count: workspace.workspace_members?.[0]?.count ?? 0,
    });
  }

  return workspaces.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
});
