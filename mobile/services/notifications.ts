import { supabase } from "@/lib/supabase";
import type { Notification } from "@teamsync/shared";

export async function listNotifications(limit = 50): Promise<Notification[]> {
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

  if (error) {
    const fallback = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []) as Notification[];
  }

  return (data ?? []).map((row) => {
    const sender = Array.isArray(row.sender) ? row.sender[0] : row.sender;
    return {
      ...(row as Notification),
      sender: sender
        ? {
            id: sender.id,
            full_name: sender.full_name,
            avatar_url: sender.avatar_url,
          }
        : null,
    };
  });
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("recipient_id", user.id)
    .eq("is_read", false);

  if (error) throw new Error(error.message);
}
