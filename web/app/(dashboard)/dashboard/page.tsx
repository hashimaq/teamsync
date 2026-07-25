import type { Metadata } from "next";
import { getMyPendingInvitations } from "@/actions/members";
import { getCachedProfile, getCachedUser, getCachedWorkspaces } from "@/lib/data";
import { PendingInvitationsRealtime } from "@/components/workspace/pending-invitations-realtime";
import {
  CreateWorkspaceButton,
  WorkspaceGrid,
} from "@/components/workspace/workspace-components";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const [profile, workspaces, invitations, user] = await Promise.all([
    getCachedProfile(),
    getCachedWorkspaces(),
    getMyPendingInvitations(),
    getCachedUser(),
  ]);
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Dashboard</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Jump into a workspace or create a new one to keep your team in sync.
          </p>
        </div>
        <CreateWorkspaceButton />
      </div>

      <PendingInvitationsRealtime
        userId={user?.id ?? null}
        initialInvitations={invitations}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Your workspaces</h2>
          <p className="text-sm text-muted-foreground">{workspaces.length} total</p>
        </div>
        <WorkspaceGrid workspaces={workspaces} />
      </section>
    </div>
  );
}
