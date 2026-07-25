import { absoluteWebUrl, workspacePath } from "@teamsync/shared";
import { WEB_URL } from "@/lib/supabase";

export type ExtensionPanel =
  | "chat"
  | "tasks"
  | "whiteboard"
  | "members"
  | "settings"
  | "notifications";

export function openWebApp(path = "/dashboard"): void {
  const url = absoluteWebUrl(WEB_URL, path);
  void chrome.tabs.create({ url });
}

export function openWorkspace(
  workspaceId: string,
  panel?: ExtensionPanel
): void {
  openWebApp(workspacePath(workspaceId, panel));
}

export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
