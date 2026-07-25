"use client";

import { UserPlus, Zap } from "lucide-react";
import { useWorkspacePresenceContext } from "@/hooks/use-workspace-presence";
import { useWorkspaceActivityFeedOptional } from "@/components/notifications/workspace-activity-provider";
import { useWorkspaceShell } from "@/components/workspace/workspace-shell-context";
import { InviteMemberButton } from "@/components/workspace/members-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Workspace, WorkspaceMemberWithProfile } from "@/types";
import { formatNotificationTimeAgo } from "@/lib/notifications";
import { cn } from "@/utils";

function getInitials(name: string | null | undefined) {
  const source = name?.trim() || "U";
  return source
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface WorkspaceRightSidebarProps {
  workspace: Workspace;
  members: WorkspaceMemberWithProfile[];
  isOwner: boolean;
  taskCount: number;
}

export function WorkspaceRightSidebar({
  workspace,
  members,
  isOwner,
  taskCount,
}: WorkspaceRightSidebarProps) {
  const { onlineUserIds, onlineCount } = useWorkspacePresenceContext();
  const { setPanel } = useWorkspaceShell();
  const activityContext = useWorkspaceActivityFeedOptional();
  const activity = activityContext?.activity ?? [];

  const onlineMembers = members.filter((member) =>
    onlineUserIds.has(member.user_id)
  );
  const offlineMembers = members.filter(
    (member) => !onlineUserIds.has(member.user_id)
  );

  return (
    <aside className="hidden h-full w-[260px] shrink-0 flex-col border-l border-border/80 bg-card/60 backdrop-blur-md lg:flex xl:w-[280px]">
      <div className="border-b border-border/80 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Workspace
        </p>
        <h2 className="mt-1 truncate font-display text-base font-semibold">
          {workspace.name}
        </h2>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {workspace.description || "No description yet."}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-border/70 bg-background/70 px-2.5 py-2 shadow-sm">
            <p className="text-muted-foreground">Tasks</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{taskCount}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/70 px-2.5 py-2 shadow-sm">
            <p className="text-muted-foreground">Online</p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {onlineCount}
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 [-webkit-overflow-scrolling:touch]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Online · {onlineMembers.length}
          </p>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setPanel("members")}
          >
            View all
          </button>
        </div>

        <div className="space-y-1">
          {onlineMembers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              No one else is online right now.
            </p>
          ) : (
            onlineMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-muted/60"
              >
                <div className="relative shrink-0">
                  <Avatar className="h-8 w-8">
                    {member.profile?.avatar_url ? (
                      <AvatarImage src={member.profile.avatar_url} alt="" />
                    ) : null}
                    <AvatarFallback className="bg-muted text-[10px] font-medium">
                      {getInitials(member.profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.profile?.full_name || "Unnamed"}
                  </p>
                  <p className="truncate text-[11px] capitalize text-muted-foreground">
                    {member.role}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {offlineMembers.length > 0 ? (
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Offline · {offlineMembers.length}
            </p>
            <div className="space-y-1">
              {offlineMembers.slice(0, 5).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 opacity-65"
                >
                  <Avatar className="h-8 w-8">
                    {member.profile?.avatar_url ? (
                      <AvatarImage src={member.profile.avatar_url} alt="" />
                    ) : null}
                    <AvatarFallback className="bg-muted text-[10px]">
                      {getInitials(member.profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="truncate text-sm">
                    {member.profile?.full_name || "Unnamed"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 rounded-xl border border-border/70 bg-background/70 p-3 shadow-sm">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Recent activity
          </p>
          <ul className="mt-2.5 space-y-2.5">
            {activity.length === 0 ? (
              <li className="text-xs text-muted-foreground">
                Task and team updates will appear here live.
              </li>
            ) : (
              activity.slice(0, 8).map((item) => (
                <li key={item.id} className="text-xs leading-snug">
                  <p className="text-foreground/90">{item.message}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatNotificationTimeAgo(item.created_at)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="space-y-2 border-t border-border/80 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Quick actions
        </p>
        {isOwner ? (
          <div className={cn("w-full")}>
            <InviteMemberButton workspaceId={workspace.id} />
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-xl"
            onClick={() => setPanel("members")}
          >
            <UserPlus className="h-4 w-4" />
            View members
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full rounded-xl"
          onClick={() => setPanel("tasks")}
        >
          Open tasks
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full rounded-xl"
          onClick={() => setPanel("chat")}
        >
          Open chat
        </Button>
      </div>
    </aside>
  );
}
