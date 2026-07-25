"use server";

import { createClient } from "@/lib/supabase/server";
import { chatMessageSchema } from "@/lib/validations";
import type { ActionResult, ChatMessageWithSender } from "@/types";

type MessageRow = {
  id: string;
  workspace_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  profiles:
    | {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
      }
    | {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
      }[]
    | null;
};

function mapMessageRow(row: MessageRow): ChatMessageWithSender {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  return {
    id: row.id,
    workspace_id: row.workspace_id,
    sender_id: row.sender_id,
    message: row.message,
    created_at: row.created_at,
    sender: profile
      ? {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        }
      : null,
  };
}

const MESSAGE_SELECT = `
  id,
  workspace_id,
  sender_id,
  message,
  created_at,
  profiles:sender_id (
    id,
    full_name,
    avatar_url
  )
`;

export async function getWorkspaceMessages(
  workspaceId: string,
  limit = 100
): Promise<ChatMessageWithSender[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) {
    if (!error?.message?.includes("Could not find the table")) {
      console.error("Failed to load messages:", error?.message);
    }
    return [];
  }

  return (data as MessageRow[]).map(mapMessageRow);
}

export async function sendWorkspaceMessage(
  workspaceId: string,
  rawMessage: string
): Promise<ActionResult<ChatMessageWithSender>> {
  const parsed = chatMessageSchema.safeParse({ message: rawMessage });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid message",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      workspace_id: workspaceId,
      sender_id: user.id,
      message: parsed.data.message,
    })
    .select(MESSAGE_SELECT)
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to send message",
    };
  }

  return { success: true, data: mapMessageRow(data as MessageRow) };
}
