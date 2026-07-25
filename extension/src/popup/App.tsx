import { LogOut } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import { QuickActions } from "@/components/QuickActions";
import { StatsCards } from "@/components/StatsCards";
import { TaskPanel } from "@/components/TaskPanel";
import { UserHeader } from "@/components/UserHeader";
import { WorkspaceSelector } from "@/components/WorkspaceSelector";
import { Button, Skeleton } from "@/components/ui";
import {
  useDashboardData,
  useExtensionSession,
  useWorkspaces,
} from "@/hooks/useExtensionData";
import { openWebApp, openWorkspace } from "@/lib/utils";

export function App() {
  const { user, loading, error, login, logout } = useExtensionSession();
  const {
    workspaces,
    workspaceId,
    loading: workspacesLoading,
    selectWorkspace,
  } = useWorkspaces(user?.id ?? null);
  const dashboard = useDashboardData(user?.id ?? null, workspaceId);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <LoginForm onSubmit={login} error={error} loading={loading} />
      </div>
    );
  }

  const hasWorkspace = Boolean(workspaceId);

  return (
    <div className="flex min-h-[520px] flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <UserHeader user={user} online={!dashboard.loading} />
        <Button variant="ghost" className="h-8 px-2" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <WorkspaceSelector
        workspaces={workspaces}
        workspaceId={workspaceId}
        disabled={workspacesLoading}
        onChange={(id) => {
          void selectWorkspace(id);
        }}
      />

      {dashboard.error ? (
        <p className="rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
          {dashboard.error}
        </p>
      ) : null}

      <StatsCards
        stats={dashboard.stats}
        onOpenMessages={() => {
          void dashboard.clearMessageBadge();
          if (workspaceId) openWorkspace(workspaceId, "chat");
          else openWebApp("/dashboard");
        }}
        onOpenTasks={() => {
          if (workspaceId) openWorkspace(workspaceId, "tasks");
        }}
        onOpenNotifications={() => {
          void dashboard.clearNotificationBadge();
          if (workspaceId) openWorkspace(workspaceId, "notifications");
        }}
      />

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Quick actions
        </h2>
        <QuickActions
          disabled={!hasWorkspace}
          onOpenWeb={() => openWebApp("/dashboard")}
          onOpenChat={() => workspaceId && openWorkspace(workspaceId, "chat")}
          onOpenWhiteboard={() =>
            workspaceId && openWorkspace(workspaceId, "whiteboard")
          }
          onOpenTasks={() => workspaceId && openWorkspace(workspaceId, "tasks")}
        />
      </section>

      <TaskPanel
        tasks={dashboard.tasks}
        loading={dashboard.loading}
        onRefresh={() => {
          void dashboard.refresh();
        }}
        onCreate={dashboard.createTask}
        onComplete={dashboard.completeTask}
      />
    </div>
  );
}
