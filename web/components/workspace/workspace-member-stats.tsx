"use client";

import { useWorkspacePresenceContext } from "@/hooks/use-workspace-presence";

export function WorkspaceMemberStats() {
  const { memberCount, onlineUserIds, isConnected } = useWorkspacePresenceContext();

  // Presence keys are user ids currently in this workspace room
  const onlineCount = onlineUserIds.size;

  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground transition-opacity duration-300"
      aria-live="polite"
    >
      <p>
        Members: <span className="font-medium text-foreground">{memberCount}</span>
      </p>
      <p className="inline-flex items-center gap-1.5">
        <span
          className={
            isConnected
              ? "inline-block h-2 w-2 rounded-full bg-emerald-500"
              : "inline-block h-2 w-2 rounded-full bg-muted-foreground/40"
          }
        />
        Online: <span className="font-medium text-foreground">{onlineCount}</span>
      </p>
    </div>
  );
}
