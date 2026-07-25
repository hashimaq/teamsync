import { Bell, CheckSquare, MessageSquare } from "lucide-react";
import type { ExtensionDashboardStats } from "@teamsync/shared";
import { Card } from "@/components/ui";

export function StatsCards({
  stats,
  onOpenMessages,
  onOpenTasks,
  onOpenNotifications,
}: {
  stats: ExtensionDashboardStats;
  onOpenMessages: () => void;
  onOpenTasks: () => void;
  onOpenNotifications: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Card onClick={onOpenMessages}>
        <MessageSquare className="h-4 w-4 text-blue-400" />
        <p className="mt-2 text-lg font-semibold tabular-nums">
          {stats.unreadMessages}
        </p>
        <p className="text-[10px] text-slate-400">Unread messages</p>
      </Card>
      <Card onClick={onOpenTasks}>
        <CheckSquare className="h-4 w-4 text-emerald-400" />
        <p className="mt-2 text-lg font-semibold tabular-nums">
          {stats.pendingTasks}
        </p>
        <p className="text-[10px] text-slate-400">Pending tasks</p>
      </Card>
      <Card onClick={onOpenNotifications}>
        <Bell className="h-4 w-4 text-amber-400" />
        <p className="mt-2 text-lg font-semibold tabular-nums">
          {stats.unreadNotifications}
        </p>
        <p className="text-[10px] text-slate-400">Notifications</p>
      </Card>
    </div>
  );
}
