import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

export const queryKeys = {
  profile: (userId: string) => ["profile", userId] as const,
  workspaces: (userId: string) => ["workspaces", userId] as const,
  workspace: (id: string) => ["workspace", id] as const,
  members: (workspaceId: string) => ["members", workspaceId] as const,
  tasks: (workspaceId: string) => ["tasks", workspaceId] as const,
  messages: (workspaceId: string) => ["messages", workspaceId] as const,
  notifications: (userId: string) => ["notifications", userId] as const,
  invitations: (userId: string) => ["invitations", userId] as const,
  activity: (workspaceId: string) => ["activity", workspaceId] as const,
};
