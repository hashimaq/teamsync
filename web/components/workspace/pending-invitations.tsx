"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Mail, X } from "lucide-react";
import {
  acceptWorkspaceInvitation,
  declineWorkspaceInvitation,
} from "@/actions/members";
import type { WorkspaceInvitationWithDetails } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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

interface PendingInvitationsProps {
  invitations: WorkspaceInvitationWithDetails[];
  onInvitationResolved?: (invitationId: string) => void;
}

export function PendingInvitations({
  invitations,
  onInvitationResolved,
}: PendingInvitationsProps) {
  if (invitations.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">Workspace invitations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Accept an invite to join the workspace and start collaborating.
        </p>
      </div>

      <div className="space-y-3">
        {invitations.map((invitation) => (
          <InvitationCard
            key={invitation.id}
            invitation={invitation}
            onResolved={onInvitationResolved}
          />
        ))}
      </div>
    </section>
  );
}

function InvitationCard({
  invitation,
  onResolved,
}: {
  invitation: WorkspaceInvitationWithDetails;
  onResolved?: (invitationId: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, startAccept] = useTransition();
  const [isDeclining, startDecline] = useTransition();

  const workspaceName = invitation.workspace?.name ?? "a workspace";
  const inviterName = invitation.inviter?.full_name ?? "A teammate";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11">
            {invitation.inviter?.avatar_url ? (
              <AvatarImage
                src={invitation.inviter.avatar_url}
                alt={inviterName}
              />
            ) : null}
            <AvatarFallback className="bg-muted text-sm font-medium">
              {getInitials(invitation.inviter?.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
              <Mail className="h-3.5 w-3.5" />
              Invitation
            </div>
            <p className="text-sm font-medium text-foreground">
              <span className="font-semibold">{inviterName}</span> invited you to join{" "}
              <span className="font-semibold">{workspaceName}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Would you like to join this workspace?
            </p>
            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:shrink-0">
          <Button
            type="button"
            variant="outline"
            disabled={isAccepting || isDeclining}
            onClick={() => {
              setError(null);
              startDecline(async () => {
                const result = await declineWorkspaceInvitation(invitation.id);
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                onResolved?.(invitation.id);
                router.refresh();
              });
            }}
          >
            <X className="h-4 w-4" />
            {isDeclining ? "Declining..." : "Decline"}
          </Button>
          <Button
            type="button"
            disabled={isAccepting || isDeclining}
            onClick={() => {
              setError(null);
              startAccept(async () => {
                const result = await acceptWorkspaceInvitation(invitation.id);
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                onResolved?.(invitation.id);
                router.refresh();
                if (result.data.workspace_id) {
                  router.push(`/workspace/${result.data.workspace_id}`);
                }
              });
            }}
          >
            <Check className="h-4 w-4" />
            {isAccepting ? "Joining..." : "Accept & Join"}
          </Button>
        </div>
      </div>
    </div>
  );
}
