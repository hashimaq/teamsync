/**
 * Centralized NotificationService (server-only module).
 * Import from Server Actions / Route Handlers only — not from Client Components.
 * Fan-out writes notification rows + workspace activity; Realtime delivers via INSERT.
 */

import { createClient } from "@/lib/supabase/server";
import { firstName, quotedTitle } from "@/lib/notifications";
import type { NotificationType, WorkspaceRole } from "@/types";

type MemberRow = {
  user_id: string;
  role: WorkspaceRole;
};

type NotifyRow = {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type NotificationServiceResult = {
  notified: number;
  activityId: string | null;
  errors: string[];
};

async function getSupabase() {
  return createClient();
}

async function getActorName(userId: string): Promise<string> {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return firstName(data?.full_name);
}

async function getProfileName(userId: string | null | undefined): Promise<string> {
  if (!userId) return "Someone";
  return getActorName(userId);
}

async function getWorkspaceMembers(workspaceId: string): Promise<MemberRow[]> {
  const supabase = await getSupabase();

  // Prefer SECURITY DEFINER RPC so RLS never hides a peer member
  const rpc = await supabase.rpc("list_workspace_member_ids", {
    p_workspace_id: workspaceId,
  });

  if (!rpc.error && rpc.data) {
    return (rpc.data as { user_id: string; role: string }[]).map((row) => ({
      user_id: row.user_id,
      role: row.role as WorkspaceRole,
    }));
  }

  if (rpc.error) {
    console.warn(
      "[NotificationService] list_workspace_member_ids RPC unavailable, falling back:",
      rpc.error.message
    );
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("[NotificationService] members query failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    user_id: row.user_id as string,
    role: row.role as WorkspaceRole,
  }));
}

async function insertActivity(params: {
  workspaceId: string;
  actorId: string;
  eventType: string;
  message: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<string | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("workspace_activity")
    .insert({
      workspace_id: params.workspaceId,
      actor_id: params.actorId,
      event_type: params.eventType,
      message: params.message,
      metadata: params.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    // Table may not exist yet — don't break primary actions
    console.error("[NotificationService] activity insert failed:", error.message);
    return null;
  }

  return (data?.id as string) ?? null;
}

async function insertNotifications(
  workspaceId: string | null,
  senderId: string,
  rows: NotifyRow[]
): Promise<{ count: number; errors: string[] }> {
  // Include EVERY recipient, including the actor when requested by callers
  const unique = new Map<string, NotifyRow>();
  for (const row of rows) {
    if (!row.recipientId) continue;
    unique.set(`${row.recipientId}:${row.type}:${row.message}`, row);
  }

  const list = [...unique.values()];
  if (list.length === 0) return { count: 0, errors: [] };

  const supabase = await getSupabase();
  const payload = list.map((row) => ({
    recipient_id: row.recipientId,
    type: row.type,
    title: row.title,
    message: row.message,
    metadata: row.metadata ?? {},
  }));

  console.info(
    `[NotificationService] fan-out workspace=${workspaceId} sender=${senderId} recipients=${list
      .map((r) => r.recipientId)
      .join(",")} count=${list.length}`
  );

  // Prefer SECURITY DEFINER RPC — inserts without SELECT-RETURNING RLS trap
  if (workspaceId) {
    const rpc = await supabase.rpc("fanout_notifications", {
      p_workspace_id: workspaceId,
      p_rows: payload,
    });

    if (!rpc.error) {
      const count = typeof rpc.data === "number" ? rpc.data : list.length;
      console.info(`[NotificationService] fanout_notifications inserted=${count}`);
      return { count, errors: [] };
    }

    console.warn(
      "[NotificationService] fanout_notifications RPC unavailable, falling back:",
      rpc.error.message
    );
  }

  // Fallback: direct insert WITHOUT .select()
  const insertPayload = list.map((row) => ({
    workspace_id: workspaceId,
    recipient_id: row.recipientId,
    sender_id: senderId,
    type: row.type,
    title: row.title,
    message: row.message,
    metadata: row.metadata ?? {},
  }));

  const { error } = await supabase.from("notifications").insert(insertPayload);

  if (error) {
    console.error("[NotificationService] notification insert failed:", error.message);
    let count = 0;
    const errors: string[] = [error.message];
    for (const row of insertPayload) {
      const single = await supabase.from("notifications").insert(row);
      if (single.error) {
        errors.push(`${row.recipient_id}: ${single.error.message}`);
      } else {
        count += 1;
      }
    }
    return { count, errors };
  }

  return { count: list.length, errors: [] };
}

function ownersAndAdmins(members: MemberRow[], exclude: Set<string>): MemberRow[] {
  return members.filter(
    (m) =>
      (m.role === "owner" || m.role === "admin") && !exclude.has(m.user_id)
  );
}

function allExcept(members: MemberRow[], exclude: Set<string>): MemberRow[] {
  return members.filter((m) => !exclude.has(m.user_id));
}

export const NotificationService = {
  async notifyTaskAssigned(params: {
    workspaceId: string;
    actorId: string;
    taskId: string;
    taskTitle: string;
    assigneeId: string | null;
  }): Promise<NotificationServiceResult> {
    const actor = await getActorName(params.actorId);
    const titleQuoted = quotedTitle(params.taskTitle);
    const members = await getWorkspaceMembers(params.workspaceId);
    const rows: NotifyRow[] = [];
    const meta = {
      task_id: params.taskId,
      task_title: params.taskTitle,
    };

    let activityMessage: string;

    if (!params.assigneeId) {
      activityMessage = `${actor} unassigned ${titleQuoted}`;
      for (const m of members) {
        rows.push({
          recipientId: m.user_id,
          type: "task_assigned",
          title: "Task unassigned",
          message:
            m.user_id === params.actorId
              ? `You unassigned ${titleQuoted}.`
              : `${actor} unassigned ${titleQuoted}.`,
          metadata: meta,
        });
      }
    } else {
      const assigneeName = await getProfileName(params.assigneeId);
      activityMessage = `${actor} assigned ${titleQuoted} to ${assigneeName}`;

      for (const m of members) {
        let message: string;
        if (m.user_id === params.assigneeId) {
          message =
            params.assigneeId === params.actorId
              ? `You assigned yourself ${titleQuoted}.`
              : `You were assigned ${titleQuoted} by ${actor}.`;
        } else if (m.user_id === params.actorId) {
          message = `You assigned ${titleQuoted} to ${assigneeName}.`;
        } else if (m.role === "owner") {
          message = `${actor} assigned a task to ${assigneeName}.`;
        } else if (m.role === "admin") {
          message = `${actor} assigned a task.`;
        } else {
          message = `${actor} assigned ${titleQuoted} to ${assigneeName}.`;
        }

        rows.push({
          recipientId: m.user_id,
          type: "task_assigned",
          title: "Task assigned",
          message,
          metadata: { ...meta, assignee_name: assigneeName },
        });
      }
    }

    const activityId = await insertActivity({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      eventType: "task_assigned",
      message: activityMessage,
      metadata: meta,
    });

    const { count, errors } = await insertNotifications(
      params.workspaceId,
      params.actorId,
      rows
    );

    return { notified: count, activityId, errors };
  },

  async notifyTaskCompleted(params: {
    workspaceId: string;
    actorId: string;
    taskId: string;
    taskTitle: string;
    createdBy?: string | null;
    assigneeId?: string | null;
  }): Promise<NotificationServiceResult> {
    const actor = await getActorName(params.actorId);
    const titleQuoted = quotedTitle(params.taskTitle);
    const members = await getWorkspaceMembers(params.workspaceId);
    const meta = { task_id: params.taskId, task_title: params.taskTitle };

    const rows: NotifyRow[] = members.map((m) => ({
      recipientId: m.user_id,
      type: "task_completed" as const,
      title: "Task completed",
      message:
        m.user_id === params.actorId
          ? `You completed ${titleQuoted}.`
          : `${actor} completed ${titleQuoted}.`,
      metadata: meta,
    }));

    const activityId = await insertActivity({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      eventType: "task_completed",
      message: `${actor} completed ${titleQuoted}`,
      metadata: meta,
    });

    const { count, errors } = await insertNotifications(
      params.workspaceId,
      params.actorId,
      rows
    );
    return { notified: count, activityId, errors };
  },

  async notifyTaskUpdated(params: {
    workspaceId: string;
    actorId: string;
    taskId: string;
    taskTitle: string;
  }): Promise<NotificationServiceResult> {
    const actor = await getActorName(params.actorId);
    const titleQuoted = quotedTitle(params.taskTitle);
    const members = await getWorkspaceMembers(params.workspaceId);
    const meta = { task_id: params.taskId, task_title: params.taskTitle };

    const rows: NotifyRow[] = members.map((m) => ({
      recipientId: m.user_id,
      type: "task_updated" as const,
      title: "Task updated",
      message:
        m.user_id === params.actorId
          ? `You updated ${titleQuoted}.`
          : `${actor} updated ${titleQuoted}.`,
      metadata: meta,
    }));

    const activityId = await insertActivity({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      eventType: "task_updated",
      message: `${actor} updated ${titleQuoted}`,
      metadata: meta,
    });

    const { count, errors } = await insertNotifications(
      params.workspaceId,
      params.actorId,
      rows
    );
    return { notified: count, activityId, errors };
  },

  async notifyTaskCreated(params: {
    workspaceId: string;
    actorId: string;
    taskId: string;
    taskTitle: string;
  }): Promise<NotificationServiceResult> {
    const actor = await getActorName(params.actorId);
    const titleQuoted = quotedTitle(params.taskTitle);
    const members = await getWorkspaceMembers(params.workspaceId);
    const meta = { task_id: params.taskId, task_title: params.taskTitle };

    const rows: NotifyRow[] = members.map((m) => ({
      recipientId: m.user_id,
      type: "task_updated" as const,
      title: "New task",
      message:
        m.user_id === params.actorId
          ? `You created ${titleQuoted}.`
          : `${actor} created ${titleQuoted}.`,
      metadata: meta,
    }));

    const activityId = await insertActivity({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      eventType: "task_created",
      message: `${actor} created ${titleQuoted}`,
      metadata: meta,
    });

    const { count, errors } = await insertNotifications(
      params.workspaceId,
      params.actorId,
      rows
    );
    return { notified: count, activityId, errors };
  },

  async notifyTaskDeleted(params: {
    workspaceId: string;
    actorId: string;
    taskId: string;
    taskTitle: string;
  }): Promise<NotificationServiceResult> {
    const actor = await getActorName(params.actorId);
    const titleQuoted = quotedTitle(params.taskTitle);
    const members = await getWorkspaceMembers(params.workspaceId);
    const meta = { task_id: params.taskId, task_title: params.taskTitle };

    const rows: NotifyRow[] = members.map((m) => ({
      recipientId: m.user_id,
      type: "task_deleted" as const,
      title: "Task deleted",
      message:
        m.user_id === params.actorId
          ? `You deleted ${titleQuoted}.`
          : `${actor} deleted ${titleQuoted}.`,
      metadata: meta,
    }));

    const activityId = await insertActivity({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      eventType: "task_deleted",
      message: `${actor} deleted ${titleQuoted}`,
      metadata: meta,
    });

    const { count, errors } = await insertNotifications(
      params.workspaceId,
      params.actorId,
      rows
    );
    return { notified: count, activityId, errors };
  },

  async notifyInvitationReceived(params: {
    workspaceId: string;
    actorId: string;
    inviteeId: string;
    workspaceName: string;
    invitationId: string;
  }): Promise<NotificationServiceResult> {
    const actor = await getActorName(params.actorId);
    const { count, errors } = await insertNotifications(params.workspaceId, params.actorId, [
      {
        recipientId: params.inviteeId,
        type: "invitation_received",
        title: "Workspace invitation",
        message: `${actor} invited you to ${params.workspaceName}.`,
        metadata: {
          invitation_id: params.invitationId,
          workspace_name: params.workspaceName,
        },
      },
    ]);

    const activityId = await insertActivity({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      eventType: "invitation_sent",
      message: `${actor} invited a teammate to the workspace`,
      metadata: { invitation_id: params.invitationId },
    });

    return { notified: count, activityId, errors };
  },

  async notifyInvitationAccepted(params: {
    workspaceId: string;
    actorId: string;
    inviterId: string;
    workspaceName: string;
  }): Promise<NotificationServiceResult> {
    const actor = await getActorName(params.actorId);
    const members = await getWorkspaceMembers(params.workspaceId);
    const exclude = new Set([params.actorId]);
    const rows: NotifyRow[] = [];

    if (params.inviterId !== params.actorId) {
      rows.push({
        recipientId: params.inviterId,
        type: "invitation_accepted",
        title: "Invitation accepted",
        message: `${actor} accepted your invitation.`,
        metadata: { workspace_name: params.workspaceName },
      });
      exclude.add(params.inviterId);
    }

    for (const m of allExcept(members, exclude)) {
      rows.push({
        recipientId: m.user_id,
        type: "member_joined",
        title: "Member joined",
        message: `${actor} joined the workspace.`,
        metadata: { workspace_name: params.workspaceName },
      });
    }

    const activityId = await insertActivity({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      eventType: "member_joined",
      message: `${actor} joined the workspace`,
      metadata: { workspace_name: params.workspaceName },
    });

    const { count, errors } = await insertNotifications(
      params.workspaceId,
      params.actorId,
      rows
    );
    return { notified: count, activityId, errors };
  },

  async notifyMemberRemoved(params: {
    workspaceId: string;
    actorId: string;
    removedUserId: string;
    workspaceName: string;
  }): Promise<NotificationServiceResult> {
    const actor = await getActorName(params.actorId);
    const members = await getWorkspaceMembers(params.workspaceId);
    const rows: NotifyRow[] = [
      {
        recipientId: params.removedUserId,
        type: "member_removed",
        title: "Removed from workspace",
        message: `You were removed from ${params.workspaceName}.`,
        metadata: { workspace_name: params.workspaceName, removed_by: actor },
      },
    ];

    for (const m of allExcept(members, new Set([params.actorId, params.removedUserId]))) {
      rows.push({
        recipientId: m.user_id,
        type: "member_removed",
        title: "Member removed",
        message: `${actor} removed a member from the workspace.`,
        metadata: { workspace_name: params.workspaceName },
      });
    }

    const activityId = await insertActivity({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      eventType: "member_removed",
      message: `${actor} removed a member`,
      metadata: { workspace_name: params.workspaceName },
    });

    const { count, errors } = await insertNotifications(
      params.workspaceId,
      params.actorId,
      rows
    );
    return { notified: count, activityId, errors };
  },

  async notifyRoleChanged(params: {
    workspaceId: string;
    actorId: string;
    targetUserId: string;
    role: "admin" | "member";
    workspaceName: string;
  }): Promise<NotificationServiceResult> {
    const actor = await getActorName(params.actorId);
    const roleLabel = params.role === "admin" ? "Admin" : "Member";
    const members = await getWorkspaceMembers(params.workspaceId);
    const targetName = await getProfileName(params.targetUserId);
    const rows: NotifyRow[] = [
      {
        recipientId: params.targetUserId,
        type: "role_changed",
        title: "Role updated",
        message: `${actor} changed your role to ${roleLabel} in ${params.workspaceName}.`,
        metadata: {
          role: params.role,
          workspace_name: params.workspaceName,
        },
      },
    ];

    for (const m of ownersAndAdmins(members, new Set([params.actorId, params.targetUserId]))) {
      rows.push({
        recipientId: m.user_id,
        type: "role_changed",
        title: "Role updated",
        message: `${actor} promoted ${targetName} to ${roleLabel}.`,
        metadata: {
          role: params.role,
          workspace_name: params.workspaceName,
        },
      });
    }

    const activityId = await insertActivity({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      eventType: "role_changed",
      message: `${actor} changed ${targetName}'s role to ${roleLabel}`,
      metadata: { role: params.role },
    });

    const { count, errors } = await insertNotifications(
      params.workspaceId,
      params.actorId,
      rows
    );
    return { notified: count, activityId, errors };
  },

  async notifyWorkspaceRenamed(params: {
    workspaceId: string;
    actorId: string;
    oldName: string;
    newName: string;
  }): Promise<NotificationServiceResult> {
    const actor = await getActorName(params.actorId);
    const members = await getWorkspaceMembers(params.workspaceId);
    const message = `${actor} renamed the workspace to “${params.newName}”.`;
    const rows: NotifyRow[] = allExcept(members, new Set([params.actorId])).map(
      (m) => ({
        recipientId: m.user_id,
        type: "workspace_renamed" as const,
        title: "Workspace renamed",
        message,
        metadata: { old_name: params.oldName, new_name: params.newName },
      })
    );

    const activityId = await insertActivity({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      eventType: "workspace_renamed",
      message: `${actor} renamed the workspace to “${params.newName}”`,
      metadata: { old_name: params.oldName, new_name: params.newName },
    });

    const { count, errors } = await insertNotifications(
      params.workspaceId,
      params.actorId,
      rows
    );
    return { notified: count, activityId, errors };
  },
};
