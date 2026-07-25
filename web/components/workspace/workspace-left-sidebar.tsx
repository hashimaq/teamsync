"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Bell,
  CheckSquare,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Users,
  PenTool,
  Menu,
  X,
} from "lucide-react";
import { logout } from "@/actions/auth";
import { useChatToastsOptional } from "@/components/chat/chat-toast-provider";
import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  useWorkspaceShell,
  type WorkspacePanel,
} from "@/components/workspace/workspace-shell-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { WorkspaceWithMeta } from "@/types";
import { cn } from "@/utils";

const NAV_ITEMS: Array<{
  id: WorkspacePanel;
  label: string;
  icon: typeof MessageSquare;
}> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "whiteboard", label: "Whiteboard", icon: PenTool },
  { id: "members", label: "Members", icon: Users },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

function getInitials(name: string | null | undefined) {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

interface WorkspaceLeftSidebarProps {
  workspaceId: string;
  workspaceName: string;
  workspaces: WorkspaceWithMeta[];
  userName: string | null;
  userAvatar?: string | null;
  unreadCount?: number;
}

export function WorkspaceLeftSidebar({
  workspaceId,
  workspaceName,
  workspaces,
  userName,
  userAvatar,
  unreadCount = 0,
}: WorkspaceLeftSidebarProps) {
  const router = useRouter();
  const { panel, setPanel } = useWorkspaceShell();
  const chatToasts = useChatToastsOptional();
  const chatUnread = chatToasts?.unreadByWorkspace[workspaceId] ?? 0;
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const otherWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.id !== workspaceId),
    [workspaceId, workspaces]
  );

  const content = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/80 p-3">
        <Link
          href="/dashboard"
          className="mb-2.5 flex items-center gap-2 px-1"
          onClick={() => setMobileOpen(false)}
        >
          <BrandMark className="h-8 w-8 rounded-lg" iconClassName="h-3.5 w-3.5" />
          <span className="font-display text-sm font-semibold tracking-tight">
            TeamSync
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setSwitcherOpen((open) => !open)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-border/80 bg-background/70 px-2.5 py-2 text-left shadow-sm transition hover:bg-muted/60"
          aria-expanded={switcherOpen}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
            {workspaceName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight">
              {workspaceName}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">Workspace</p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition",
              switcherOpen ? "rotate-180" : null
            )}
          />
        </button>

        {switcherOpen ? (
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border bg-card/95 p-1.5 shadow-md backdrop-blur">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4" />
              All workspaces
            </Link>
            {otherWorkspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-muted"
                onClick={() => {
                  setSwitcherOpen(false);
                  setMobileOpen(false);
                  router.push(`/workspace/${workspace.id}`);
                }}
              >
                <span className="truncate font-medium">{workspace.name}</span>
              </button>
            ))}
            {otherWorkspaces.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                No other workspaces
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Workspace">
        {NAV_ITEMS.map((item) => {
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
                setMobileOpen(false);
              }}
              className={cn(
                "inline-flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === "chat" && chatUnread > 0 ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {chatUnread > 99 ? "99+" : chatUnread}
                </span>
              ) : null}
              {item.id === "notifications" && unreadCount > 0 ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 border-t border-border/80 p-3">
        <Link
          href="/profile"
          className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-muted/30 px-2.5 py-2 transition hover:bg-muted/60"
          onClick={() => setMobileOpen(false)}
        >
          <Avatar className="h-8 w-8 border border-border/70">
            {userAvatar ? <AvatarImage src={userAvatar} alt="" /> : null}
            <AvatarFallback className="bg-muted text-[10px] font-medium">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName ?? "Account"}</p>
            <p className="text-[11px] text-muted-foreground">View profile</p>
          </div>
          <ThemeToggle />
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start rounded-xl"
          disabled={isPending}
          onClick={() => startTransition(() => logout())}
        >
          <LogOut className="h-4 w-4" />
          {isPending ? "Signing out..." : "Logout"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden h-full w-[248px] shrink-0 border-r border-border/80 bg-card/90 backdrop-blur-md md:flex md:flex-col">
        {content}
      </aside>

      <div className="flex items-center justify-between border-b border-border/80 bg-card/90 px-3 py-2 backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark className="h-8 w-8" iconClassName="h-3.5 w-3.5" />
          <span className="truncate font-display text-sm font-semibold">
            {workspaceName}
          </span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Open workspace menu"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-md md:hidden">
          <div className="flex h-full flex-col pt-12">{content}</div>
        </div>
      ) : null}
    </>
  );
}
