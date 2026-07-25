import type { Metadata } from "next";
import { getCachedWorkspaces } from "@/lib/data";
import {
  CreateWorkspaceButton,
  WorkspaceGrid,
} from "@/components/workspace/workspace-components";

export const metadata: Metadata = {
  title: "Workspaces",
};

export default async function WorkspacesPage() {
  const workspaces = await getCachedWorkspaces();

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Workspaces</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            All workspaces
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse, edit, or create spaces for your team&apos;s work.
          </p>
        </div>
        <CreateWorkspaceButton />
      </div>
      <WorkspaceGrid workspaces={workspaces} />
    </div>
  );
}
