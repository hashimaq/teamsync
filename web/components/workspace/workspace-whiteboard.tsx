"use client";

import { Whiteboard } from "@/components/whiteboard/Whiteboard";

/**
 * Workspace shell adapter — keeps panel wiring thin and isolated from canvas logic.
 */
export function WorkspaceWhiteboard({
  workspaceId,
  workspaceName,
  userId,
  userName,
  userAvatar,
}: {
  workspaceId: string;
  workspaceName?: string;
  userId: string | null;
  userName?: string | null;
  userAvatar?: string | null;
}) {
  return (
    <Whiteboard
      workspaceId={workspaceId}
      workspaceName={workspaceName}
      userId={userId}
      userName={userName}
      userAvatar={userAvatar}
    />
  );
}
