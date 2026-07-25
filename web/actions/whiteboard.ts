"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  EMPTY_DRAWING,
  parseDrawingData,
  type WhiteboardDrawingData,
} from "@/lib/whiteboard";
import type { ActionResult, WhiteboardRecord } from "@/types";

type WhiteboardRow = {
  id: string;
  workspace_id: string;
  drawing_data: unknown;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function mapRow(row: WhiteboardRow): WhiteboardRecord {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    drawing_data: parseDrawingData(row.drawing_data),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Latest whiteboard snapshot for late joiners. */
export async function getLatestWhiteboard(
  workspaceId: string
): Promise<WhiteboardRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whiteboards")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as WhiteboardRow);
}

/**
 * Persist the shared workspace board snapshot.
 * Prefers upsert RPC (one row per workspace); falls back to update/insert.
 */
export async function saveWhiteboard(
  workspaceId: string,
  drawingData: WhiteboardDrawingData,
  existingId?: string | null
): Promise<ActionResult<WhiteboardRecord>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const drawing = drawingData ?? EMPTY_DRAWING;

  const rpc = await supabase.rpc("upsert_workspace_whiteboard", {
    p_workspace_id: workspaceId,
    p_drawing_data: drawing,
  });

  if (!rpc.error && rpc.data) {
    const row = (
      Array.isArray(rpc.data) ? rpc.data[0] : rpc.data
    ) as WhiteboardRow;
    revalidatePath(`/workspace/${workspaceId}`);
    return { success: true, data: mapRow(row) };
  }

  if (existingId) {
    const { data, error } = await supabase
      .from("whiteboards")
      .update({
        drawing_data: drawing,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingId)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();

    if (!error && data) {
      revalidatePath(`/workspace/${workspaceId}`);
      return { success: true, data: mapRow(data as WhiteboardRow) };
    }
  }

  const latest = await getLatestWhiteboard(workspaceId);
  if (latest) {
    const { data, error } = await supabase
      .from("whiteboards")
      .update({
        drawing_data: drawing,
        updated_at: new Date().toISOString(),
      })
      .eq("id", latest.id)
      .select("*")
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Failed to save whiteboard",
      };
    }

    revalidatePath(`/workspace/${workspaceId}`);
    return { success: true, data: mapRow(data as WhiteboardRow) };
  }

  const { data, error } = await supabase
    .from("whiteboards")
    .insert({
      workspace_id: workspaceId,
      drawing_data: drawing,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to save whiteboard",
    };
  }

  revalidatePath(`/workspace/${workspaceId}`);
  return { success: true, data: mapRow(data as WhiteboardRow) };
}
