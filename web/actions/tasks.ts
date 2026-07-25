"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { taskSchema } from "@/lib/validations";
import type { ActionResult, Task, TaskStatus } from "@/types";

function mapTask(row: Task): Task {
  return {
    ...row,
    assignee_id: row.assignee_id ?? null,
    updated_by: row.updated_by ?? null,
  };
}

async function notifyTaskEvent(
  kind:
    | "assigned"
    | "created"
    | "completed"
    | "updated"
    | "deleted",
  params: {
    workspaceId: string;
    actorId: string;
    taskId: string;
    taskTitle: string;
    assigneeId?: string | null;
    createdBy?: string | null;
  }
) {
  const { NotificationService } = await import(
    "@/lib/services/notification-service"
  );

  switch (kind) {
    case "assigned":
      return NotificationService.notifyTaskAssigned({
        workspaceId: params.workspaceId,
        actorId: params.actorId,
        taskId: params.taskId,
        taskTitle: params.taskTitle,
        assigneeId: params.assigneeId ?? null,
      });
    case "created":
      return NotificationService.notifyTaskCreated({
        workspaceId: params.workspaceId,
        actorId: params.actorId,
        taskId: params.taskId,
        taskTitle: params.taskTitle,
      });
    case "completed":
      return NotificationService.notifyTaskCompleted({
        workspaceId: params.workspaceId,
        actorId: params.actorId,
        taskId: params.taskId,
        taskTitle: params.taskTitle,
        createdBy: params.createdBy,
        assigneeId: params.assigneeId,
      });
    case "updated":
      return NotificationService.notifyTaskUpdated({
        workspaceId: params.workspaceId,
        actorId: params.actorId,
        taskId: params.taskId,
        taskTitle: params.taskTitle,
      });
    case "deleted":
      return NotificationService.notifyTaskDeleted({
        workspaceId: params.workspaceId,
        actorId: params.actorId,
        taskId: params.taskId,
        taskTitle: params.taskTitle,
      });
  }
}

export async function getTasks(workspaceId: string): Promise<Task[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as Task[]).map(mapTask);
}

export async function getTask(id: string): Promise<Task | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return mapTask(data as Task);
}

export async function createTask(
  workspaceId: string,
  formData: FormData
): Promise<ActionResult<Task>> {
  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    priority: formData.get("priority"),
    status: formData.get("status"),
    due_date: formData.get("due_date") || "",
    assignee_id: formData.get("assignee_id") || "",
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

  const assigneeId = parsed.data.assignee_id || null;

  const insertPayload = {
    workspace_id: workspaceId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    priority: parsed.data.priority,
    status: parsed.data.status,
    due_date: parsed.data.due_date || null,
    created_by: user.id,
    assignee_id: assigneeId,
    updated_by: user.id,
  };

  let { data, error } = await supabase
    .from("tasks")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    const { data: fallback, error: fallbackError } = await supabase
      .from("tasks")
      .insert({
        workspace_id: workspaceId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        priority: parsed.data.priority,
        status: parsed.data.status,
        due_date: parsed.data.due_date || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (fallbackError || !fallback) {
      return { success: false, error: fallbackError?.message ?? error.message };
    }

    data = fallback;
    error = null;
  }

  if (!data) {
    return { success: false, error: "Failed to create task" };
  }

  const task = mapTask(data as Task);

  if (assigneeId) {
    await notifyTaskEvent("assigned", {
      workspaceId,
      actorId: user.id,
      taskId: task.id,
      taskTitle: task.title,
      assigneeId,
    });
  } else {
    await notifyTaskEvent("created", {
      workspaceId,
      actorId: user.id,
      taskId: task.id,
      taskTitle: task.title,
    });
  }

  if (task.status === "done") {
    await notifyTaskEvent("completed", {
      workspaceId,
      actorId: user.id,
      taskId: task.id,
      taskTitle: task.title,
      createdBy: task.created_by,
      assigneeId: task.assignee_id,
    });
  }

  revalidatePath(`/workspace/${workspaceId}`);
  revalidatePath("/dashboard");
  return { success: true, data: task };
}

export async function updateTask(
  id: string,
  workspaceId: string,
  formData: FormData
): Promise<ActionResult<Task>> {
  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    priority: formData.get("priority"),
    status: formData.get("status"),
    due_date: formData.get("due_date") || "",
    assignee_id: formData.get("assignee_id") || "",
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
    .from("tasks")
    .select("assignee_id, title, status, priority, description, due_date")
    .eq("id", id)
    .maybeSingle();

  const assigneeId = parsed.data.assignee_id || null;

  let { data, error } = await supabase
    .from("tasks")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      status: parsed.data.status,
      due_date: parsed.data.due_date || null,
      assignee_id: assigneeId,
      updated_by: user.id,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const { data: fallback, error: fallbackError } = await supabase
      .from("tasks")
      .update({
        title: parsed.data.title,
        description: parsed.data.description || null,
        priority: parsed.data.priority,
        status: parsed.data.status,
        due_date: parsed.data.due_date || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (fallbackError || !fallback) {
      return { success: false, error: fallbackError?.message ?? error.message };
    }

    data = fallback;
    error = null;
  }

  if (!data) {
    return { success: false, error: "Failed to update task" };
  }

  const task = mapTask(data as Task);
  const previousAssignee = (previous?.assignee_id as string | null) ?? null;
  const previousStatus = (previous?.status as TaskStatus | undefined) ?? undefined;
  const assigneeChanged = (assigneeId ?? null) !== previousAssignee;
  const completedNow = previousStatus !== task.status && task.status === "done";
  const otherFieldsChanged = Boolean(
    previous &&
      (previous.title !== task.title ||
        previous.priority !== task.priority ||
        previous.status !== task.status ||
        (previous.description ?? null) !== (task.description ?? null) ||
        (previous.due_date ?? null) !== (task.due_date ?? null))
  );

  if (assigneeChanged) {
    await notifyTaskEvent("assigned", {
      workspaceId,
      actorId: user.id,
      taskId: task.id,
      taskTitle: task.title,
      assigneeId,
    });
  }

  if (completedNow) {
    await notifyTaskEvent("completed", {
      workspaceId,
      actorId: user.id,
      taskId: task.id,
      taskTitle: task.title,
      createdBy: task.created_by,
      assigneeId: task.assignee_id,
    });
  } else if (otherFieldsChanged && !assigneeChanged) {
    await notifyTaskEvent("updated", {
      workspaceId,
      actorId: user.id,
      taskId: task.id,
      taskTitle: task.title,
    });
  }

  revalidatePath(`/workspace/${workspaceId}`);
  revalidatePath("/dashboard");
  return { success: true, data: task };
}

export async function updateTaskStatus(
  id: string,
  workspaceId: string,
  status: TaskStatus
): Promise<ActionResult<Task>> {
  const formData = new FormData();
  const existing = await getTask(id);
  if (!existing) {
    return { success: false, error: "Task not found" };
  }

  formData.set("title", existing.title);
  formData.set("description", existing.description ?? "");
  formData.set("priority", existing.priority);
  formData.set("status", status);
  formData.set("due_date", existing.due_date ?? "");
  formData.set("assignee_id", existing.assignee_id ?? "");
  return updateTask(id, workspaceId, formData);
}

export async function deleteTask(
  id: string,
  workspaceId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { data: existing } = await supabase
    .from("tasks")
    .select("id, title, created_by")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return { success: false, error: "Task not found" };
  }

  if (existing.created_by !== user.id) {
    return {
      success: false,
      error: "Only the person who created this task can delete it",
    };
  }

  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  await notifyTaskEvent("deleted", {
    workspaceId,
    actorId: user.id,
    taskId: existing.id as string,
    taskTitle: existing.title as string,
  });

  revalidatePath(`/workspace/${workspaceId}`);
  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}
