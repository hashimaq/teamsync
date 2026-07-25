import type { RealtimePresenceState } from "@supabase/supabase-js";

export const WORKSPACE_PRESENCE_CHANNEL = (workspaceId: string) =>
  `workspace-presence:${workspaceId}`;

export type WorkspacePresenceMeta = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  online_at: string;
};

export function collectOnlineUserIds(
  state: RealtimePresenceState<WorkspacePresenceMeta>
): Set<string> {
  const online = new Set<string>();

  for (const [presenceKey, metas] of Object.entries(state)) {
    if (!metas || metas.length === 0) continue;

    // Prefer presence key (configured as user id), fall back to payload
    if (presenceKey) {
      online.add(presenceKey);
      continue;
    }

    for (const meta of metas) {
      if (meta.user_id) {
        online.add(meta.user_id);
      }
    }
  }

  return online;
}
