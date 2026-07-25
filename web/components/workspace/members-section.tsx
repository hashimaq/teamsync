"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Clock3,
  Crown,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  cancelWorkspaceInvitation,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  updateMemberRole,
} from "@/actions/members";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/validations";
import type {
  WorkspaceInvitationWithDetails,
  WorkspaceMemberWithProfile,
  WorkspaceRole,
} from "@/types";
import { formatDate, cn } from "@/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.split("@")[0] || "U";
  return source
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function RoleBadge({ role }: { role: WorkspaceRole }) {
  if (role === "owner") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
        <Crown className="h-3 w-3" />
        Owner
      </span>
    );
  }
  if (role === "admin") {
    return (
      <Badge className="border-sky-500/30 bg-sky-500/10 text-[10px] text-sky-700 dark:text-sky-300">
        Admin
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-border bg-muted/50 text-[10px] text-muted-foreground"
    >
      Member
    </Badge>
  );
}

interface InviteMemberButtonProps {
  workspaceId: string;
}

export function InviteMemberButton({ workspaceId }: InviteMemberButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const formData = new FormData();
    formData.set("email", values.email);

    startTransition(async () => {
      const result = await inviteWorkspaceMember(workspaceId, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }

      reset({ email: "" });
      setOpen(false);
      router.refresh();
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          reset({ email: "" });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="rounded-xl">
          <UserPlus className="h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Send an invitation to a registered TeamSync user. They will join only after
            accepting.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@company.com"
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="rounded-xl">
              {isPending ? "Sending..." : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface MemberCardProps {
  member: WorkspaceMemberWithProfile;
  workspaceId: string;
  canRemove: boolean;
  canChangeRole: boolean;
  isOnline: boolean;
}

function PresenceDot({ isOnline, name }: { isOnline: boolean; name: string }) {
  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card",
        isOnline ? "bg-emerald-500" : "bg-muted-foreground/45"
      )}
      title={isOnline ? `${name} is online` : `${name} is offline`}
      aria-label={isOnline ? "Online" : "Offline"}
    />
  );
}

function MemberCard({
  member,
  canRemove,
  canChangeRole,
  workspaceId,
  isOnline,
}: MemberCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRolePending, startRole] = useTransition();

  const name = member.profile?.full_name || "Unnamed user";
  const email = member.profile?.email || "No email available";
  const avatarUrl = member.profile?.avatar_url;

  return (
    <div className="group rounded-xl border border-border/80 bg-card p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11 border border-border/60">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
            <AvatarFallback className="bg-muted text-sm font-medium">
              {getInitials(member.profile?.full_name, member.profile?.email)}
            </AvatarFallback>
          </Avatar>
          <PresenceDot isOnline={isOnline} name={name} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{name}</p>
            <RoleBadge role={member.role} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className={isOnline ? "text-emerald-600 dark:text-emerald-400" : undefined}>
              {isOnline ? "Online" : "Offline"}
            </span>
            <span aria-hidden>·</span>
            <span>Joined {formatDate(member.created_at)}</span>
          </div>

          {canChangeRole && member.role !== "owner" ? (
            <div className="mt-3 max-w-[10rem]">
              <Select
                value={member.role === "admin" ? "admin" : "member"}
                disabled={isRolePending}
                onValueChange={(value) => {
                  const role = value as "admin" | "member";
                  setError(null);
                  startRole(async () => {
                    const result = await updateMemberRole(
                      workspaceId,
                      member.id,
                      role
                    );
                    if (!result.success) {
                      setError(result.error);
                      return;
                    }
                    router.refresh();
                  });
                }}
              >
                <SelectTrigger className="h-8 rounded-lg text-xs" aria-label="Change role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>

        {canRemove ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"
            aria-label={`Remove ${name}`}
            disabled={isPending}
            onClick={() => {
              if (!confirm(`Remove ${name} from this workspace?`)) return;
              setError(null);
              startTransition(async () => {
                const result = await removeWorkspaceMember(workspaceId, member.id);
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PendingInviteRow({
  invitation,
  workspaceId,
  canCancel,
}: {
  invitation: WorkspaceInvitationWithDetails;
  workspaceId: string;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Clock3 className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{invitation.invitee_email}</p>
          <Badge variant="outline" className="text-muted-foreground">
            Pending
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Invitation sent — waiting for acceptance
        </p>
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </div>
      {canCancel ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await cancelWorkspaceInvitation(
                invitation.id,
                workspaceId
              );
              if (!result.success) {
                setError(result.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          {isPending ? "Cancelling..." : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}

interface WorkspaceMembersSectionProps {
  workspaceId: string;
  members: WorkspaceMemberWithProfile[];
  pendingInvitations?: WorkspaceInvitationWithDetails[];
  isOwner: boolean;
  onlineUserIds?: Set<string>;
  onlineCount?: number;
}

export function WorkspaceMembersSection({
  workspaceId,
  members,
  pendingInvitations = [],
  isOwner,
  onlineUserIds,
  onlineCount = 0,
}: WorkspaceMembersSectionProps) {
  const [search, setSearch] = useState("");

  const memberOnlineCount = members.reduce((count, member) => {
    return onlineUserIds?.has(member.user_id) ? count + 1 : count;
  }, 0);
  const displayOnlineCount = onlineUserIds ? memberOnlineCount : onlineCount;

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const haystack = `${member.profile?.full_name ?? ""} ${member.profile?.email ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [members, search]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="shrink-0 flex flex-col gap-3 border-b border-border/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="font-display text-base font-semibold">Members</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Online {displayOnlineCount} · {members.length} total
            {pendingInvitations.length > 0
              ? ` · ${pendingInvitations.length} pending`
              : ""}
          </p>
        </div>
        {isOwner ? <InviteMemberButton workspaceId={workspaceId} /> : null}
      </div>

      <div className="shrink-0 border-b border-border/70 px-4 py-3 sm:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email…"
            className="h-9 rounded-xl pl-8 text-sm"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain p-4 sm:p-6 [-webkit-overflow-scrolling:touch]">
        {pendingInvitations.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {pendingInvitations.map((invitation) => (
              <PendingInviteRow
                key={invitation.id}
                invitation={invitation}
                workspaceId={workspaceId}
                canCancel={isOwner}
              />
            ))}
          </div>
        ) : null}

        {members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <Users className="mx-auto h-7 w-7 text-muted-foreground" />
            <h3 className="mt-3 font-display text-base font-semibold">No members yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Invite teammates by their registered email address.
            </p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <h3 className="font-display text-base font-semibold">No matches</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different name or email.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {filteredMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                workspaceId={workspaceId}
                canRemove={Boolean(isOwner) && member.role !== "owner"}
                canChangeRole={Boolean(isOwner)}
                isOnline={Boolean(onlineUserIds?.has(member.user_id))}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function WorkspaceMembersSkeleton() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    </section>
  );
}
