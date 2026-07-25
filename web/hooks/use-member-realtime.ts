"use client";

/**
 * Member-list realtime is composed inside useWorkspaceRealtime.
 * This thin re-export keeps the requested hook surface area.
 */
export { useWorkspaceRealtime as useMemberRealtime } from "@/hooks/use-workspace-realtime";
