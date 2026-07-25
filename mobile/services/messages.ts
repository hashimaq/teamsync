import { supabase } from "@/lib/supabase";
import type { ChatMessageWithSender } from "@teamsync/shared";

export async function listMessages(
  workspaceId: string,
  limit = 80
): Promise<ChatMessageWithSender[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      id,
      workspace_id,
      sender_id,
      message,
      created_at,
      sender:profiles!messages_sender_id_fkey (
        id,
        full_name,
        avatar_url
      )
    `
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const sender = Array.isArray(row.sender) ? row.sender[0] : row.sender;
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      sender_id: row.sender_id,
      message: row.message,
      created_at: row.created_at,
      sender: sender
        ? {
            id: sender.id,
            full_name: sender.full_name,
            avatar_url: sender.avatar_url,
          }
        : null,
    } satisfies ChatMessageWithSender;
  });
}

export async function sendMessage(workspaceId: string, message: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const trimmed = message.trim();
  if (!trimmed) throw new Error("Message is empty");
  if (trimmed.length > 2000) throw new Error("Message is too long");

  const { data, error } = await supabase
    .from("messages")
    .insert({
      workspace_id: workspaceId,
      sender_id: user.id,
      message: trimmed,
    })
    .select(
      `
      id,
      workspace_id,
      sender_id,
      message,
      created_at
    `
    )
    .single();

  if (error) throw new Error(error.message);
  return data;
}
