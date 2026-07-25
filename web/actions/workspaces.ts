"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/supabase/profile";
import { workspaceSchema } from "@/lib/validations";
import type { ActionResult, Workspace, WorkspaceWithMeta } from "@/types";

export async function getWorkspaces(): Promise<WorkspaceWithMeta[]> {
  const { getCachedWorkspaces } = await import("@/lib/data");
  return getCachedWorkspaces();
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Workspace;
}

export async function createWorkspace(
  formData: FormData
): Promise<ActionResult<Workspace>> {
  const parsed = workspaceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || "",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  // Ensure profile exists first (FK owner_id -> profiles.id)
  await ensureUserProfile(supabase, user);

  const { data, error } = await supabase.rpc("create_workspace", {
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
  });

  if (error) {
    // Fallback if RPC is not installed yet
    const { data: inserted, error: insertError } = await supabase
      .from("workspaces")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description || null,
        owner_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/workspaces");
    return { success: true, data: inserted as Workspace };
  }

  revalidatePath("/dashboard");
  revalidatePath("/workspaces");
  return { success: true, data: data as Workspace };
}

export async function updateWorkspace(
  id: string,
  formData: FormData
): Promise<ActionResult<Workspace>> {
  const parsed = workspaceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || "",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { data: previous } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("workspaces")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  if (previous && previous.name !== parsed.data.name) {
    const { NotificationService } = await import(
      "@/lib/services/notification-service"
    );
    await NotificationService.notifyWorkspaceRenamed({
      workspaceId: id,
      actorId: user.id,
      oldName: previous.name,
      newName: parsed.data.name,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/workspaces");
  revalidatePath(`/workspace/${id}`);
  return { success: true, data: data as Workspace };
}

export async function deleteWorkspace(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/workspaces");
  return { success: true, data: undefined };
}
