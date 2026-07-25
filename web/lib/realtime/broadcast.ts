import type { RealtimeChannelSendResponse } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { MemberLeftBroadcast } from "@/lib/realtime/messages";

export const WORKSPACE_SYNC_CHANNEL = (workspaceId: string) =>
  `workspace-sync:${workspaceId}`;

export const MY_INVITATIONS_CHANNEL = (userId: string) =>
  `my-invitations:${userId}`;

export const MEMBER_LEFT_EVENT = "member_left";

export async function broadcastMemberLeft(
  workspaceId: string,
  payload: MemberLeftBroadcast
): Promise<RealtimeChannelSendResponse> {
  const supabase = createClient();
  const channel = supabase.channel(WORKSPACE_SYNC_CHANNEL(workspaceId), {
    config: { broadcast: { self: false } },
  });

  if (channel.state !== "joined") {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(() => resolve(), 2_000);
      channel.subscribe((status) => {
        if (
          status === "SUBSCRIBED" ||
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          window.clearTimeout(timeout);
          resolve();
        }
      });
    });
  }

  return channel.send({
    type: "broadcast",
    event: MEMBER_LEFT_EVENT,
    payload,
  });
}
