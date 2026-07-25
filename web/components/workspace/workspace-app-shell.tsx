"use client";

import { useChatToastsOptional } from "@/components/chat/chat-toast-provider";
import { WorkspaceTaskBoard } from "@/components/task/task-board";
import { WorkspaceActivityRealtimeProvider } from "@/components/notifications/workspace-activity-provider";
import { useNotifications } from "@/components/notifications/notification-provider";
import { WorkspaceLeftSidebar } from "@/components/workspace/workspace-left-sidebar";
import { WorkspaceMembersRealtime } from "@/components/workspace/members-realtime";
import { WorkspaceNotificationsPanel } from "@/components/workspace/workspace-notifications-panel";
import { WorkspaceRightSidebar } from "@/components/workspace/workspace-right-sidebar";
import { WorkspaceSettingsPanel } from "@/components/workspace/workspace-settings-panel";
import {
  WorkspaceShellProvider,
  useWorkspaceShell,
  type WorkspacePanel,
} from "@/components/workspace/workspace-shell-context";
import { WorkspaceTopHeader } from "@/components/workspace/workspace-top-header";
import { WorkspaceWhiteboard } from "@/components/workspace/workspace-whiteboard";
import {
  WorkspaceChat,
  WorkspaceChatSkeleton,
} from "@/components/workspace/workspace-chat";
import { WorkspaceMembersSkeleton } from "@/components/workspace/members-section";
import { WorkspacePresenceProvider } from "@/hooks/use-workspace-presence";
import type {
  ChatMessageWithSender,
  Task,
  Workspace,
  WorkspaceInvitationWithDetails,
  WorkspaceMemberWithProfile,
  WorkspaceWithMeta,
} from "@/types";
import { cn } from "@/utils";
import {
  Bell,
  CheckSquare,
  MessageSquare,
  PenTool,
  Users,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";

interface WorkspaceAppShellProps {
  workspace: Workspace;
  workspaces: WorkspaceWithMeta[];
  members: WorkspaceMemberWithProfile[];
  pendingInvitations: WorkspaceInvitationWithDetails[];
  tasks: Task[];
  messages: ChatMessageWithSender[];
  isOwner: boolean;
  canLeave: boolean;
  currentUserId: string | null;
  currentUserName: string | null;
  currentUserAvatar: string | null;
}

const MOBILE_NAV: Array<{
  id: WorkspacePanel;
  label: string;
  icon: typeof MessageSquare;
}> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "whiteboard", label: "Board", icon: PenTool },
  { id: "members", label: "Members", icon: Users },
  { id: "notifications", label: "Alerts", icon: Bell },
];

function WorkspaceMobileBottomNav({
  workspaceId,
  unreadCount,
}: {
  workspaceId: string;
  unreadCount: number;
}) {
  const { panel, setPanel } = useWorkspaceShell();
  const chatToasts = useChatToastsOptional();
  const chatUnread = chatToasts?.unreadByWorkspace[workspaceId] ?? 0;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border/80 bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-md md:hidden"
      aria-label="Primary"
    >
      {MOBILE_NAV.map((item) => {
        const Icon = item.icon;
        const active = panel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => {
              setPanel(item.id);
              if (item.id === "chat") {
                chatToasts?.clearWorkspaceUnread(workspaceId);
              }
            }}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-medium transition",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
            {item.id === "chat" && chatUnread > 0 ? (
              <span className="absolute right-[22%] top-1 h-1.5 w-1.5 rounded-full bg-primary" />
            ) : null}
            {item.id === "notifications" && unreadCount > 0 ? (
              <span className="absolute right-[22%] top-1 h-1.5 w-1.5 rounded-full bg-primary" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

function WorkspaceMainPanels({
  workspace,
  members,
  pendingInvitations,
  tasks,
  messages,
  isOwner,
  canLeave,
  currentUserId,
  currentUserName,
  currentUserAvatar,
}: Omit<WorkspaceAppShellProps, "workspaces">) {
  const { panel } = useWorkspaceShell();
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    setClientReady(true);
  }, []);

  const showMembers = panel === "members";
  const showTasks = panel === "tasks";
  const showChat = panel === "chat";

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      {clientReady || showMembers ? (
        <div
          className={
            showMembers ? "flex h-full min-h-0 flex-col overflow-hidden" : "hidden"
          }
        >
          <Suspense fallback={<WorkspaceMembersSkeleton />}>
            <WorkspaceMembersRealtime
              workspaceId={workspace.id}
              currentUserId={currentUserId}
              initialMembers={members}
              pendingInvitations={pendingInvitations}
              isOwner={isOwner}
            />
          </Suspense>
        </div>
      ) : null}

      {clientReady || showChat ? (
        <div className={showChat ? "h-full min-h-0" : "hidden"}>
          <WorkspaceChat
            workspaceId={workspace.id}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserAvatar={currentUserAvatar}
            initialMessages={messages}
          />
        </div>
      ) : null}

      {clientReady || showTasks ? (
        <div className={showTasks ? "h-full min-h-0" : "hidden"}>
          <WorkspaceTaskBoard
            workspaceId={workspace.id}
            initialTasks={tasks}
            members={members}
            currentUserId={currentUserId}
          />
        </div>
      ) : null}

      {panel === "whiteboard" ? (
        <div className="h-full min-h-0">
          <WorkspaceWhiteboard
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            userId={currentUserId}
            userName={currentUserName}
            userAvatar={currentUserAvatar}
          />
        </div>
      ) : null}

      {panel === "notifications" ? (
        <div className="h-full min-h-0">
          <WorkspaceNotificationsPanel />
        </div>
      ) : null}

      {panel === "settings" ? (
        <div className="h-full min-h-0">
          <WorkspaceSettingsPanel
            workspace={workspace}
            isOwner={isOwner}
            canLeave={canLeave}
            userId={currentUserId}
            displayName={currentUserName ?? "Someone"}
          />
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceShellInner(props: WorkspaceAppShellProps) {
  const {
    workspace,
    workspaces,
    members,
    tasks,
    isOwner,
    currentUserId,
    currentUserName,
    currentUserAvatar,
  } = props;

  const { unreadCount } = useNotifications();

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <WorkspaceLeftSidebar
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        workspaces={workspaces}
        userName={currentUserName}
        userAvatar={currentUserAvatar}
        unreadCount={unreadCount}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceTopHeader
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          description={workspace.description}
          isOwner={isOwner}
          currentUserId={currentUserId}
          members={members}
        />
        <WorkspaceMainPanels {...props} />
      </div>

      <WorkspaceRightSidebar
        workspace={workspace}
        members={members}
        isOwner={isOwner}
        taskCount={tasks.length}
      />

      <WorkspaceMobileBottomNav
        workspaceId={workspace.id}
        unreadCount={unreadCount}
      />
    </div>
  );
}

export function WorkspaceAppShell(props: WorkspaceAppShellProps) {
  const {
    workspace,
    members,
    currentUserId,
    currentUserName,
    currentUserAvatar,
  } = props;

  return (
    <WorkspacePresenceProvider
      workspaceId={workspace.id}
      userId={currentUserId}
      fullName={currentUserName}
      avatarUrl={currentUserAvatar}
      initialMemberCount={members.length}
    >
      <div className="flex h-full min-h-0 flex-col">
        <Suspense
          fallback={
            <div className="flex h-full min-h-0 items-center justify-center text-sm text-muted-foreground">
              Loading workspace…
            </div>
          }
        >
          <WorkspaceShellProvider defaultPanel="chat">
            <WorkspaceActivityRealtimeProvider workspaceId={workspace.id}>
              <WorkspaceShellInner {...props} />
            </WorkspaceActivityRealtimeProvider>
          </WorkspaceShellProvider>
        </Suspense>
      </div>
    </WorkspacePresenceProvider>
  );
}

export function WorkspaceChatPanelFallback() {
  return <WorkspaceChatSkeleton />;
}
