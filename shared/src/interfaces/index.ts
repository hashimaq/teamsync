export interface ExtensionBadgeCounts {
  messages: number;
  notifications: number;
}

export interface ExtensionDashboardStats {
  unreadMessages: number;
  pendingTasks: number;
  unreadNotifications: number;
}

export interface QuickActionTarget {
  id: "web" | "chat" | "whiteboard" | "tasks";
  label: string;
  path: string;
}
