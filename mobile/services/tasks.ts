import { supabase } from "@/lib/supabase";
import type { Task, TaskPriority, TaskStatus } from "@teamsync/shared";

export async function listTasks(workspaceId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Task[];
}

export async function createTask(input: {
  workspace_id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string | null;
  assignee_id?: string | null;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: input.workspace_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      priority: input.priority,
      status: input.status,
      due_date: input.due_date || null,
      assignee_id: input.assignee_id || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Task;
}

export async function updateTask(
  taskId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    due_date: string | null;
    assignee_id: string | null;
  }>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("tasks")
    .update({ ...patch, updated_by: user.id })
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Task;
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
}
