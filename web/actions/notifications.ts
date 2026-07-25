"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CreateNotificationInput } from "@/lib/notifications";
import type { ActionResult, Notification } from "@/types";

type NotificationRow = {
  id: string;
  workspace_id: string | null;
  recipient_id: string;
  sender_id: string | null;
  type: Notification["type"];
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    recipient_id: row.recipient_id,
    sender_id: row.sender_id,
    type: row.type,
    title: row.title,
    message: row.message,
    metadata: row.metadata ?? {},
    is_read: row.is_read,
    created_at: row.created_at,
    sender: row.sender
      ? {
          id: row.sender.id,
          full_name: row.sender.full_name,
          avatar_url: row.sender.avatar_url,
        }
      : null,
  };
}

export async function getMyNotifications(limit = 40): Promise<Notification[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
      *,
      sender:profiles!notifications_sender_id_fkey (
        id,
        full_name,
        avatar_url
      )
    `
    )
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    // Fallback without join if FK hint fails
    const fallback = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fallback.error || !fallback.data) {
      if (!error?.message?.includes("Could not find the table")) {
        console.error("Failed to load notifications:", error?.message ?? fallback.error?.message);
      }
      return [];
    }

    const rows = fallback.data as NotificationRow[];
    const senderIds = [
      ...new Set(rows.map((row) => row.sender_id).filter(Boolean) as string[]),
    ];

    if (senderIds.length === 0) {
      return rows.map(mapNotification);
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", senderIds);

    const profileMap = new Map(
      (profiles ?? []).map((profile) => [
        profile.id as string,
        {
          id: profile.id as string,
          full_name: (profile.full_name as string | null) ?? null,
          avatar_url: (profile.avatar_url as string | null) ?? null,
        },
      ])
    );

    return rows.map((row) =>
      mapNotification({
        ...row,
        sender: row.sender_id ? profileMap.get(row.sender_id) ?? null : null,
      })
    );
  }

  return (data as NotificationRow[]).map(mapNotification);
}

export async function getNotificationSenderProfile(
  senderId: string
): Promise<Notification["sender"]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", senderId)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as string,
    full_name: (data.full_name as string | null) ?? null,
    avatar_url: (data.avatar_url as string | null) ?? null,
  };
}

export async function markNotificationRead(
  notificationId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("recipient_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: undefined };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("recipient_id", user.id)
    .eq("is_read", false);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}

/** Insert a single notification (caller must be sender). */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification | null> {
  const supabase = await createClient();

  // Do NOT chain .select() — SELECT RLS is recipient-only, so returning
  // another user's row fails and PostgREST aborts the insert.
  const { error } = await supabase.from("notifications").insert({
    workspace_id: input.workspaceId ?? null,
    recipient_id: input.recipientId,
    sender_id: input.senderId,
    type: input.type,
    title: input.title,
    message: input.message,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("Failed to create notification:", error.message);
    return null;
  }

  return {
    id: crypto.randomUUID(),
    workspace_id: input.workspaceId ?? null,
    recipient_id: input.recipientId,
    sender_id: input.senderId,
    type: input.type,
    title: input.title,
    message: input.message,
    metadata: input.metadata ?? {},
    is_read: false,
    created_at: new Date().toISOString(),
    sender: null,
  };
}

/** Fan-out notifications to many recipients. */
export async function createNotificationsForRecipients(
  recipientIds: string[],
  input: Omit<CreateNotificationInput, "recipientId">
): Promise<void> {
  const unique = [...new Set(recipientIds)].filter(Boolean);

  if (unique.length === 0) return;

  const supabase = await createClient();

  const rows = unique.map((recipientId) => ({
    workspace_id: input.workspaceId ?? null,
    recipient_id: recipientId,
    sender_id: input.senderId,
    type: input.type,
    title: input.title,
    message: input.message,
    metadata: input.metadata ?? {},
  }));

  const { error } = await supabase.from("notifications").insert(rows);

  if (error) {
    console.error("Failed to create notifications:", error.message);
  }
}
