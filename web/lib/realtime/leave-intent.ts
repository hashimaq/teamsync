const leavingWorkspaceIds = new Set<string>();

export function markLeavingWorkspace(workspaceId: string): void {
  leavingWorkspaceIds.add(workspaceId);
}

export function consumeLeavingWorkspace(workspaceId: string): boolean {
  if (!leavingWorkspaceIds.has(workspaceId)) {
    return false;
  }
  leavingWorkspaceIds.delete(workspaceId);
  return true;
}
