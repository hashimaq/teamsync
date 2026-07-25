"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useWorkspacePresenceContext } from "@/hooks/use-workspace-presence";
import { useWorkspaceShell } from "@/components/workspace/workspace-shell-context";
import { InviteMemberButton } from "@/components/workspace/members-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WorkspaceMemberWithProfile } from "@/types";

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

interface WorkspaceTopHeaderProps {
  workspaceName: string;
  description: string | null;
  isOwner: boolean;
  workspaceId: string;
  currentUserId: string | null;
  members: WorkspaceMemberWithProfile[];
}

export function WorkspaceTopHeader({
  workspaceName,
  description,
  isOwner,
  workspaceId,
  currentUserId,
  members,
}: WorkspaceTopHeaderProps) {
  const { onlineUserIds, onlineCount } = useWorkspacePresenceContext();
  const { setPanel } = useWorkspaceShell();
  const [peopleOpen, setPeopleOpen] = useState(false);

  const onlineMembers = members.filter((member) =>
    onlineUserIds.has(member.user_id)
  );

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-base font-semibold tracking-tight sm:text-lg">
              {workspaceName}
            </h1>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {description || "Collaborate. Chat. Stay in Sync."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 rounded-xl lg:hidden"
              onClick={() => setPeopleOpen(true)}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{onlineCount}</span>
            </Button>
            <NotificationBell userId={currentUserId} />
            {isOwner ? <InviteMemberButton workspaceId={workspaceId} /> : null}
          </div>
        </div>
      </header>

      <Dialog open={peopleOpen} onOpenChange={setPeopleOpen}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Online now · {onlineMembers.length}</DialogTitle>
          </DialogHeader>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {onlineMembers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No one else is online right now.
              </p>
            ) : (
              onlineMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      {member.profile?.avatar_url ? (
                        <AvatarImage src={member.profile.avatar_url} alt="" />
                      ) : null}
                      <AvatarFallback className="bg-muted text-[10px]">
                        {getInitials(member.profile?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
                  </div>
                  <p className="truncate text-sm font-medium">
                    {member.profile?.full_name || "Unnamed"}
                  </p>
                </div>
              ))
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full rounded-xl"
            onClick={() => {
              setPeopleOpen(false);
              setPanel("members");
            }}
          >
            View all members
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
