/** Shared TeamSync constants across web, extension, mobile, desktop */

export const APP_NAME = "TeamSync";
export const APP_TAGLINE = "Collaborate. Chat. Stay in Sync.";

export const WEB_DEFAULT_URL = "https://teamsync-chi.vercel.app";

export const STORAGE_KEYS = {
  session: "teamsync.session",
  workspaceId: "teamsync.activeWorkspaceId",
  unreadMessages: "teamsync.unreadMessages",
  unreadNotifications: "teamsync.unreadNotifications",
} as const;

export const REALTIME_CHANNELS = {
  notifications: (userId: string) => `ext-notifications:${userId}`,
  messages: (userId: string) => `ext-messages:${userId}`,
  tasks: (workspaceId: string) => `ext-tasks:${workspaceId}`,
} as const;
