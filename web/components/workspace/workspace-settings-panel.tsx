"use client";

import { LeaveWorkspaceButton } from "@/components/workspace/leave-workspace-button";
import { WorkspaceFormDialog } from "@/components/workspace/workspace-components";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import type { Workspace } from "@/types";

interface WorkspaceSettingsPanelProps {
  workspace: Workspace;
  isOwner: boolean;
  canLeave: boolean;
  userId: string | null;
  displayName: string;
}

export function WorkspaceSettingsPanel({
  workspace,
  isOwner,
  canLeave,
  userId,
  displayName,
}: WorkspaceSettingsPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/80 px-4 py-3 sm:px-6">
        <h2 className="font-display text-base font-semibold">Settings</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Manage this workspace and your membership
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold">Workspace details</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Name and description shown to all members.
          </p>
          <div className="mt-3 space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Name · </span>
              {workspace.name}
            </p>
            <p>
              <span className="text-muted-foreground">Description · </span>
              {workspace.description || "None"}
            </p>
          </div>
          {isOwner ? (
            <div className="mt-4">
              <WorkspaceFormDialog
                workspace={workspace}
                trigger={
                  <Button type="button" variant="outline" size="sm" className="rounded-xl">
                    <Pencil className="h-4 w-4" />
                    Edit workspace
                  </Button>
                }
              />
            </div>
          ) : null}
        </div>

        {canLeave && userId ? (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold">Membership</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Leave this workspace if you no longer need access.
            </p>
            <div className="mt-4">
              <LeaveWorkspaceButton
                workspaceId={workspace.id}
                userId={userId}
                displayName={displayName}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
